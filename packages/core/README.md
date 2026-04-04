# @continuous-camera/core

Framework-agnostic camera API for the browser. Access device cameras, capture photos, and switch cameras with a simple, event-driven API.

Part of the [continuous-camera](https://github.com/SushilSubedi/continuous-camera) project.

## Installation

```bash
npm install @continuous-camera/core
```

## Usage

```ts
import { createCamera } from '@continuous-camera/core';

const camera = createCamera({
  facingMode: 'environment',
  resolution: { width: 1920, height: 1080 },
});

// Start the camera
const stream = await camera.start();

// Attach to a video element
document.querySelector('video').srcObject = stream;

// Capture a photo
const blob = await camera.capture({ format: 'image/jpeg', quality: 0.9 });

// Listen to events
camera.on('statechange', (state) => console.log('State:', state));

// Switch camera
await camera.switchCamera();

// Stop and clean up
camera.destroy();
```

## API

See the full [API Reference](https://github.com/SushilSubedi/continuous-camera#api-reference).

## License

[MIT](https://github.com/SushilSubedi/continuous-camera/blob/main/LICENSE)
