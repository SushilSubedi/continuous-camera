export type CameraFacingMode = 'user' | 'environment';

export type CameraState = 'idle' | 'starting' | 'active' | 'error';

export interface Resolution {
  width: number;
  height: number;
}

export interface CameraOptions {
  /** Camera facing mode. Default: 'user' */
  facingMode?: CameraFacingMode;
  /** Preferred resolution. Default: { width: 1920, height: 1080 } */
  resolution?: Resolution;
  /** Enable audio capture. Default: false */
  audio?: boolean;
  /** Raw MediaStreamConstraints override (takes precedence over other options) */
  constraints?: MediaStreamConstraints;
}

export interface CaptureOptions {
  /** Image format. Default: 'image/jpeg' */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Image quality (0-1). Default: 0.92 */
  quality?: number;
}

export interface CameraEventMap {
  statechange: CameraState;
  error: Error;
  streamstart: MediaStream;
  streamstop: void;
}

export type CameraEventHandler<T> = (data: T) => void;
