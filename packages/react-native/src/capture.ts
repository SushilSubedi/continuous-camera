import type { CameraPhotoOutput, CameraRef } from 'react-native-vision-camera';

export type CaptureMode = 'fast' | 'hd';
export type CaptureMethod = 'preview-snapshot' | 'photo';

export interface CapturedPhoto {
  /** Temporary file URI. The caller must move/save or delete this file. */
  uri: string;
  filePath: string;
  method: CaptureMethod;
  /** Milliseconds from the native capture request until the file was written. */
  durationMs: number;
}

export function selectCaptureMethod(
  platform: string,
  mode: CaptureMode,
  flash: boolean,
): CaptureMethod {
  return platform === 'android' && mode === 'fast' && !flash
    ? 'preview-snapshot'
    : 'photo';
}

export async function capturePhoto(options: {
  camera: Pick<CameraRef, 'takeSnapshot'>;
  photoOutput: Pick<CameraPhotoOutput, 'capturePhotoToFile'>;
  platform: string;
  mode: CaptureMode;
  flash: boolean;
  quality: number;
}): Promise<CapturedPhoto> {
  const method = selectCaptureMethod(options.platform, options.mode, options.flash);
  const started = Date.now();
  let filePath: string;
  if (method === 'preview-snapshot') {
    const snapshot = await options.camera.takeSnapshot();
    try {
      filePath = await snapshot.saveToTemporaryFileAsync('jpg', Math.round(options.quality * 100));
    } finally {
      snapshot.dispose();
    }
  } else {
    const photo = await options.photoOutput.capturePhotoToFile({
      flashMode: options.flash ? 'on' : 'off',
      enableShutterSound: false,
      enableVirtualDeviceFusion: false,
    }, {});
    filePath = photo.filePath;
  }
  const uri = /^\w[\w+.-]*:\/\//.test(filePath) ? filePath : `file://${filePath}`;
  return { uri, filePath, method, durationMs: Date.now() - started };
}
