# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-04-04

### Added

- `@continuous-camera/core` — Framework-agnostic camera API
  - `Camera` class with `start()`, `stop()`, `capture()`, `switchCamera()`, `getDevices()`
  - Event system (`statechange`, `error`, `streamstart`, `streamstop`)
  - `createCamera()` convenience factory
  - SSR-safe (no side effects on import)
  - Dual ESM/CJS output with full TypeScript declarations
- `@continuous-camera/react` — React bindings
  - `useCamera()` hook with automatic cleanup
  - `<CameraPreview />` component with mirror support
  - React 18 & 19 support
- Next.js example app (`examples/nextjs-demo`)
