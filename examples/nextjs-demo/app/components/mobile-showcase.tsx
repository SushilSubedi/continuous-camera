const REPO = "https://github.com/SushilSubedi/continuous-camera";

const SCREENS = [
  { src: "/mobile/ready.jpg", alt: "Camera ready with the last shot's capture time", caption: "Tap to shoot" },
  { src: "/mobile/burst.jpg", alt: "Burst in progress, two of five shots taken", caption: "Burst and hold-to-shoot" },
  { src: "/mobile/gallery.jpg", alt: "Gallery of captured photos", caption: "Every shot kept" },
] as const;

const FEATURES = [
  "Queued shots: tap faster than the camera and nothing is dropped",
  "captureBurst() for fixed bursts, or hold the shutter until release",
  "Android Fast mode grabs the preview; HD uses the photo pipeline",
  "Stops cleanly on background, camera switch, or screen change",
];

const SNIPPET = `const camera = useCamera({ onCapture: savePhoto });

<CameraPreview camera={camera} />
<Pressable
  onPress={() => camera.capture()}
  onLongPress={() => camera.captureBurst()}
  onPressOut={camera.stopBurst}
/>`;

export function MobileShowcase() {
  return (
    <section className="grid grid-cols-1 gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:p-8">
      <div className="min-w-0 space-y-5">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.32em] text-blue-200/70">Also on mobile</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">The same rapid capture, in React Native</h2>
          <p className="text-sm leading-6 text-white/65">
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px]">@continuous-camera/react-native</code> brings the queue and
            burst API to Android and iOS on VisionCamera 5. The example app shoots like a system camera.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-white/70">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex gap-3">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300/80" />
              {feature}
            </li>
          ))}
        </ul>

        <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-[12.5px] leading-5 text-white/80">
          <code>{SNIPPET}</code>
        </pre>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`${REPO}/tree/main/examples/expo-demo`}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            Run the Expo example
          </a>
          <a
            href={`${REPO}/tree/main/packages/react-native`}
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Package docs
          </a>
          <span className="text-xs text-white/40">Preview release · not yet on npm</span>
        </div>
      </div>

      <div className="-mx-2 flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {SCREENS.map((screen) => (
          <figure key={screen.src} className="w-[58%] shrink-0 snap-center space-y-3 sm:w-auto">
            <div className="overflow-hidden rounded-[1.75rem] border-[5px] border-neutral-800 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
              {/* Plain img: static screenshots, no optimisation pipeline needed. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screen.src} alt={screen.alt} width={480} height={1040} loading="lazy" className="block h-auto w-full" />
            </div>
            <figcaption className="text-center text-xs text-white/55">{screen.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
