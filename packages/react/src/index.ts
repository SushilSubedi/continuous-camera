export { useCamera } from './use-camera';
export type { UseCameraOptions, UseCameraReturn } from './use-camera';
export { CaptureBurstError } from '@continuous-camera/core';
export { CameraPreview, useCameraPreview } from './camera-preview';
export type { CameraPreviewProps } from './camera-preview';

// Re-export core types for convenience
export type {
  CameraOptions,
  CameraState,
  CameraFacingMode,
  CaptureOptions,
  CaptureBurstOptions,
  CapturedPhoto,
  CropRegion,
  Resolution,
} from '@continuous-camera/core';
