import { Camera } from "./camera";
import type {
  CameraOptions,
  CameraState,
  CameraFacingMode,
  CameraEventMap,
  CameraEventHandler,
  CaptureOptions,
  CropRegion,
  Resolution,
} from "./types";

export { Camera };
export { isMediaDevicesSupported, isBrowser } from "./utils";
export type {
  CameraOptions,
  CameraState,
  CameraFacingMode,
  CameraEventMap,
  CameraEventHandler,
  CaptureOptions,
  CropRegion,
  Resolution,
};

/** Convenience factory */
export function createCamera(options?: CameraOptions): Camera {
  return new Camera(options);
}
