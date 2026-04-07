"use client";

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useCamera, CameraPreview } from "@continuous-camera/react";

const TRACK_PRESETS = [
  { label: "HD", width: 1280, height: 720 },
  { label: "Full HD", width: 1920, height: 1080 },
] as const;

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
  const {
    camera,
    capture,
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
  } = useCamera({ facingMode: "user" });
  const [captures, setCaptures] = useState<string[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const capturesRef = useRef<string[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [mirror, setMirror] = useState(false);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [captureMode, setCaptureMode] = useState<"full" | "square">("full");
  const [settings, setSettings] = useState<MediaTrackSettings | null>(null);
  const [capabilities, setCapabilities] = useState<MediaTrackCapabilities | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshTrackInfo = useCallback(() => {
    setSettings(getSettings());
    setCapabilities(getCapabilities());
  }, [getCapabilities, getSettings]);

  const syncDevices = useCallback(
    async (nextDevices?: MediaDeviceInfo[]) => {
      const resolvedDevices = nextDevices ?? (await getDevices());
      const activeDeviceId = getSettings()?.deviceId;

      setDevices(resolvedDevices);
      setSelectedDeviceId(activeDeviceId ?? resolvedDevices[0]?.deviceId ?? "");
    },
    [getDevices, getSettings],
  );

  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  useEffect(() => {
    return () => {
      capturesRef.current.forEach((url) => URL.revokeObjectURL(url));
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
      void syncDevices(nextDevices);
      setNotice("Camera list updated.");
    });

    const unsubscribeTrackEnded = camera.on("trackended", () => {
      refreshTrackInfo();
      setNotice("The active camera stream ended.");
    });

    return () => {
      unsubscribeDeviceChange();
      unsubscribeTrackEnded();
    };
  }, [camera, refreshTrackInfo, syncDevices]);

  const handleStart = useCallback(async () => {
    setNotice(null);
    await start();
    refreshTrackInfo();
  }, [refreshTrackInfo, start]);

  const handleStop = useCallback(() => {
    stop();
    setNotice(null);
  }, [stop]);

  const clearCaptures = useCallback(() => {
    capturesRef.current.forEach((url) => URL.revokeObjectURL(url));
    capturesRef.current = [];
    setCaptures([]);
  }, []);

  const applyTrackPreset = useCallback(
    async (width: number, height: number, label: string) => {
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
    },
    [applyConstraints, refreshTrackInfo],
  );

  const handleSwitchCamera = useCallback(async () => {
    setNotice(null);
    await switchCamera();
    refreshTrackInfo();
  }, [refreshTrackInfo, switchCamera]);

  const handleDeviceChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      const deviceId = event.target.value;
      if (!deviceId) {
        return;
      }

      await selectDevice(deviceId);
      setSelectedDeviceId(deviceId);
      refreshTrackInfo();
      setNotice("Switched to the selected camera.");
    },
    [refreshTrackInfo, selectDevice],
  );

  const handleCapture = useCallback(async () => {
    const crop = captureMode === "square" ? getCenteredSquareCrop(settings) : undefined;

    try {
      const blob = await capture({
        format: "image/jpeg",
        quality: 0.9,
        crop,
        resize:
          captureMode === "square"
            ? {
                width: 1080,
                height: 1080,
              }
            : undefined,
        mirror: mirror || undefined,
        rotate: rotate || undefined,
      });
      const url = URL.createObjectURL(blob);
      setCaptures((prev) => [url, ...prev]);
    } catch (err) {
      console.error("Capture failed:", err);
      setNotice(err instanceof Error ? err.message : "Capture failed.");
    }
  }, [capture, captureMode, mirror, rotate, settings]);

  const cycleRotation = useCallback(() => {
    setRotate((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270));
  }, []);

  const previewMirror = settings?.facingMode !== "environment";
  const widthRange = formatRange(capabilities?.width as MediaSettingsRange | undefined);
  const heightRange = formatRange(capabilities?.height as MediaSettingsRange | undefined);
  const frameRateRange = formatRange(
    capabilities?.frameRate as MediaSettingsRange | undefined,
  );

  const selectedDeviceLabel = devices.find(
    (device) => device.deviceId === selectedDeviceId,
  )?.label;

  const captureSummary = [
    captureMode === "square" ? "square crop" : "full frame",
    mirror ? "mirrored file" : null,
    rotate ? `${rotate}deg rotation` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]">
      <section className="space-y-4 rounded-[2rem] border border-white/10 bg-black/45 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="relative aspect-video overflow-hidden rounded-[1.5rem] border border-white/10 bg-neutral-950">
          {isActive ? (
            <CameraPreview stream={stream} mirror={previewMirror} className="h-full w-full">
              <div className="flex h-full flex-col justify-between bg-gradient-to-b from-black/45 via-transparent to-black/55 p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/75">
                      Live preview
                    </span>
                    <p className="max-w-xs text-sm text-white/70">
                      Device selection, overlay support, runtime constraints, and transformed still capture.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-200"
                        : state === "error"
                          ? "bg-red-500/20 text-red-200"
                          : "bg-white/10 text-white/65"
                    }`}
                  >
                    {state}
                  </span>
                </div>

                <div className="mx-auto flex h-full max-h-72 w-full items-center justify-center px-6 py-4">
                  <div
                    className={`w-full max-w-sm rounded-[2rem] border border-white/40 transition-all ${
                      captureMode === "square"
                        ? "aspect-square shadow-[0_0_0_999px_rgba(0,0,0,0.2)]"
                        : "aspect-[4/3] border-dashed"
                    }`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/70">
                  <span>{selectedDeviceLabel || "Default camera"}</span>
                  <span>{captureSummary || "full frame"}</span>
                </div>
              </div>
            </CameraPreview>
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#1f2937,transparent_55%)] text-neutral-500">
              {state === "starting" ? (
                <p>Starting camera...</p>
              ) : (
                <p>Camera is off</p>
              )}
            </div>
          )}
        </div>

        {notice ? (
          <p className="rounded-2xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-sm text-blue-100">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Error: {error.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {!isActive ? (
            <button
              onClick={() => void handleStart()}
              disabled={state === "starting"}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start camera
            </button>
          ) : (
            <>
              <button
                onClick={() => void handleCapture()}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
              >
                Capture still
              </button>
              <button
                onClick={() => void handleSwitchCamera()}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Switch facing mode
              </button>
              <button
                onClick={handleStop}
                className="rounded-full border border-red-500/25 bg-red-500/12 px-5 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/18"
              >
                Stop stream
              </button>
            </>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.32em] text-white/45">Controls</p>
          <h2 className="text-xl font-semibold text-white">Tune the live track and output</h2>
        </div>

        {isActive && devices.length > 1 ? (
          <label className="space-y-2 text-sm text-white/70">
            <span className="block">Camera device</span>
            <select
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="text-sm font-medium text-white">Track presets</p>
          <p className="text-xs text-white/45">Apply constraints without restarting the stream.</p>

          <div className="flex flex-wrap gap-2">
            {TRACK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => void applyTrackPreset(preset.width, preset.height, preset.label)}
                disabled={!isActive}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="text-sm font-medium text-white">Capture transforms</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMirror((current) => !current)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                mirror
                  ? "bg-blue-500 text-white"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Mirror file {mirror ? "on" : "off"}
            </button>
            <button
              onClick={cycleRotation}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                rotate
                  ? "bg-blue-500 text-white"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Rotate {rotate} deg
            </button>
            <button
              onClick={() => setCaptureMode((current) => (current === "full" ? "square" : "full"))}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                captureMode === "square"
                  ? "bg-blue-500 text-white"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {captureMode === "square" ? "Square output" : "Full frame"}
            </button>
          </div>
          <p className="text-xs text-white/45">
            Square output uses center crop plus 1080x1080 resize.
          </p>
        </div>

        <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="text-sm font-medium text-white">Active track</p>
          {settings ? (
            <div className="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                Resolution {settings.width && settings.height ? `${settings.width}x${settings.height}` : "unknown"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                Frame rate {settings.frameRate ? `${Math.round(settings.frameRate)} fps` : "unknown"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                Facing {settings.facingMode ?? "unknown"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                Device {selectedDeviceLabel || "default selection"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/45">Start the stream to inspect settings and capabilities.</p>
          )}

          {capabilities ? (
            <div className="grid gap-2 text-xs text-white/55 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                Width range {widthRange ?? "n/a"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                Height range {heightRange ?? "n/a"}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                FPS range {frameRateRange ?? "n/a"}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {captures.length > 0 ? (
        <section className="space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-white/45">Captured frames</p>
              <h2 className="text-xl font-semibold text-white">Recent stills</h2>
            </div>
            <button
              onClick={clearCaptures}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
            >
              Clear gallery
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {captures.map((url, index) => (
              <figure key={url} className="space-y-2 rounded-[1.5rem] border border-white/10 bg-black/25 p-3">
                <img
                  src={url}
                  alt={`Capture ${index + 1}`}
                  className="aspect-square w-full rounded-[1.25rem] object-cover"
                />
                <figcaption className="text-xs text-white/55">Capture {index + 1}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
