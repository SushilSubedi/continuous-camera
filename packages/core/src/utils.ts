import type { CameraOptions } from './types';

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

export function isMediaDevicesSupported(): boolean {
  return isBrowser() && !!navigator.mediaDevices?.getUserMedia;
}

export function buildConstraints(options: CameraOptions): MediaStreamConstraints {
  if (options.constraints) {
    return options.constraints;
  }

  const resolution = options.resolution ?? { width: 1920, height: 1080 };

  return {
    video: {
      facingMode: options.facingMode ?? 'user',
      width: { ideal: resolution.width },
      height: { ideal: resolution.height },
    },
    audio: options.audio ?? false,
  };
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
