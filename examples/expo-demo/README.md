# Continuous Camera — Expo demo

A standalone Android/iOS camera app using `@continuous-camera/react-native`. It has its own app identifier (`com.continuouscamera.demo`) and requires no account or backend.

## Run on a physical device

From the repository root (Node 20.19.4+ and pnpm 9):

```sh
pnpm install
pnpm --filter @continuous-camera/react-native build

# Choose your device; builds and installs a separate development app.
pnpm --filter continuous-camera-expo-demo android
# Or, with Xcode and iPhone signing configured:
pnpm --filter continuous-camera-expo-demo ios
```

After the initial native installation:

```sh
pnpm --filter continuous-camera-expo-demo start
```

Metro uses port **8084**, so it can run alongside another app on the default port. Connect the demo development client to the server on the same Wi-Fi. Android USB users can run `adb reverse tcp:8084 tcp:8084` and connect to `http://localhost:8084`.

**Expo Go cannot run this app.** VisionCamera and Nitro require a native development build. Camera hardware behavior must be tested on real devices. You may need to choose your own iOS signing team in Xcode; no team or credentials are included.

## Try it

The app is laid out like a system camera: a full-bleed viewfinder, controls along the top, and the shutter at the bottom.

- **Shutter:** tap for one shot, or tap quickly to queue several. Hold to shoot continuously until you release; a red counter shows the shots taken.
- **PHOTO / BURST ×5:** in BURST mode, one tap takes five back-to-back shots.
- **FAST / HD badge (top):** Android Fast saves a preview snapshot; HD uses the photo pipeline. Flash temporarily forces HD. iPhone always uses the photo pipeline.
- **Flash / Pause (top):** device-aware flash, and a pause to exercise the camera lifecycle. Backgrounding the app also pauses the camera.
- **Flip:** switch between front and back cameras.
- **Pinch / tap:** native zoom and focus, where supported.
- **Thumbnail:** opens the gallery. Tap a photo to review it with its mode, capture time, size and file size, or Clear to delete this session's photos. The camera pauses while the gallery is open.

Photos are saved through `onCapture` while the next shot is already capturing, so saving never slows the shutter.

Capture times are the time spent in the library's capture call. This is a diagnostic sample, not a performance benchmark. HD describes the photo pipeline, not a guaranteed resolution.

Photos stay in the app's cache (`continuous-camera-demo/`), are never uploaded, and are not added to the camera roll. The gallery resets on reload; earlier files may remain in the OS-managed cache. Clear before reloading to remove current session photos.

## How it is organized

- `src/app.tsx`: the camera screen: `useCamera`, `CameraPreview`, shutter, modes and controls.
- `src/theme.ts`: shared colours.
- `src/use-captures.ts`: app-owned `onCapture` handler: file copying, image inspection, and gallery state.
- `src/photo-gallery.tsx`: gallery grid and photo review.
- `app.json`: camera permission and separate Android/iOS identifiers.

The workspace dependency uses the local library directly, so library edits are visible in Metro. To use this example in another repository, replace `workspace:*` with the published version, for example `^0.1.0`.

Expo's [monorepo support](https://docs.expo.dev/guides/monorepos/) supplies Metro configuration. SDK 54's autolinking module resolution is enabled to keep JavaScript and native module resolution aligned. Camera permission setup follows [VisionCamera's installation guide](https://visioncamera.margelo.com/docs).

## Checks

```sh
pnpm --filter continuous-camera-expo-demo lint
pnpm --filter continuous-camera-expo-demo export:native
pnpm --filter @continuous-camera/react-native test
```

Bundle export validates JavaScript compilation for both platforms. It does not validate native compilation, signing, or camera hardware.

Before release, test permission denial/settings recovery, Fast/HD with and without flash, tap-queued, burst and hold-to-shoot capture, front/back switching, focus/zoom, photo review, background/resume during capture, and capture in airplane mode. Record device model/OS, mode, dimensions, latency, and any errors. Physical-device results are currently pending.
