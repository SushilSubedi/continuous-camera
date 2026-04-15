# Continuous Camera

[![CI](https://github.com/SushilSubedi/continuous-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/SushilSubedi/continuous-camera/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A lightweight, framework-agnostic camera library with first-class React support. Access device cameras, capture photos, switch cameras — works with Next.js, Astro, Remix, and vanilla JavaScript.

**[🔴 Live Demo](https://continuous-camera.pages.dev)**

## Features

- 📸 **Simple API** — `start()`, `stop()`, `capture()`, `switchCamera()`
- ⚛️ **React hooks** — `useCamera()` with automatic cleanup
- 🌐 **Framework-agnostic** — Works with any JS framework or vanilla JS
- 🔒 **SSR-safe** — No side effects on import, works with Next.js/Astro SSR
- 📦 **Tiny** — Tree-shakeable ESM + CJS, full TypeScript types
- 🎛️ **Flexible** — Custom constraints, facing mode, resolution, capture format

## Packages

| Package | Version | Description |
|---|---|---|
| [`@continuous-camera/core`](./packages/core) | 0.2.0 | Framework-agnostic camera API |
| [`@continuous-camera/react`](./packages/react) | 0.2.0 | React hooks & components |

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
| `capture(options?)` | `Promise<Blob>` | Captures a still frame from the active stream |
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

#### `CameraOptions`

```ts
interface CameraOptions {
  facingMode?: 'user' | 'environment';   // Default: 'user'
  deviceId?: string;                     // Select camera by deviceId
  resolution?: { width: number; height: number }; // Default: 1920×1080
  audio?: boolean;                       // Default: false
  constraints?: MediaStreamConstraints;  // Raw override
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
```

#### Events

| Event | Data | Description |
|---|---|---|
| `statechange` | `CameraState` | Fired when camera state changes |
| `error` | `Error` | Fired when an error occurs |
| `streamstart` | `MediaStream` | Fired when a stream starts |
| `streamstop` | `void` | Fired when a stream stops |
| `devicechange` | `MediaDeviceInfo[]` | Fired when a device is added or removed |
| `trackended` | `void` | Fired when the active video track ends unexpectedly |

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
  getDevices: () => Promise<MediaDeviceInfo[]>;
  camera: Camera; // underlying Camera instance
}
```

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

- **[Next.js Demo](./examples/nextjs-demo)** — Full demo with capture gallery

```bash
cd examples/nextjs-demo
npm install
npm run dev
```

## Roadmap

Near-term improvements focused on production use cases and customer customization:

- ✅ Device selection by `deviceId`, not just front/back switching
- ✅ Runtime camera updates with `applyConstraints()` and richer track controls
- ✅ Access to camera capabilities and active settings for adaptive UIs
- ✅ Richer capture controls such as crop, resize, mirror, and rotate
- ✅ Lower-level preview hooks and overlay-friendly React primitives
- ✅ Better lifecycle events for permission changes, device changes, and track endings

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
