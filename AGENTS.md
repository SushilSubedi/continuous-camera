# Continuous Camera — Agent Instructions

## Project Overview

Continuous Camera is a lightweight, framework-agnostic camera library with first-class React support. It wraps the browser `MediaDevices.getUserMedia()` API and provides a clean interface for starting/stopping cameras, capturing photos, switching devices, and applying constraints.

**Live demo:** https://continuous-camera.pages.dev

## Repository Structure

```
continuous-camera/              # pnpm monorepo (pnpm 9, Node ≥ 18)
├── packages/
│   ├── core/                   # @continuous-camera/core — framework-agnostic API
│   │   └── src/
│   │       ├── camera.ts       # Camera class (start, stop, capture, switchCamera, etc.)
│   │       ├── types.ts        # CameraOptions, CaptureOptions, CameraState, event types
│   │       ├── utils.ts        # Helpers (e.g. canvas-based capture transforms)
│   │       ├── index.ts        # Public exports + createCamera() factory
│   │       └── __tests__/      # Vitest unit tests
│   └── react/                  # @continuous-camera/react — React bindings
│       └── src/
│           ├── use-camera.ts   # useCamera() hook — wraps Camera with React lifecycle
│           ├── camera-preview.tsx  # <CameraPreview /> component
│           ├── index.ts        # Public exports (useCamera, CameraPreview, useCameraPreview)
│           └── __tests__/      # Vitest + @testing-library/react tests
├── examples/
│   └── nextjs-demo/            # Next.js example app with capture gallery
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # Workspace definition
└── tsconfig.base.json          # Shared TypeScript config
```

## Key Architecture Decisions

- **Monorepo with pnpm workspaces** — `core` has zero runtime deps; `react` depends on `core` via `workspace:*`.
- **Dual ESM/CJS output** — Built with `tsup`; each package ships `dist/index.js` (ESM) and `dist/index.cjs` (CJS) with `.d.ts` declarations.
- **SSR-safe** — No browser globals accessed at import time. All `navigator.mediaDevices` usage is deferred to method calls.
- **Event-driven** — `Camera` class uses an internal event emitter (`statechange`, `error`, `streamstart`, `streamstop`, `devicechange`, `trackended`).
- **React 18 & 19** — `react` package declares `peerDependencies: react ^18 || ^19`.

## Common Commands

```bash
pnpm install              # Install all dependencies
pnpm build                # Build all packages (runs tsup in each)
pnpm test                 # Run all tests (vitest run in each package)
pnpm lint                 # Type-check all packages (tsc --noEmit)
pnpm clean                # Remove dist/ in all packages
```

Per-package:
```bash
pnpm --filter @continuous-camera/core test:watch
pnpm --filter @continuous-camera/react build
```

## Conventions

- **TypeScript strict mode** — All code is TypeScript. Follow existing type patterns in `types.ts`.
- **No default exports** — Everything is named exports.
- **Tests** — Co-located in `src/__tests__/` using Vitest. React tests use `@testing-library/react` + `jsdom`.
- **File naming** — Kebab-case (`camera-preview.tsx`, `use-camera.ts`).
- **No side effects** — Both packages declare `"sideEffects": false` for tree-shaking.

## Publishing

Packages are scoped under `@continuous-camera/` and published to npm with `"access": "public"`. Current version: `0.2.0`.

## Important Patterns

- `createCamera(options?)` is the main entry point for `core`. It returns a `Camera` instance.
- `useCamera(options?)` is the main entry point for `react`. It internally creates a `Camera` and cleans up on unmount.
- `CameraPreview` accepts a `stream` prop and optional `mirror`/`children` for overlays.
- Capture supports transforms: `crop`, `resize`, `mirror`, `rotate` — applied via an offscreen canvas in `utils.ts`.
