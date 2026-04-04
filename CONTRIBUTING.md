# Contributing to Continuous Camera

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9

### Getting Started

```bash
# Clone the repo
git clone https://github.com/SushilSubedi/continuous-camera.git
cd continuous-camera

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test
```

### Project Structure

```
continuous-camera/
├── packages/
│   ├── core/          # Framework-agnostic camera API
│   └── react/         # React hooks & components
├── examples/
│   └── nextjs-demo/   # Next.js example app
```

## Development Workflow

### Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. Make your changes in the relevant package under `packages/`.

3. Run tests to make sure everything works:
   ```bash
   # Run all tests
   pnpm test

   # Run tests for a specific package
   pnpm --filter @continuous-camera/core test
   pnpm --filter @continuous-camera/react test

   # Watch mode
   pnpm --filter @continuous-camera/core test:watch
   ```

4. Verify the build:
   ```bash
   pnpm build
   ```

5. Check types:
   ```bash
   pnpm lint
   ```

### Running the Example App

```bash
cd examples/nextjs-demo
npm install
npm run dev
```

## Pull Request Guidelines

- Keep PRs small and focused on a single change.
- Include tests for new features or bug fixes.
- Update documentation if your change affects the public API.
- Make sure all tests pass and the build succeeds before submitting.
- Write a clear PR description explaining what changed and why.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add torch/flash control API
fix(react): fix stream cleanup on unmount
docs: update API reference for CaptureOptions
chore: update dev dependencies
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `test` | Adding or updating tests |
| `chore` | Tooling, dependencies, CI changes |
| `refactor` | Code change that doesn't fix a bug or add a feature |

## Reporting Issues

- Use [GitHub Issues](https://github.com/SushilSubedi/continuous-camera/issues) to report bugs or request features.
- Search existing issues before creating a new one.
- Include browser, OS, and version details for bug reports.
- Provide a minimal reproduction if possible.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
