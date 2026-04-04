import { CameraDemo } from "./components/camera-demo";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Continuous Camera
        </h1>
        <p className="text-neutral-500 mt-2">
          Demo of <code className="text-sm bg-neutral-800 px-1.5 py-0.5 rounded">@continuous-camera/react</code>
        </p>
      </div>
      <CameraDemo />
    </main>
  );
}
