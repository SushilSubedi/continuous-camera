import type {
  CameraOptions,
  CameraState,
  CameraEventMap,
  CameraEventHandler,
  CaptureBurstOptions,
  CaptureOptions,
} from './types';
import { buildConstraints, isMediaDevicesSupported, stopStream } from './utils';

/** Rejection from `captureBurst()` when a shot fails. `photos` holds the shots already taken. */
export class CaptureBurstError extends Error {
  constructor(readonly photos: Blob[], readonly cause: Error) {
    super(cause.message);
    this.name = 'CaptureBurstError';
  }
}

interface CaptureJob {
  options: CaptureOptions;
  resolve: (blob: Blob) => void;
  reject: (error: Error) => void;
}

/** One stream's capture queue. `stop()` replaces it, so an in-flight shot can never block the next stream. */
interface CaptureSession {
  queue: CaptureJob[];
  running: boolean;
}

interface Burst {
  stopped: boolean;
  wake?: () => void;
}

/** The fallback video element while it loads, so `stop()` can abandon the load. */
interface VideoLoad {
  element: HTMLVideoElement;
  reject: (error: Error) => void;
}

const DEFAULT_MAX_PENDING_CAPTURES = 10;
const VIDEO_LOAD_TIMEOUT_MS = 5000;

export class Camera {
  private _state: CameraState = 'idle';
  private _stream: MediaStream | null = null;
  private _error: Error | null = null;
  private _options: CameraOptions;
  private _listeners = new Map<string, Set<CameraEventHandler<any>>>();
  private _trackEndedHandler: (() => void) | null = null;
  private _deviceChangeHandler: (() => void) | null = null;
  private _session: CaptureSession = { queue: [], running: false };
  private _pending = 0;
  private _burst: Burst | null = null;
  private _video: Promise<HTMLVideoElement> | null = null;
  private _videoLoad: VideoLoad | null = null;

  constructor(options: CameraOptions = {}) {
    this._options = options;
  }

  // -- Getters --

  get state(): CameraState {
    return this._state;
  }

  get stream(): MediaStream | null {
    return this._stream;
  }

  get error(): Error | null {
    return this._error;
  }

  get isActive(): boolean {
    return this._state === 'active';
  }

  /** Queued plus in-flight shots */
  get pendingCaptures(): number {
    return this._pending;
  }

  get isBursting(): boolean {
    return this._burst !== null;
  }

  /** The configured queue limit (`maxPendingCaptures`, default 10) */
  get maxPendingCaptures(): number {
    return this._options.maxPendingCaptures ?? DEFAULT_MAX_PENDING_CAPTURES;
  }

  // -- Lifecycle --

  async start(): Promise<MediaStream> {
    if (this._state === 'active' && this._stream) {
      return this._stream;
    }

    if (!isMediaDevicesSupported()) {
      throw this._setError(new Error('getUserMedia is not supported in this environment'));
    }

    this._setState('starting');
    this._error = null;

    try {
      const constraints = buildConstraints(this._options);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._stream = stream;
      this._attachTrackListeners(stream);
      this._attachDeviceChangeListener();
      this._setState('active');
      this._emit('streamstart', stream);
      return stream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw this._setError(error);
    }
  }

  stop(): void {
    this._cancelCaptures();
    this._detachTrackListeners();
    this._detachDeviceChangeListener();
    stopStream(this._stream);
    this._stream = null;
    this._setState('idle');
    this._emit('streamstop', undefined);
  }

  async switchCamera(): Promise<MediaStream> {
    const current = this._options.facingMode ?? 'user';
    this._options.facingMode = current === 'user' ? 'environment' : 'user';
    this._options.deviceId = undefined;

    if (this._state === 'active') {
      this.stop();
      return this.start();
    }

    return this.start();
  }

  /** Select a specific camera by deviceId and restart the stream */
  async selectDevice(deviceId: string): Promise<MediaStream> {
    this._options.deviceId = deviceId;

    if (this._state === 'active') {
      this.stop();
      return this.start();
    }

    return this.start();
  }

