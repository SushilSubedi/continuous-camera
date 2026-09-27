const REPO = "https://github.com/SushilSubedi/continuous-camera";

const SCREENS = [
  { src: "/mobile/ready.jpg", alt: "Camera ready, showing the last photo's capture time", caption: "Tap to take a photo" },
  { src: "/mobile/burst.jpg", alt: "Burst in progress, two of five photos taken", caption: "Burst or hold to shoot" },
  { src: "/mobile/gallery.jpg", alt: "Grid of photos taken in the session", caption: "Every photo kept" },
] as const;

const SNIPPET = `const camera = useCamera({ onCapture: savePhoto });

<CameraPreview camera={camera} />
<Pressable
  onPress={() => camera.capture().catch(report)}
  onLongPress={() => camera.captureBurst().catch(report)}
  onPressOut={camera.stopBurst}
/>`;

export function MobileShowcase() {
  return (
    <section className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-xs">
      <div className="grid gap-8 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">React Native</h2>
            <p className="text-sm text-muted-foreground">
              The same queue and burst API on Android and iOS, built on VisionCamera 5. On Android, Fast mode grabs the
              preview for quicker shots.
            </p>
          </div>

          <pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-xs leading-5">
            <code>{SNIPPET}</code>
          </pre>

          <div className="space-y-2 text-sm">
            <code className="block w-fit rounded-md bg-muted px-2 py-1 font-mono text-xs">npm i @continuous-camera/react-native</code>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <a href={`${REPO}/tree/main/examples/expo-demo`} className="font-medium text-primary hover:underline">
                Example app
              </a>
              <a href={`${REPO}/tree/main/packages/react-native`} className="font-medium text-primary hover:underline">
                Package docs
              </a>
            </div>
          </div>
        </div>

        <div className="-mx-1 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          {SCREENS.map((screen) => (
            <figure key={screen.src} className="w-[55%] shrink-0 snap-center space-y-2 sm:w-auto">
              {/* Plain img: static screenshots, no optimisation pipeline needed. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screen.src}
                alt={screen.alt}
                width={480}
                height={1040}
                loading="lazy"
                className="block h-auto w-full rounded-lg ring-1 ring-foreground/10"
              />
              <figcaption className="text-xs text-muted-foreground">{screen.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
