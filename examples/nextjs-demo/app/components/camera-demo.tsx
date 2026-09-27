"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useCamera, CameraPreview, type CapturedPhoto } from "@continuous-camera/react";

const TRACK_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "Full HD", width: 1920, height: 1080 },
] as const;

/** Hold-to-shoot can produce hundreds of frames; older ones are released beyond this. */
const MAX_GALLERY = 48;

interface GalleryPhoto {
  url: string;
  durationMs: number;
}

function getCenteredSquareCrop(settings: MediaTrackSettings | null) {
  if (!settings?.width || !settings.height) {
    return undefined;
  }

  const size = Math.min(settings.width, settings.height);
  return {
    x: Math.floor((settings.width - size) / 2),
    y: Math.floor((settings.height - size) / 2),
    width: size,
    height: size,
  };
}

function formatRange(range?: MediaSettingsRange) {
  if (!range || typeof range.min !== "number" || typeof range.max !== "number") {
    return null;
  }

  return `${Math.round(range.min)}-${Math.round(range.max)}`;
}

export function CameraDemo() {
  const [captures, setCaptures] = useState<GalleryPhoto[]>([]);
  const capturesRef = useRef<GalleryPhoto[]>([]);

  // Every shot (tap, burst or hold) lands here as soon as it is encoded.
  // useCamera reads onCapture through a ref, so a plain function is fine here.
  function addPhoto({ blob, durationMs }: CapturedPhoto) {
    const next = [{ url: URL.createObjectURL(blob), durationMs }, ...capturesRef.current];
    next.splice(MAX_GALLERY).forEach((photo) => URL.revokeObjectURL(photo.url));
    capturesRef.current = next;
    setCaptures(next);
  }

  const {
    camera,
    capture,
    captureBurst,
    stopBurst,
    pendingCaptures,
    isBursting,
    canCapture,
    error,
    getCapabilities,
    getDevices,
    getSettings,
    isActive,
    selectDevice,
    start,
    state,
    stop,
    stream,
    switchCamera,
    applyConstraints,
  } = useCamera({ facingMode: "user", onCapture: addPhoto });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [mirror, setMirror] = useState(false);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [captureMode, setCaptureMode] = useState<"full" | "square">("full");
  const [settings, setSettings] = useState<MediaTrackSettings | null>(null);
  const [capabilities, setCapabilities] = useState<MediaTrackCapabilities | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);

  // useCamera's methods are stable, so effects can depend on them directly.
  function refreshTrackInfo() {
    setSettings(getSettings());
    setCapabilities(getCapabilities());
  }

  useEffect(() => {
    return () => {
      capturesRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveCameraInfo() {
      if (!isActive) {
        setDevices([]);
        setSelectedDeviceId("");
        setCapabilities(null);
        setSettings(null);
        return;
      }

      const nextDevices = await getDevices();
      if (cancelled) {
        return;
      }

      setDevices(nextDevices);
      const nextSettings = getSettings();
      setSelectedDeviceId(nextSettings?.deviceId ?? nextDevices[0]?.deviceId ?? "");
      setSettings(nextSettings);
      setCapabilities(getCapabilities());
    }

    loadActiveCameraInfo().catch(() => {
      if (!cancelled) {
        setNotice("Unable to load camera details.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [getCapabilities, getDevices, getSettings, isActive]);

  useEffect(() => {
    if (!camera) {
      return;
    }

    const unsubscribeDeviceChange = camera.on("devicechange", (nextDevices) => {
      setDevices(nextDevices);
      setSelectedDeviceId(getSettings()?.deviceId ?? nextDevices[0]?.deviceId ?? "");
      setNotice("Camera list updated.");
    });

    const unsubscribeTrackEnded = camera.on("trackended", () => {
      setSettings(getSettings());
      setCapabilities(getCapabilities());
      setNotice("The active camera stream ended.");
    });

    return () => {
      unsubscribeDeviceChange();
      unsubscribeTrackEnded();
    };
  }, [camera, getCapabilities, getSettings]);

  async function handleStart() {
    setNotice(null);
    await start();
    refreshTrackInfo();
  }

  function handleStop() {
    stop();
    setNotice(null);
  }

  function clearCaptures() {
    capturesRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    capturesRef.current = [];
    setCaptures([]);
  }

  async function applyTrackPreset(width: number, height: number, label: string) {
    try {
      await applyConstraints({
        width: { ideal: width },
        height: { ideal: height },
      });
      refreshTrackInfo();
      setNotice(`Applied ${label} track preference.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to apply constraints.");
    }
  }

  async function handleSwitchCamera() {
    setNotice(null);
    await switchCamera();
    refreshTrackInfo();
  }

  async function handleDeviceChange(event: ChangeEvent<HTMLSelectElement>) {
    const deviceId = event.target.value;
    if (!deviceId) {
      return;
    }

    await selectDevice(deviceId);
    setSelectedDeviceId(deviceId);
    refreshTrackInfo();
    setNotice("Switched to the selected camera.");
  }

  const captureOptions = {
    format: "image/jpeg" as const,
    quality: 0.9,
    crop: captureMode === "square" ? getCenteredSquareCrop(settings) : undefined,
    resize: captureMode === "square" ? { width: 1080, height: 1080 } : undefined,
    mirror: mirror || undefined,
    rotate: rotate || undefined,
  };

  function reportCaptureError(err: unknown) {
    console.error("Capture failed:", err);
    setNotice(err instanceof Error ? err.message : "Capture failed.");
  }

  // Tapping faster than frames encode queues shots rather than dropping them.
  function handleCapture() {
    capture(captureOptions).catch(reportCaptureError);
  }

  function handleBurst(count?: number) {
    captureBurst({ ...captureOptions, count })
      .then((photos) => setNotice(`Burst captured ${photos.length} photo${photos.length === 1 ? "" : "s"}.`))
      .catch(reportCaptureError);
  }

  // The Hold button only stops a burst it started, so it can't cut a running "Burst 5" short.
  function startHold() {
    if (isBursting) return;
    setHolding(true);
    handleBurst();
  }

  function endHold() {
    if (!holding) return;
    setHolding(false);
    stopBurst();
  }

  function cycleRotation() {
    setRotate((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270));
  }

  const previewMirror = settings?.facingMode !== "environment";
  const widthRange = formatRange(capabilities?.width as MediaSettingsRange | undefined);
  const heightRange = formatRange(capabilities?.height as MediaSettingsRange | undefined);
  const frameRateRange = formatRange(
    capabilities?.frameRate as MediaSettingsRange | undefined,
  );

  const selectedDeviceLabel = devices.find(
    (device) => device.deviceId === selectedDeviceId,
  )?.label;

  const statusLine = [
    selectedDeviceLabel || (isActive ? "Default camera" : null),
    settings?.width && settings.height ? `${settings.width}×${settings.height}` : null,
    pendingCaptures > 1 ? `${pendingCaptures} photos queued` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      <section className={card}>
        <div className="relative aspect-video bg-neutral-900">
          {isActive ? (
            <CameraPreview stream={stream} mirror={previewMirror} className="h-full w-full">
              {captureMode === "square" ? (
                <div className="pointer-events-none flex h-full items-center justify-center">
                  <div className="aspect-square h-full border-x border-white/60" />
                </div>
              ) : null}
            </CameraPreview>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              {state === "starting" ? "Starting camera…" : "Camera is off"}
            </div>
          )}
          {holding && isBursting ? (
            <span className="absolute top-3 left-3 rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
              Shooting
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 p-4">
          {!isActive ? (
            <button onClick={() => void handleStart()} disabled={state === "starting"} className={button.primary}>
              Start camera
            </button>
          ) : (
            <>
              <button onClick={handleCapture} disabled={!canCapture} className={button.primary}>
                Take photo
              </button>
              <button onClick={() => handleBurst(5)} disabled={isBursting || !canCapture} className={button.outline}>
                Burst of 5
              </button>
              <button
                onPointerDown={(event) => {
                  // Keeps pointerup on this button even if the pointer drifts off it.
                  event.currentTarget.setPointerCapture(event.pointerId);
                  startHold();
                }}
                onPointerUp={endHold}
                onPointerCancel={endHold}
                onLostPointerCapture={endHold}
                onKeyDown={(event) => {
                  if ((event.key === " " || event.key === "Enter") && !event.repeat) startHold();
                }}
                onKeyUp={endHold}
                onBlur={endHold}
                // Stays enabled while held so the release always reaches endHold.
                disabled={!holding && (isBursting || !canCapture)}
                aria-pressed={holding && isBursting}
                className={`${button.outline} touch-none select-none aria-pressed:border-primary aria-pressed:text-primary`}
              >
                {holding && isBursting ? "Release to stop" : "Hold to shoot"}
              </button>
              <div className="ml-auto flex gap-2">
                <button onClick={() => void handleSwitchCamera()} className={button.ghost}>
                  Switch camera
                </button>
                <button onClick={handleStop} className={button.ghost}>
                  Stop
                </button>
              </div>
            </>
          )}
        </div>

        <p aria-live="polite" className="min-h-5 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {statusLine || "Allow camera access when your browser asks."}
        </p>
      </section>

      {notice || error ? (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-lg border bg-card px-4 py-3 text-sm ${error ? "border-destructive/30 text-destructive" : "border-border text-foreground"}`}
        >
          {error ? error.message : notice}
        </div>
      ) : null}

      <section className={card}>
        <div className="px-5 py-5 sm:px-6">
          <h2 className="text-base font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Changes apply to the live stream and the next photo.</p>
        </div>

        <div className="divide-y divide-border border-t border-border">
          {isActive && devices.length > 1 ? (
            <Row label="Camera">
              <select value={selectedDeviceId} onChange={handleDeviceChange} className={input}>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </Row>
          ) : null}

          <Row label="Resolution" hint="Applied without restarting the stream.">
            <div className="flex gap-2">
              {TRACK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => void applyTrackPreset(preset.width, preset.height, preset.label)}
                  disabled={!isActive}
                  className={button.outline}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Photo output" hint={captureMode === "square" ? "Centre crop, resized to 1080×1080." : undefined}>
            <div className="flex flex-wrap gap-2">
              <Toggle pressed={captureMode === "square"} onClick={() => setCaptureMode((current) => (current === "full" ? "square" : "full"))}>
                Square
              </Toggle>
              <Toggle pressed={mirror} onClick={() => setMirror((current) => !current)}>
                Mirror
              </Toggle>
              <Toggle pressed={rotate !== 0} onClick={cycleRotation}>
                Rotate {rotate}°
              </Toggle>
            </div>
          </Row>

          <Row label="Track">
            {settings ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <Detail term="Frame rate" value={settings.frameRate ? `${Math.round(settings.frameRate)} fps` : "Unknown"} />
                <Detail term="Facing" value={settings.facingMode ?? "Unknown"} />
                <Detail term="Width range" value={widthRange ?? "Unknown"} />
                <Detail term="Height range" value={heightRange ?? "Unknown"} />
                <Detail term="Frame rate range" value={frameRateRange ?? "Unknown"} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Start the camera to see track details.</p>
            )}
          </Row>
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">Photos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {captures.length ? `${captures.length} in this session, newest first.` : "Photos you take appear here."}
            </p>
          </div>
          {captures.length ? (
            <button onClick={clearCaptures} className={button.ghost}>
              Clear photos
            </button>
          ) : null}
        </div>

        {captures.length ? (
          <ul className="grid grid-cols-2 gap-4 border-t border-border p-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-4">
            {captures.map((photo, index) => (
              <li key={photo.url} className="space-y-1.5">
                <img src={photo.url} alt={`Photo ${captures.length - index}`} className="aspect-square w-full rounded-md object-cover" />
                <p className="text-xs text-muted-foreground">Taken in {photo.durationMs} ms</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

const card = "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 shadow-xs";

const input =
  "h-9 w-full max-w-sm rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const buttonBase =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

const button = {
  primary: `${buttonBase} bg-primary text-primary-foreground hover:bg-primary/85`,
  outline: `${buttonBase} border-border bg-card shadow-xs hover:bg-muted`,
  ghost: `${buttonBase} text-muted-foreground hover:bg-muted hover:text-foreground`,
};

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6 sm:px-6">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      className={`${buttonBase} border-border shadow-xs ${pressed ? "border-primary/40 bg-primary/10 text-primary" : "bg-card hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}