  /** Apply new constraints to the active video track without restarting */
  async applyConstraints(constraints: MediaTrackConstraints): Promise<void> {
    if (!this._stream) {
      throw new Error('Camera is not active. Call start() first.');
    }

    const videoTrack = this._stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track available.');
    }

    await videoTrack.applyConstraints(constraints);
  }

  /** Get the capabilities of the active video track */
  getCapabilities(): MediaTrackCapabilities | null {
    const videoTrack = this._stream?.getVideoTracks()[0];
    if (!videoTrack || typeof videoTrack.getCapabilities !== 'function') return null;
    return videoTrack.getCapabilities();
  }

  /** Get the current settings of the active video track */
  getSettings(): MediaTrackSettings | null {
    const videoTrack = this._stream?.getVideoTracks()[0];
    if (!videoTrack || typeof videoTrack.getSettings !== 'function') return null;
    return videoTrack.getSettings();
  }

  /**
   * Queues one shot and resolves with its Blob. Shots run one at a time in order; shots that
   * have not started reject with `Camera stopped` when the camera stops or switches.
   */
  capture(options: CaptureOptions = {}): Promise<Blob> {
    if (!this._stream) {
      return Promise.reject(new Error('Camera is not active. Call start() first.'));
    }
    if (!this._stream.getVideoTracks()[0]) {
      return Promise.reject(new Error('No video track available.'));
    }
    const maxPending = this.maxPendingCaptures;
    if (!Number.isInteger(maxPending) || maxPending < 1) {
      return Promise.reject(new RangeError('maxPendingCaptures must be a positive integer'));
    }
    if (this._pending >= maxPending) {
      return Promise.reject(new Error('Capture queue is full'));
    }

    const session = this._session;
    const shot = new Promise<Blob>((resolve, reject) => {
      session.queue.push({ options, resolve, reject });
    });
    this._setPending(this._pending + 1);
    void this._drain(session);
    return shot;
  }

  /**
   * Captures continuously until `count` is reached, `stopBurst()` or `signal` ends it, or the
   * camera stops, then resolves with every photo taken. Each photo is also emitted as `capture`.
   */
  async captureBurst(options: CaptureBurstOptions = {}): Promise<Blob[]> {
    const { count = Infinity, interval = 0, signal, ...captureOptions } = options;
    if (count !== Infinity && (!Number.isInteger(count) || count < 1)) {
      throw new RangeError('Burst count must be a positive integer');
    }
    if (!Number.isFinite(interval) || interval < 0) {
      throw new RangeError('Burst interval must be a non-negative number');
    }
    if (this._burst) throw new Error('A burst is already running');
    if (!this._stream) throw new Error('Camera is not active. Call start() first.');

    const session = this._session;
    const burst: Burst = { stopped: false };
    const end = () => this._endBurst(burst);
    this._burst = burst;
    this._emitCaptureChange();
    signal?.addEventListener('abort', end);
    const photos: Blob[] = [];
    try {
      while (photos.length < count && !burst.stopped && !signal?.aborted && session === this._session) {
        const started = Date.now();
        try {
          photos.push(await this.capture(captureOptions));
        } catch (cause) {
          if (session !== this._session || burst.stopped) break;
          throw new CaptureBurstError(photos, cause instanceof Error ? cause : new Error(String(cause)));
        }
        const wait = interval - (Date.now() - started);
        if (wait > 0 && photos.length < count && !burst.stopped) {
          await new Promise<void>((resume) => {
            const timer = setTimeout(resume, wait);
            burst.wake = () => {
              clearTimeout(timer);
              resume();
            };
          });
          burst.wake = undefined;
        }
      }
      return photos;
    } finally {
      signal?.removeEventListener('abort', end);
      if (this._burst === burst) {
        this._burst = null;
        this._emitCaptureChange();
      }
    }
  }

  /** Ends a running burst after its in-flight shot; a new burst can start immediately */
  stopBurst(): void {
    if (this._burst) this._endBurst(this._burst);
  }

  async getDevices(): Promise<MediaDeviceInfo[]> {
    if (!isMediaDevicesSupported()) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput');
  }

  // -- Events --

  on<K extends keyof CameraEventMap>(
    event: K,
    handler: CameraEventHandler<CameraEventMap[K]>,
  ): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof CameraEventMap>(
    event: K,
    handler: CameraEventHandler<CameraEventMap[K]>,
  ): void {
    this._listeners.get(event)?.delete(handler);
  }

  destroy(): void {
    this.stop();
    this._listeners.clear();
  }

  // -- Private --

  private async _drain(session: CaptureSession): Promise<void> {
    if (session.running) return;
    session.running = true;
    try {
      while (session === this._session && session.queue.length > 0) {
        const job = session.queue.shift()!;
        const started = Date.now();
        try {
          const blob = await this._captureFrame(job.options);
          this._emitGuarded('capture', { blob, durationMs: Date.now() - started });
          job.resolve(blob);
        } catch (err) {
          job.reject(err instanceof Error ? err : new Error(String(err)));
        } finally {
          this._setPending(this._pending - 1);
        }
      }
    } finally {
      session.running = false;
    }
  }

  private _cancelCaptures(): void {
    const cancelled = this._session.queue.splice(0);
    this._session = { queue: [], running: false };
    this._burst?.wake?.();
    cancelled.forEach((job) => job.reject(new Error('Camera stopped')));
    if (cancelled.length > 0) this._setPending(this._pending - cancelled.length);
    this._releaseVideo(new Error('Camera stopped'));
  }

  /** Detaches the fallback video element and settles a load still in progress. */
  private _releaseVideo(reason: Error): void {
    const video = this._video;
    const load = this._videoLoad;
    this._video = null;
    this._videoLoad = null;
    if (load) {
      load.element.srcObject = null;
      load.reject(reason);
    }
    video?.then((element) => { element.srcObject = null; }, () => {});
  }

  private _endBurst(burst: Burst): void {
    burst.stopped = true;
    burst.wake?.();
    if (this._burst === burst) {
      this._burst = null;
      this._emitCaptureChange();
    }
  }

  private _setPending(pending: number): void {
    this._pending = pending;
    this._emitCaptureChange();
  }

  private _emitCaptureChange(): void {
    this._emitGuarded('capturechange', { pending: this._pending, bursting: this._burst !== null });
  }

  /**
   * Capture events fire from inside the queue. A throwing listener must not lose a photo or stall
   * the queue, so its error is reported asynchronously, like a DOM event handler's.
   */
  private _emitGuarded<K extends 'capture' | 'capturechange'>(event: K, data: CameraEventMap[K]): void {
    this._listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (err) {
        queueMicrotask(() => { throw err; });
      }
    });
  }

  private async _captureFrame(options: CaptureOptions): Promise<Blob> {
    const videoTrack = this._stream?.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('Camera is not active. Call start() first.');
    }

    const format = options.format ?? 'image/jpeg';
    const quality = options.quality ?? 0.92;

    // Use ImageCapture API if available
    if (typeof (globalThis as any).ImageCapture !== 'undefined') {
      const IC = (globalThis as any).ImageCapture;
      const imageCapture = new IC(videoTrack);
      const bitmap: ImageBitmap = await imageCapture.grabFrame();
      const transformed = this._applyTransforms(bitmap, bitmap.width, bitmap.height, options);
      bitmap.close();
      return transformed.convertToBlob({ type: format, quality });
    }

    // Fallback: render video to canvas
    return this._captureFromVideoElement(format, quality, options);
  }

  private _setState(state: CameraState): void {
    this._state = state;
    this._emit('statechange', state);
  }

  private _setError(error: Error): Error {
    this._error = error;
    this._setState('error');
    this._emit('error', error);
    return error;
  }

  private _emit<K extends keyof CameraEventMap>(event: K, data: CameraEventMap[K]): void {
    this._listeners.get(event)?.forEach((handler) => handler(data));
  }

  private _attachTrackListeners(stream: MediaStream): void {
    this._detachTrackListeners();
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    this._trackEndedHandler = () => {
      // An ended track leaves the fallback element showing its last frame forever.
      this._releaseVideo(new Error('The camera track ended'));
      this._emit('trackended', undefined);
    };
    videoTrack.addEventListener('ended', this._trackEndedHandler);
  }

  private _detachTrackListeners(): void {
    if (this._trackEndedHandler && this._stream) {
      const videoTrack = this._stream.getVideoTracks()[0];
      videoTrack?.removeEventListener('ended', this._trackEndedHandler);
    }
    this._trackEndedHandler = null;
  }

  private _attachDeviceChangeListener(): void {
    this._detachDeviceChangeListener();
    if (!isMediaDevicesSupported()) return;

    this._deviceChangeHandler = async () => {
      const devices = await this.getDevices();
      this._emit('devicechange', devices);
    };
    navigator.mediaDevices.addEventListener('devicechange', this._deviceChangeHandler);
  }

  private _detachDeviceChangeListener(): void {
    if (this._deviceChangeHandler && isMediaDevicesSupported()) {
      navigator.mediaDevices.removeEventListener('devicechange', this._deviceChangeHandler);
    }
    this._deviceChangeHandler = null;
  }

  private _applyTransforms(
    source: ImageBitmap | HTMLVideoElement,
    srcWidth: number,
    srcHeight: number,
    options: CaptureOptions,
  ): OffscreenCanvas {
    const crop = options.crop;
    const sx = crop?.x ?? 0;
    const sy = crop?.y ?? 0;
    const sw = crop?.width ?? srcWidth;
    const sh = crop?.height ?? srcHeight;

    const rotate = options.rotate ?? 0;
    const isRotated90 = rotate === 90 || rotate === 270;
    const drawW = options.resize?.width ?? sw;
    const drawH = options.resize?.height ?? sh;
    const canvasW = isRotated90 ? drawH : drawW;
    const canvasH = isRotated90 ? drawW : drawH;

    const canvas = new OffscreenCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d')!;

    ctx.save();

    // Move origin to center for rotation/mirror
    ctx.translate(canvasW / 2, canvasH / 2);

    if (rotate) {
      ctx.rotate((rotate * Math.PI) / 180);
    }

    if (options.mirror) {
      ctx.scale(-1, 1);
    }

    // Draw centered
    ctx.drawImage(source, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();
    return canvas;
  }

  /**
   * One playing video element per stream, reused so repeated shots skip the load and play.
   * `stop()` or a timeout rejects a load that never finishes, so a shot can't hang the queue.
   */
  private _getVideo(): Promise<HTMLVideoElement> {
    if (this._video) return this._video;
    const element = document.createElement('video');
    const video = new Promise<HTMLVideoElement>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const settle = (error?: unknown) => {
        clearTimeout(timer);
        if (this._videoLoad?.element === element) this._videoLoad = null;
        if (error === undefined) resolve(element);
        else reject(error instanceof Error ? error : new Error(String(error)));
      };
      timer = setTimeout(() => settle(new Error('Timed out loading the camera stream')), VIDEO_LOAD_TIMEOUT_MS);
      this._videoLoad = { element, reject: (error) => settle(error) };
      element.srcObject = this._stream;
      element.muted = true;
      element.playsInline = true;
      element.onloadedmetadata = () => {
        element.play().then(() => settle(), settle);
      };
      element.onerror = () => settle(new Error('Failed to load the camera stream'));
    });
    this._video = video;
    // Let the next shot retry after a failed load.
    video.catch(() => {
      if (this._video === video) this._video = null;
    });
    return video;
  }

  private async _captureFromVideoElement(
    format: string,
    quality: number,
    captureOptions: CaptureOptions,
  ): Promise<Blob> {
    const video = await this._getVideo();
    // WebKit pauses media when the page is hidden; a paused element keeps returning one frame.
    if (video.paused || video.readyState < 2) await video.play();
    const hasTransforms = captureOptions.crop || captureOptions.resize || captureOptions.mirror || captureOptions.rotate;

    if (hasTransforms) {
      const offscreen = this._applyTransforms(video, video.videoWidth, video.videoHeight, captureOptions);
      return offscreen.convertToBlob({ type: format, quality });
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to capture image'));
        },
        format,
        quality,
      );
    });
  }
}
