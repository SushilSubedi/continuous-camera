# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `@continuous-camera/core` 0.3.0 — rapid capture
  - `capture()` queues overlapping shots and runs them in order, up to `maxPendingCaptures` (default 10)
  - `captureBurst({ count, interval, signal, ...captureOptions })` and `stopBurst()` for bursts and hold-to-shoot
  - `capture` event with each photo and its `durationMs`; `capturechange` event for queue and burst state
  - `pendingCaptures` and `isBursting` properties; `CaptureBurstError`

### Changed

- `stop()`, `switchCamera()`, `selectDevice()` and `destroy()` reject shots that have not started with `Camera stopped`

### Fixed

- The video-element capture fallback (browsers without `ImageCapture`) reuses one element per stream instead of creating one per shot, and rejects instead of hanging when playback fails

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
