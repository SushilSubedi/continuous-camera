import { Camera, CaptureBurstError } from "./camera";
import type {
  CameraOptions,
  CameraState,
  CameraFacingMode,
  CameraEventMap,
  CameraEventHandler,
  CaptureOptions,
  CaptureBurstOptions,
  CapturedPhoto,
  CaptureQueueState,
  CropRegion,
  Resolution,
} from "./types";

export { Camera, CaptureBurstError };
export { isMediaDevicesSupported, isBrowser } from "./utils";
export type {
  CameraOptions,
  CameraState,
  CameraFacingMode,
  CameraEventMap,
  CameraEventHandler,
  CaptureOptions,
  CaptureBurstOptions,
  CapturedPhoto,
  CaptureQueueState,
  CropRegion,
  Resolution,
};

/** Convenience factory */
export function createCamera(options?: CameraOptions): Camera {
  return new Camera(options);
}
