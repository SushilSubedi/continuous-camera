import { CameraDemo } from "./components/camera-demo";
import { MobileShowcase } from "./components/mobile-showcase";

const REPO = "https://github.com/SushilSubedi/continuous-camera";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 pt-12 pb-16 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Continuous Camera</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Take photos from the browser camera as fast as you can press. Shots queue instead of dropping, and a
          burst or a held button keeps shooting until you let go.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href={REPO} className="font-medium text-primary hover:underline">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@continuous-camera/react" className="font-medium text-primary hover:underline">
            @continuous-camera/react
          </a>
          <a href="https://www.npmjs.com/package/@continuous-camera/core" className="font-medium text-primary hover:underline">
            @continuous-camera/core
          </a>
        </div>
      </header>

      <CameraDemo />

      <MobileShowcase />
    </main>
  );
}
