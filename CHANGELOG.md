# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [react-native 0.1.0] - 2026-09-27

### Added

- `@continuous-camera/react-native` 0.1.0: React Native hooks and preview on VisionCamera 5 with the same rapid-capture API (queued `capture()`, `captureBurst()` / `stopBurst()`, `onCapture`), Android Fast (preview snapshot) and HD (photo) modes, plus the `examples/expo-demo` camera app

## [0.3.0] - 2026-09-27

### Added

- `@continuous-camera/core` — rapid capture
  - `capture()` queues overlapping shots and runs them in order, up to `maxPendingCaptures` (default 10)
  - `captureBurst({ count, interval, signal, ...captureOptions })` and `stopBurst()` for bursts and hold-to-shoot
  - `capture` event with each photo and its `durationMs`; `capturechange` event for queue and burst state
  - `pendingCaptures`, `isBursting` and `maxPendingCaptures` properties; `CaptureBurstError`

- `@continuous-camera/react` — rapid capture
  - `useCamera` returns `captureBurst`, `stopBurst`, `pendingCaptures`, `isCapturing`, `isBursting` and `canCapture`
  - `onCapture` option receives every photo; an inline callback does not restart the camera
  - Re-exports `CaptureBurstError`, `CaptureBurstOptions` and `CapturedPhoto`
- Next.js demo: Burst 5, hold-to-shoot, queued-shot count, and per-photo capture time

### Changed

- `capture()` calls that overlap now run one at a time in order instead of concurrently
- `stop()`, `switchCamera()`, `selectDevice()` and `destroy()` reject shots that have not started with `Camera stopped`
- `useCamera` methods keep a stable identity across renders and camera rebuilds, and a rebuilt camera resets `state`, `stream` and `error`

### Fixed

- The video-element capture fallback (browsers without `ImageCapture`) reuses one element per stream instead of creating one per shot, and rejects instead of hanging when playback fails, `stop()` interrupts the load, or loading takes over 5 seconds. A paused element is replayed before drawing

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
