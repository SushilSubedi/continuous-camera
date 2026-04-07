import { CameraDemo } from "./components/camera-demo";

export default function Home() {
  return (
    <main className="flex-1 bg-[radial-gradient(circle_at_top,#1b2438,transparent_32%),linear-gradient(180deg,#06070a_0%,#0d1117_100%)] px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs uppercase tracking-[0.38em] text-blue-200/70">
            Browser camera toolkit
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Continuous Camera
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
            Demo application for <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">@continuous-camera/react</code> showing device selection,
            runtime constraints, preview overlays, and transformed still capture.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.24em] text-white/55">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">select devices</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">apply constraints</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">inspect capabilities</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">capture transforms</span>
        </div>

        <CameraDemo />
      </div>
    </main>
  );
}
