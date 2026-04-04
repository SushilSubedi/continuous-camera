import type {
  CameraOptions,
  CameraState,
  CameraEventMap,
  CameraEventHandler,
  CaptureOptions,
} from './types';
import { buildConstraints, isMediaDevicesSupported, stopStream } from './utils';

export class Camera {
  private _state: CameraState = 'idle';
  private _stream: MediaStream | null = null;
  private _error: Error | null = null;
  private _options: CameraOptions;
  private _listeners = new Map<string, Set<CameraEventHandler<any>>>();

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
      this._setState('active');
      this._emit('streamstart', stream);
      return stream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      throw this._setError(error);
    }
  }

  stop(): void {
    stopStream(this._stream);
    this._stream = null;
    this._setState('idle');
    this._emit('streamstop', undefined);
  }

  async switchCamera(): Promise<MediaStream> {
    const current = this._options.facingMode ?? 'user';
    this._options.facingMode = current === 'user' ? 'environment' : 'user';

    if (this._state === 'active') {
      this.stop();
      return this.start();
    }

    return this.start();
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
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.convertToBlob({ type: format, quality });
    }

    // Fallback: render video to canvas
    return this._captureFromVideoElement(format, quality);
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

  private _captureFromVideoElement(format: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.srcObject = this._stream;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.play().then(() => {
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
