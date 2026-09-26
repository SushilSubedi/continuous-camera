export type CameraFacingMode = 'user' | 'environment';

export type CameraState = 'idle' | 'starting' | 'active' | 'error';

export interface Resolution {
  width: number;
  height: number;
}

export interface CropRegion {
  /** X offset (pixels from left) */
  x: number;
  /** Y offset (pixels from top) */
  y: number;
  /** Crop width in pixels */
  width: number;
  /** Crop height in pixels */
  height: number;
}

export interface CameraOptions {
  /** Camera facing mode. Default: 'user' */
  facingMode?: CameraFacingMode;
  /** Select a specific device by its deviceId */
  deviceId?: string;
  /** Preferred resolution. Default: { width: 1920, height: 1080 } */
  resolution?: Resolution;
  /** Enable audio capture. Default: false */
  audio?: boolean;
  /** Raw MediaStreamConstraints override (takes precedence over other options) */
  constraints?: MediaStreamConstraints;
  /** Maximum queued plus in-flight captures before `capture()` rejects. Default: 10 */
  maxPendingCaptures?: number;
}

export interface CaptureOptions {
  /** Image format. Default: 'image/jpeg' */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Image quality (0-1). Default: 0.92 */
  quality?: number;
  /** Crop a region from the captured frame */
  crop?: CropRegion;
  /** Resize the output to a target resolution */
  resize?: Resolution;
  /** Mirror the image horizontally. Default: false */
  mirror?: boolean;
  /** Rotate the image in degrees (0, 90, 180, 270). Default: 0 */
  rotate?: 0 | 90 | 180 | 270;
}

export interface CaptureBurstOptions extends CaptureOptions {
  /** Number of photos to take. Default: unlimited until `stopBurst()`, `signal`, or `stop()` */
  count?: number;
  /** Minimum milliseconds between the start of consecutive shots. Default: 0 (back to back) */
  interval?: number;
  /** Ends the burst after the in-flight shot; the photos taken so far are returned */
  signal?: AbortSignal;
}

export interface CapturedPhoto {
  blob: Blob;
  /** Milliseconds from the start of the shot until its Blob was encoded */
  durationMs: number;
}

export interface CaptureQueueState {
  /** Queued plus in-flight shots */
  pending: number;
  bursting: boolean;
}

export interface CameraEventMap {
  statechange: CameraState;
  error: Error;
  streamstart: MediaStream;
  streamstop: void;
  /** Fired when a device is added or removed */
  devicechange: MediaDeviceInfo[];
  /** Fired when the active video track ends unexpectedly */
  trackended: void;
  /** Fired with every photo from `capture()` and `captureBurst()` as soon as it is encoded */
  capture: CapturedPhoto;
  /** Fired when the number of pending shots or the burst state changes */
  capturechange: CaptureQueueState;
}

export type CameraEventHandler<T> = (data: T) => void;
