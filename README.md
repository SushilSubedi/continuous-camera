# Continuous Camera

[![npm](https://img.shields.io/npm/v/@continuous-camera/core)](https://www.npmjs.com/package/@continuous-camera/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A lightweight, framework-agnostic camera library with first-class React support. Access device cameras, capture photos, switch cameras — works with Next.js, Astro, Remix, and vanilla JavaScript.

**[🔴 Live Demo](https://continuous-camera.pages.dev)**

## Features

- 📸 **Simple API** — `start()`, `stop()`, `capture()`, `switchCamera()`
- ⚡ **Rapid capture** — Queued shots, bursts, and hold-to-shoot with `captureBurst()`
- ⚛️ **React hooks** — `useCamera()` with automatic cleanup
- 🌐 **Framework-agnostic** — Works with any JS framework or vanilla JS
- 🔒 **SSR-safe** — No side effects on import, works with Next.js/Astro SSR
- 📦 **Tiny** — Tree-shakeable ESM + CJS, full TypeScript types
- 🎛️ **Flexible** — Custom constraints, facing mode, resolution, capture format

## Packages

| Package | Version | Description |
|---|---|---|
| [`@continuous-camera/core`](./packages/core) | 0.3.0 | Framework-agnostic camera API |
| [`@continuous-camera/react`](./packages/react) | 0.3.0 | React hooks & components |
| [`@continuous-camera/react-native`](./packages/react-native) | Unreleased | Native camera hooks & preview using VisionCamera 5 |

React Native support is available as an initial workspace package. See the [native setup and usage guide](./packages/react-native/README.md) for integration; the browser packages remain independent.

## Installation

```bash
# React (includes core as a dependency)
npm install @continuous-camera/react

# Vanilla JS only
npm install @continuous-camera/core
```

## Quick Start

### React / Next.js / Astro

```tsx
"use client"; // for Next.js App Router

import { useCamera, CameraPreview } from '@continuous-camera/react';

function CameraPage() {
  const camera = useCamera({ facingMode: 'environment' });

  const handleCapture = async () => {
    const blob = await camera.capture({ format: 'image/jpeg', quality: 0.9 });
    // Do something with the captured image blob
    const url = URL.createObjectURL(blob);
    console.log('Captured:', url);
  };

  return (
    <div>
      <CameraPreview stream={camera.stream} mirror />

      {!camera.isActive ? (
        <button onClick={() => camera.start()}>Start Camera</button>
      ) : (
        <>
          <button onClick={handleCapture}>Capture</button>
          <button onClick={() => camera.switchCamera()}>Switch</button>
          <button onClick={camera.stop}>Stop</button>
        </>
      )}

      {camera.error && <p>Error: {camera.error.message}</p>}
    </div>
  );
}
```

### Vanilla JavaScript

```ts
import { createCamera } from '@continuous-camera/core';

const camera = createCamera({
  facingMode: 'environment',
  resolution: { width: 1920, height: 1080 },
});

// Start the camera
const stream = await camera.start();

// Attach to a video element
const video = document.querySelector('video');
video.srcObject = stream;

// Capture a photo
const blob = await camera.capture({ format: 'image/jpeg', quality: 0.9 });

// Listen to events
camera.on('statechange', (state) => console.log('State:', state));
camera.on('error', (err) => console.error('Error:', err));

// Stop when done
camera.stop();

// Clean up
camera.destroy();
```

## API Reference

### `@continuous-camera/core`

#### `createCamera(options?): Camera`

Factory function that creates a new `Camera` instance.

#### `Camera`

| Method | Returns | Description |
|---|---|---|
| `start()` | `Promise<MediaStream>` | Requests camera access and starts the stream |
| `stop()` | `void` | Stops all tracks and releases the camera |
| `capture(options?)` | `Promise<Blob>` | Queues a shot of the active stream and resolves with its Blob |
| `captureBurst(options?)` | `Promise<Blob[]>` | Captures repeatedly until `count`, `stopBurst()`, `signal`, or `stop()` |
| `stopBurst()` | `void` | Ends a running burst after its in-flight shot |
| `switchCamera()` | `Promise<MediaStream>` | Toggles between front and back cameras |
| `selectDevice(deviceId)` | `Promise<MediaStream>` | Switches to a specific camera by deviceId |
| `applyConstraints(constraints)` | `Promise<void>` | Applies constraints to the active track without restarting |
| `getCapabilities()` | `MediaTrackCapabilities \| null` | Returns capabilities of the active video track |
| `getSettings()` | `MediaTrackSettings \| null` | Returns current settings of the active video track |
| `getDevices()` | `Promise<MediaDeviceInfo[]>` | Lists available video input devices |
| `on(event, handler)` | `() => void` | Subscribes to events, returns unsubscribe fn |
| `off(event, handler)` | `void` | Unsubscribes from events |
| `destroy()` | `void` | Stops stream and clears all listeners |

| Property | Type | Description |
|---|---|---|
| `state` | `CameraState` | `'idle' \| 'starting' \| 'active' \| 'error'` |
| `stream` | `MediaStream \| null` | The active media stream |
| `error` | `Error \| null` | The last error encountered |
| `isActive` | `boolean` | Whether the camera is currently streaming |
| `pendingCaptures` | `number` | Queued plus in-flight shots |
| `isBursting` | `boolean` | Whether a burst is running |
| `maxPendingCaptures` | `number` | The queue limit in effect |

#### `CameraOptions`

```ts
interface CameraOptions {
  facingMode?: 'user' | 'environment';   // Default: 'user'
  deviceId?: string;                     // Select camera by deviceId
  resolution?: { width: number; height: number }; // Default: 1920×1080
  audio?: boolean;                       // Default: false
  constraints?: MediaStreamConstraints;  // Raw override
  maxPendingCaptures?: number;           // Default: 10
}
```

#### `CaptureOptions`

```ts
interface CaptureOptions {
  format?: 'image/jpeg' | 'image/png' | 'image/webp'; // Default: 'image/jpeg'
  quality?: number;   // 0–1, Default: 0.92
  crop?: { x: number; y: number; width: number; height: number };
  resize?: { width: number; height: number };
  mirror?: boolean;   // Default: false
  rotate?: 0 | 90 | 180 | 270; // Default: 0
}

interface CaptureBurstOptions extends CaptureOptions {
  count?: number;       // Default: unlimited
  interval?: number;    // Minimum ms between shot starts. Default: 0
  signal?: AbortSignal; // Ends the burst
}
```

#### Rapid capture

```ts
camera.on('capture', ({ blob, durationMs }) => save(blob));

await camera.capture();                                // Tap: queue one shot
await camera.captureBurst({ count: 5, interval: 200 }); // Burst

// Hold to shoot until release. Pointer capture keeps the release on the button,
// and cancel/lost-capture cover gestures the browser takes over.
button.addEventListener('pointerdown', (event) => {
  button.setPointerCapture(event.pointerId);
  camera.captureBurst().catch(console.error);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  button.addEventListener(type, () => camera.stopBurst());
}
```

- Shots run one at a time in order. Calling `capture()` while a shot is running queues the next one instead of overlapping it. Beyond `maxPendingCaptures`, `capture()` rejects with `Capture queue is full`.
- `stop()`, `switchCamera()`, `selectDevice()` and `destroy()` cancel shots that have not started; they reject with `Camera stopped`. A shot already in flight is not cancelled; it resolves or rejects depending on whether the browser finished reading the frame.
- `stopBurst()` ends the burst after its in-flight shot and frees it at once, so the next `captureBurst()` can start immediately.
- `captureBurst()` resolves with every photo taken. If a shot fails, it rejects with `CaptureBurstError`, whose `photos` holds the shots already taken. Every photo is also emitted as `capture`, so handle each one in a single place.
- Without the `ImageCapture` API (Safari, Firefox), frames are drawn from one reused video element, so repeated shots skip reloading the stream.

#### Events

| Event | Data | Description |
|---|---|---|
| `statechange` | `CameraState` | Fired when camera state changes |
| `error` | `Error` | Fired when an error occurs |
| `streamstart` | `MediaStream` | Fired when a stream starts |
| `streamstop` | `void` | Fired when a stream stops |
| `devicechange` | `MediaDeviceInfo[]` | Fired when a device is added or removed |
| `trackended` | `void` | Fired when the active video track ends unexpectedly |
| `capture` | `{ blob: Blob; durationMs: number }` | Fired with every photo as soon as it is encoded |
| `capturechange` | `{ pending: number; bursting: boolean }` | Fired when pending shots or burst state change |

### `@continuous-camera/react`

#### `useCamera(options?): UseCameraReturn`

React hook that manages camera lifecycle with automatic cleanup on unmount.

```ts
interface UseCameraReturn {
  state: CameraState;
  stream: MediaStream | null;
  error: Error | null;
  isActive: boolean;
  start: () => Promise<MediaStream>;
  stop: () => void;
  switchCamera: () => Promise<MediaStream>;
  selectDevice: (deviceId: string) => Promise<MediaStream>;
  applyConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
  getCapabilities: () => MediaTrackCapabilities | null;
  getSettings: () => MediaTrackSettings | null;
  capture: (options?: CaptureOptions) => Promise<Blob>;
  captureBurst: (options?: CaptureBurstOptions) => Promise<Blob[]>;
  stopBurst: () => void;
  pendingCaptures: number; // queued plus in-flight shots
  isCapturing: boolean;
  isBursting: boolean;
  canCapture: boolean;     // active and the capture queue has room
  getDevices: () => Promise<MediaDeviceInfo[]>;
  camera: Camera; // underlying Camera instance
}
```

`useCamera` accepts all `CameraOptions` plus `onCapture: (photo: CapturedPhoto) => void`, called with every photo from `capture()` and `captureBurst()`. An inline `onCapture` does not restart the camera.

#### `<CameraPreview />`

Renders a `<video>` element connected to a `MediaStream`. Supports overlay content via `children`.

```tsx
interface CameraPreviewProps extends VideoHTMLAttributes {
  stream: MediaStream | null;
  mirror?: boolean;    // Default: false — mirrors video horizontally
  children?: ReactNode; // Overlay content rendered on top of the video
}
```

#### `useCameraPreview(stream)`

Lower-level hook that binds a `MediaStream` to a `<video>` ref. Use this when you need full control over the video element.

```tsx
const videoRef = useCameraPreview(camera.stream);
return <video ref={videoRef} autoPlay playsInline muted />;
```

## Browser Support

Requires browsers with [MediaDevices.getUserMedia()](https://caniuse.com/stream) support:

- Chrome 53+
- Firefox 36+
- Safari 11+
- Edge 12+

## Examples

See the [`examples/`](./examples) directory:

- **[Next.js Demo](./examples/nextjs-demo)** — Full demo with capture gallery, bursts, and hold-to-shoot
- **[Expo Demo](./examples/expo-demo)** — Android/iOS camera app with tap, burst and hold-to-shoot, Fast/HD modes and a local gallery

```bash
cd examples/nextjs-demo
npm install
npm run dev
```

## Development

```bash
# Prerequisites: Node.js >= 18, pnpm >= 9

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Watch mode for a specific package
pnpm --filter @continuous-camera/core test:watch
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

## License

[MIT](./LICENSE) © [Sushil Subedi](https://github.com/SushilSubedi)
