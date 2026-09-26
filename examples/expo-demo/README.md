# Continuous Camera — Expo demo

A standalone Android/iOS camera app using `@continuous-camera/react-native`. It has its own app identifier (`com.continuouscamera.demo`), requires no account or backend, and does not depend on ListEngine.

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

Metro uses port **8084**, separate from the ListEngine test worktree. Connect the demo development client to the server on the same Wi-Fi. Android USB users can run `adb reverse tcp:8084 tcp:8084` and connect to `http://localhost:8084`.

**Expo Go cannot run this app.** VisionCamera and Nitro require a native development build. Camera hardware behavior must be tested on real devices. You may need to choose your own iOS signing team in Xcode; no team or credentials are included.

## Try it

- **Fast / HD:** Android Fast saves a preview snapshot; HD uses the photo pipeline. Flash temporarily forces HD. iOS uses the photo pipeline for either preference.
- **Capture:** Tap for one shot; tap quickly to queue several. Hold to shoot continuously until you release.
- **Burst 5:** Five back-to-back shots. Photos are saved through `onCapture` while the next shot is already capturing, so saving never slows the shutter.
- **Flash / Flip:** Device-aware flash and front/back switching.
- **Pinch / tap:** Native zoom and focus, where supported.
- **Pause / Resume:** Exercise screen lifecycle; backgrounding the app also pauses the camera.
- **Local gallery:** Tap a thumbnail to inspect the photo. Reviewing pauses the camera, and closing review resumes it.
- **Clear:** Delete this session's saved photos.

The status reports dimensions, file size, and time spent in the library's capture call. This is a diagnostic sample, not a performance benchmark. HD describes the photo pipeline, not a guaranteed resolution.

Photos stay in the app's cache (`continuous-camera-demo/`), are never uploaded, and are not added to the camera roll. The gallery resets on reload; earlier files may remain in the OS-managed cache. Clear before reloading to remove current session photos.

## How it is organized

- `src/app.tsx`: minimal example of `useCamera` and `CameraPreview` with controls.
- `src/use-captures.ts`: app-owned `onCapture` handler: file copying, image inspection, and gallery state.
- `src/photo-gallery.tsx`: thumbnail strip and photo review.
- `app.json`: camera permission and separate Android/iOS identifiers.

The workspace dependency uses the local library directly, so library edits are visible in Metro. To move this example into another repository before npm publication, build and pack `packages/react-native`, replace `workspace:*` with a `file:` tarball dependency, and install it there. Once published, use the released package version.

Expo's [monorepo support](https://docs.expo.dev/guides/monorepos/) supplies Metro configuration. SDK 54's autolinking module resolution is enabled to keep JavaScript and native module resolution aligned. Camera permission setup follows [VisionCamera's installation guide](https://visioncamera.margelo.com/docs).

## Checks

```sh
pnpm --filter continuous-camera-expo-demo lint
pnpm --filter continuous-camera-expo-demo export:native
pnpm --filter @continuous-camera/react-native test
```

Bundle export validates JavaScript compilation for both platforms. It does not validate native compilation, signing, or camera hardware.

Before release, test permission denial/settings recovery, Fast/HD with and without flash, tap-queued, burst and hold-to-shoot capture, front/back switching, focus/zoom, photo review, background/resume during capture, and capture in airplane mode. Record device model/OS, mode, dimensions, latency, and any errors. Physical-device results are currently pending.
