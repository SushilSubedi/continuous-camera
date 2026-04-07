import type {
  CameraOptions,
  CameraState,
  CameraEventMap,
  CameraEventHandler,
  CaptureOptions,
  CropRegion,
  Resolution,
} from './types';
import { buildConstraints, isMediaDevicesSupported, stopStream } from './utils';

export class Camera {
  private _state: CameraState = 'idle';
  private _stream: MediaStream | null = null;
  private _error: Error | null = null;
  private _options: CameraOptions;
  private _listeners = new Map<string, Set<CameraEventHandler<any>>>();
  private _trackEndedHandler: (() => void) | null = null;
  private _deviceChangeHandler: (() => void) | null = null;

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

  async capture(options: CaptureOptions = {}): Promise<Blob> {
    if (!this._stream) {
      throw new Error('Camera is not active. Call start() first.');
    }

    const videoTrack = this._stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track available.');
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

  private _captureFromVideoElement(
    format: string,
    quality: number,
    captureOptions: CaptureOptions,
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.srcObject = this._stream;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.play().then(() => {
          const hasTransforms = captureOptions.crop || captureOptions.resize || captureOptions.mirror || captureOptions.rotate;

          if (hasTransforms) {
            const offscreen = this._applyTransforms(video, video.videoWidth, video.videoHeight, captureOptions);
            offscreen.convertToBlob({ type: format, quality }).then((blob) => {
              video.srcObject = null;
              resolve(blob);
            }).catch(reject);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0);
          canvas.toBlob(
            (blob) => {
              video.srcObject = null;
              if (blob) resolve(blob);
              else reject(new Error('Failed to capture image'));
            },
            format,
            quality,
          );
        });
      };
    });
  }
}
