# @continuous-camera/react

React hooks and components for camera access. Works with Next.js, Astro, Remix, and any React app.

Part of the [continuous-camera](https://github.com/SushilSubedi/continuous-camera) project.

## Installation

```bash
npm install @continuous-camera/react
```

## Usage

```tsx
"use client";

import { useCamera, CameraPreview } from '@continuous-camera/react';

function Camera() {
  const camera = useCamera({ facingMode: 'user' });

  return (
    <div>
      <CameraPreview stream={camera.stream} mirror />

      {!camera.isActive ? (
        <button onClick={() => camera.start()}>Start</button>
      ) : (
        <>
          <button onClick={() => camera.capture()}>Capture</button>
          <button onClick={() => camera.switchCamera()}>Switch</button>
          <button onClick={camera.stop}>Stop</button>
        </>
      )}
    </div>
  );
}
```

## API

### `useCamera(options?)`

Returns `{ state, stream, error, isActive, start, stop, switchCamera, capture, getDevices, camera }`.

### `<CameraPreview stream={stream} mirror? />`

Renders a `<video>` element connected to a MediaStream. Accepts all standard `<video>` props.

See the full [API Reference](https://github.com/SushilSubedi/continuous-camera#api-reference).

## License

[MIT](https://github.com/SushilSubedi/continuous-camera/blob/main/LICENSE)
