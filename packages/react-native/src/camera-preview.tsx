import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Camera } from 'react-native-vision-camera';
import type { UseCameraReturn } from './use-camera';

export interface CameraPreviewProps {
  camera: UseCameraReturn;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Mount one preview per useCamera instance. Children may provide overlays. */
export function CameraPreview({ camera, style, children }: CameraPreviewProps) {
  return (
    <View style={[{ flex: 1 }, style]}>
      {camera.previewProps && (
        <Camera {...camera.previewProps} ref={camera.cameraRef} style={{ flex: 1 }} />
      )}
      {children}
    </View>
  );
}
