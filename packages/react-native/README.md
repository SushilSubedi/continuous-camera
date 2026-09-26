# @continuous-camera/react-native

React Native camera support for Continuous Camera, built on VisionCamera 5 and inspired by the camera flow in `listengine-mobile`. This package lives in the Continuous Camera monorepo and is independent of the browser packages.

Status: unreleased. Verified on an Android 16 emulator (capture, queue, bursts, hold-to-shoot, lifecycle) and on the iOS Simulator (launch and permissions only; it has no camera). Not yet verified on physical devices. Developed against React Native 0.81.5, React 19.1, and VisionCamera 5.0.11. VisionCamera 4 is not supported.

Try the [standalone Expo demo](../../examples/expo-demo) for a complete app using this package.

## Setup

Until published, build and pack this workspace package and install the resulting tarball in your app:

```sh
pnpm --filter @continuous-camera/react-native build
cd packages/react-native
pnpm pack
# In your React Native app:
npm install /absolute/path/to/continuous-camera-react-native-0.1.0.tgz
npm install react-native-vision-camera@^5.0.11 react-native-nitro-modules react-native-nitro-image
```

Follow [VisionCamera's native setup instructions](https://github.com/mrousavy/react-native-vision-camera/blob/main/docs/content/docs/index.mdx) for compatible native dependencies, camera permission declarations, and rebuilding the app. For Expo, use a development build containing the native modules; Expo Go does not include them. Camera features must be validated on physical Android and iOS devices.

## Usage

```tsx
import { Button, Linking, Text, View } from 'react-native';
import { CameraPreview, useCamera } from '@continuous-camera/react-native';
import type { CapturedPhoto } from '@continuous-camera/react-native';

export function CaptureScreen({
  isFocused,
  savePhoto,
}: {
  isFocused: boolean;
  savePhoto: (photo: CapturedPhoto) => Promise<void>;
}) {
  const camera = useCamera({
    isActive: isFocused,
    facingMode: 'environment',
    defaultCaptureMode: 'fast',
  });

  if (!camera.permission.hasPermission) {
    return (
      <Button
        title={camera.permission.canRequestPermission ? 'Allow camera' : 'Open settings'}
        onPress={() => {
          const action = camera.permission.canRequestPermission
            ? camera.permission.requestPermission()
            : Linking.openSettings();
          void action.catch(console.error);
        }}
      />
    );
  }

  if (!camera.device) return <Text>No camera available</Text>;

  return (
    <View style={{ flex: 1 }}>
      <CameraPreview camera={camera} />
      <Button
        title="Capture"
        disabled={!camera.canCapture}
        onPress={async () => {
          try {
            await savePhoto(await camera.capture());
          } catch (error) {
            console.error(error);
          }
        }}
      />
      <Button
        title={`Mode: ${camera.captureMode === 'fast' ? 'Fast' : 'HD'}`}
        disabled={camera.isCapturing}
        onPress={() => camera.setCaptureMode(camera.captureMode === 'fast' ? 'hd' : 'fast')}
      />
      <Text>Capturing in {camera.effectiveCaptureMode === 'fast' ? 'Fast' : 'HD'} mode</Text>
      <Button title="Switch" disabled={!camera.canSwitchCamera} onPress={camera.switchCamera} />
      <Button
        title={camera.flashEnabled ? 'Flash off' : 'Flash on'}
        disabled={!camera.canUseFlash || camera.isCapturing}
        onPress={() => camera.setFlashEnabled(!camera.flashEnabled)}
      />
      {camera.error && <Text>{camera.error.message}</Text>}
    </View>
  );
}
```

## Fast and HD modes

| Mode | Capture path | Use |
|---|---|---|
| Fast | Android preview snapshot, without flash | Repeated shots where preview resolution is sufficient |
| HD | Native photo output | Full photo pipeline with a preferred target resolution and flash support |

HD is the photo capture path, not a promise of a specific pixel count. Actual resolution depends on the device. On iOS, both preferences use the photo path and `effectiveCaptureMode` is always `hd`.

Use `defaultCaptureMode` and `camera.setCaptureMode('fast' | 'hd')` for a built-in preference, or pass `captureMode` from your app's state for controlled mode selection. In controlled mode, update that app state to change the mode; the hook's setter only changes its internal preference. The earlier `androidCaptureMode` option remains a deprecated controlled alias; `captureMode` takes precedence.

- `captureMode`: the selected preference.
- `effectiveCaptureMode`: the mode that will actually capture, accounting for platform and flash.
- `captureMethod`: `preview-snapshot` or `photo`, matching the returned photo's method.
- `canUseFastMode`: true on Android when supported flash is not enabled. This describes mode availability; use `canCapture` for readiness.

Mode changes do not restart the camera or modify an in-flight capture. Enabling flash temporarily selects the HD path; disabling it restores the selected Fast preference. `setCaptureMode` affects the next capture after React renders the update.

## Rapid capture

Shots are queued, never dropped. Hand every photo to `onCapture` so your app saves it the moment its file is written, whether it came from a tap, a burst or a hold:

```tsx
const camera = useCamera({ onCapture: (photo) => void savePhoto(photo) });

// Tap: queue one shot. Tapping faster than the camera can capture queues more.
await camera.capture();

// Burst: a fixed number of shots, optionally spaced by `interval` milliseconds.
const photos = await camera.captureBurst({ count: 5, interval: 200 });

// Hold to shoot: capture until released.
<Pressable onLongPress={() => void camera.captureBurst()} onPressOut={camera.stopBurst} />
```

- `capture()` queues a shot and resolves with it. Shots run one at a time in order, because the native camera captures serially. The next shot starts as soon as the previous file is written, without waiting for your app to process it.
- `maxPendingCaptures` (default `10`) caps queued plus in-flight shots; beyond it `capture()` rejects with `Capture queue is full`. `canCapture` is false while the queue is full.
- Stopping, switching, backgrounding or deactivating the camera cancels shots that have not started. They reject with `Camera stopped`. A shot already in flight still resolves, so its file is never lost.
- `captureBurst({ count?, interval?, signal? })` captures until `count` is reached, `stopBurst()` is called, `signal` aborts, or the camera stops, then resolves with the photos taken. Omit `count` for an unlimited burst. `interval` is the minimum time between the starts of consecutive shots; `stopBurst()` also cuts a pending interval short. Only one burst runs at a time.
- If a shot in a burst fails, `captureBurst` rejects with `CaptureBurstError`. Its `photos` are the shots already taken; they were also passed to `onCapture`, so handle each file in one place.
- `pendingCaptures`, `isCapturing` and `isBursting` describe the queue for your UI. `CapturedPhoto.durationMs` reports each shot's native capture time.
- Fast mode on Android is the quickest path for repeated shots. Mode and flash changes apply from the next shot that starts.

## Behavior and API

- `useCamera(options?)` returns `capture`, `captureBurst`, `stopBurst`, `start`, `stop`, `switchCamera`, permission state, device capabilities (`canSwitchCamera`, `canUseFlash`, `canFocus`), flash controls, `isActive`, `isReady`, `isCapturing`, `canCapture`, `pendingCaptures`, `isBursting`, and the latest camera/capture error.
- `CameraPreview` mounts the native preview with pinch zoom and tap focus where supported. Supply `style` and `children` for your layout and overlays. Mount one preview per hook. Advanced consumers can bind `cameraRef` and `previewProps` to VisionCamera's `Camera` directly.
- Camera access is requested explicitly with `permission.requestPermission()`. If permission cannot be requested again, your app should offer system settings.
- The camera starts when permitted, foregrounded, and `isActive` is true. `start()` and `stop()` control an additional local activation flag; `start()` does not prompt for permission. `isActive` describes requested activation, while `isReady` confirms session readiness.
- Pass navigation focus and review-overlay state through `isActive`; the hook separately pauses when the app backgrounds. A resumed or switched camera must report readiness again before capture.
- `capture()` keeps the preview open for repeated shots; see [Rapid capture](#rapid-capture) for queueing and bursts. Processing captured files (saving, uploading) is up to your app.
- Android `fast` mode (default) saves a JPEG from the preview. The preview uses VisionCamera's `compatible` (TextureView) mode, because snapshots of the default SurfaceView came back black or partly drawn during back-to-back captures on an Android 16 emulator. Resolution is determined by the preview and quality may differ from a full photo. `hd` mode and all iOS captures use the photo output. Flash forces photo output on Android.
- `quality` defaults to `0.9` and must be in `[0, 1]`. `resolution` defaults to `{ width: 2560, height: 1920 }` and is a preferred photo-output resolution, not a guarantee or a snapshot resize.
- `facingMode` sets the initial camera (`environment` by default). Back-camera selection prefers a wide-angle sensor to reduce lens switching during repeated capture. Use `switchCamera()` afterward.
- `CapturedPhoto` contains `{ uri, filePath, method, durationMs }`. Files are temporary: move/save or delete them in your app. Snapshot native resources are disposed after saving, including on save errors. A capture already in flight can still resolve after stop or unmount so callers can retain or remove its file.

Persistence, upload queues, galleries, volume-button capture, image transforms, and application-specific lot/folder workflows are owned by the consuming app. Browser `MediaStream`, `Blob`, and canvas transform APIs are not exposed by this native package.

## Verification

```sh
pnpm --filter @continuous-camera/react-native test
pnpm --filter @continuous-camera/react-native lint
pnpm --filter @continuous-camera/react-native build
```

Automated tests mock the native bridge and cover the capture queue, bursts, cancellation, errors, snapshot cleanup, flash routing, permission gating, screen focus, and app lifecycle. Before releasing, test permission denial/settings recovery, rapid capture, background/resume, flash, zoom/focus, front/back switching, and file persistence on physical Android and iOS devices.
