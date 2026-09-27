import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
  type CameraViewProps,
} from 'react-native-vision-camera';
import { capturePhoto, selectCaptureMethod, type CaptureMode, type CapturedPhoto } from './capture';

export interface CameraOptions {
  /** Set false when the screen loses navigation focus or a review overlay opens. */
  isActive?: boolean;
  /** Initial facing mode. Default: environment. */
  facingMode?: 'user' | 'environment';
  /** Controlled capture preference. Fast uses Android snapshots without flash. */
  captureMode?: CaptureMode;
  /** Initial uncontrolled capture preference. Default: fast. */
  defaultCaptureMode?: CaptureMode;
  /** JPEG quality from 0 to 1. Default: 0.9. */
  quality?: number;
  /** Preferred photo resolution; does not affect preview snapshots. */
  resolution?: { width: number; height: number };
  /** Called with every photo from `capture()` and `captureBurst()` as soon as its file is written. */
  onCapture?: (photo: CapturedPhoto) => void;
  /** Maximum queued plus in-flight captures before `capture()` rejects. Default: 10. */
  maxPendingCaptures?: number;
}

export interface CaptureBurstOptions {
  /** Number of photos to take. Default: unlimited until `stopBurst()`, `signal`, or the camera stops. */
  count?: number;
  /** Minimum milliseconds between the start of consecutive shots. Default: 0 (back to back). */
  interval?: number;
  /** Ends the burst after the in-flight shot; the photos taken so far are returned. */
  signal?: AbortSignal;
}

/** Rejection from `captureBurst()` when a shot fails. `photos` still hold temporary files to save or delete. */
export class CaptureBurstError extends Error {
  constructor(readonly photos: CapturedPhoto[], readonly cause: Error) {
    super(cause.message);
    this.name = 'CaptureBurstError';
  }
}

interface Session { ready: boolean }
interface Burst { stopped: boolean; wake?: () => void }

/** Native capture returns temporary files, rather than browser Blobs. */
export function useCamera(options: CameraOptions = {}) {
  const quality = options.quality ?? 0.9;
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
    throw new RangeError('Camera quality must be between 0 and 1');
  }
  const maxPending = options.maxPendingCaptures ?? 10;
  if (!Number.isInteger(maxPending) || maxPending < 1) {
    throw new RangeError('maxPendingCaptures must be a positive integer');
  }
  const permission = useCameraPermission();
  const [position, setPosition] = useState<'front' | 'back'>(
    options.facingMode === 'user' ? 'front' : 'back',
  );
  const back = useCameraDevice('back', { physicalDevices: ['wide-angle'] });
  const front = useCameraDevice('front');
  const device = position === 'back' ? back : front;
  const cameraRef = useRef<CameraRef | null>(null);
  const [requestedActive, setRequestedActive] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [localCaptureMode, setCaptureMode] = useState<CaptureMode>(options.defaultCaptureMode ?? 'fast');
  const captureMode = options.captureMode ?? localCaptureMode;
  const usesFlash = flashEnabled && Boolean(device?.hasFlash);
  const captureMethod = selectCaptureMethod(Platform.OS, captureMode, usesFlash);
  const effectiveCaptureMode: CaptureMode = captureMethod === 'preview-snapshot' ? 'fast' : 'hd';
  const [error, setError] = useState<Error | null>(null);
  const [pendingCaptures, setPendingCaptures] = useState(0);
  const [isBursting, setIsBursting] = useState(false);
  const pending = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const burst = useRef<Burst | null>(null);
  const mounted = useRef(false);
  const active = Boolean((options.isActive ?? true) && requestedActive && foreground && permission.hasPermission && device);
  // A new identity invalidates callbacks from a previous device or activation.
  const session = useMemo<Session>(() => ({ ready: false }), [device, active]);
  const currentSession = useRef(session);
  currentSession.current = session;
  const [readySession, setReadySession] = useState<typeof session | null>(null);
  const isReady = active && readySession === session && session.ready;
  // VisionCamera memoizes output creation by resolution object identity.
  const resolutionWidth = options.resolution?.width ?? 2560;
  const resolutionHeight = options.resolution?.height ?? 1920;
  const targetResolution = useMemo(
    () => ({ width: resolutionWidth, height: resolutionHeight }),
    [resolutionWidth, resolutionHeight],
  );
  const photoOutput = usePhotoOutput({
    containerFormat: 'jpeg',
    quality,
    targetResolution,
    qualityPrioritization: device?.supportsSpeedQualityPrioritization ? 'speed' : 'balanced',
  });
  // A new outputs array would make VisionCamera reconfigure the session on every render.
  const outputs = useMemo(() => [photoOutput], [photoOutput]);
  // Queued shots run after later renders; they read the settings current at their turn.
  const latest = useRef({ photoOutput, captureMode, usesFlash, quality, onCapture: options.onCapture });
  latest.current = { photoOutput, captureMode, usesFlash, quality, onCapture: options.onCapture };

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') currentSession.current.ready = false;
      setForeground(state === 'active');
    });
    // The app may have become active between render and subscribing.
    setForeground(AppState.currentState === 'active');
    return () => {
      mounted.current = false;
      currentSession.current.ready = false;
      subscription.remove();
    };
  }, []);

  function stop() {
    session.ready = false;
    setReadySession(null);
    setRequestedActive(false);
  }

  function isLive(target: Session) {
    return target.ready && currentSession.current === target;
  }

  function switchCamera() {
    if (!front || !back || pending.current > 0 || burst.current) return;
    session.ready = false;
    setReadySession(null);
    setFlashEnabled(false);
    setError(null);
    setPosition((value) => value === 'back' ? 'front' : 'back');
  }

  async function runCapture(target: Session): Promise<CapturedPhoto> {
    // Checked at the shot's turn: a stop, switch, or background while queued cancels it.
    if (!isLive(target) || !cameraRef.current) throw new Error('Camera stopped');
    const settings = latest.current;
    try {
      const photo = await capturePhoto({
        camera: cameraRef.current,
        photoOutput: settings.photoOutput,
        platform: Platform.OS,
        mode: settings.captureMode,
        flash: settings.usesFlash,
        quality: settings.quality,
      });
      if (mounted.current && currentSession.current === target) setError(null);
      try {
        settings.onCapture?.(photo);
      } catch (cause) {
        if (mounted.current) setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
      return photo;
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      if (mounted.current && currentSession.current === target) setError(failure);
      throw failure;
    }
  }

  /** Queues one shot. Shots run in order; queued shots reject if the camera stops first. */
  function capture(): Promise<CapturedPhoto> {
    if (!active || !isLive(session)) return Promise.reject(new Error('Camera is not ready'));
    if (pending.current >= maxPending) return Promise.reject(new Error('Capture queue is full'));
    pending.current += 1;
    setPendingCaptures(pending.current);
    const target = session;
    const shot = queue.current.then(() => runCapture(target));
    queue.current = shot.catch(() => undefined);
    return shot.finally(() => {
      pending.current -= 1;
      if (mounted.current) setPendingCaptures(pending.current);
    });
  }

  /**
   * Captures continuously until `count` is reached, `stopBurst()` or `signal` ends it, or the
   * camera stops, then resolves with every photo taken. Each photo also reaches `onCapture`.
   */
  async function captureBurst(burstOptions: CaptureBurstOptions = {}): Promise<CapturedPhoto[]> {
    const { count = Infinity, interval = 0, signal } = burstOptions;
    if (count !== Infinity && (!Number.isInteger(count) || count < 1)) {
      throw new RangeError('Burst count must be a positive integer');
    }
    if (!Number.isFinite(interval) || interval < 0) {
      throw new RangeError('Burst interval must be a non-negative number');
    }
    if (burst.current) throw new Error('A burst is already running');
    if (!active || !isLive(session)) throw new Error('Camera is not ready');
    const target = session;
    const control: Burst = { stopped: false };
    const end = () => { control.stopped = true; control.wake?.(); };
    burst.current = control;
    setIsBursting(true);
    signal?.addEventListener('abort', end);
    const photos: CapturedPhoto[] = [];
    try {
      while (photos.length < count && !control.stopped && !signal?.aborted && isLive(target)) {
        const started = Date.now();
        try {
          photos.push(await capture());
        } catch (cause) {
          if (!isLive(target) || control.stopped) break;
          throw new CaptureBurstError(photos, cause instanceof Error ? cause : new Error(String(cause)));
        }
        const wait = interval - (Date.now() - started);
        if (wait > 0 && photos.length < count && !control.stopped) {
          await new Promise<void>((resume) => {
            const timer = setTimeout(resume, wait);
            control.wake = () => { clearTimeout(timer); resume(); };
          });
          control.wake = undefined;
        }
      }
      return photos;
    } finally {
      signal?.removeEventListener('abort', end);
      burst.current = null;
      if (mounted.current) setIsBursting(false);
    }
  }

  /** Ends a running burst after its in-flight shot. */
  function stopBurst() {
    const control = burst.current;
    if (!control) return;
    control.stopped = true;
    control.wake?.();
  }

  function markReady() {
    if (!mounted.current || !active || currentSession.current !== session) return;
    session.ready = true;
    setReadySession(session);
    setError(null);
  }
  function markStopped() {
    session.ready = false;
    if (mounted.current && currentSession.current === session) setReadySession(null);
  }

  const previewProps: CameraViewProps | null = device ? {
    device,
    outputs,
    isActive: active,
    resizeMode: 'cover',
    // Android: a TextureView-backed preview. Snapshots of the default SurfaceView can come back
    // black or partly drawn when shots are taken back to back.
    implementationMode: 'compatible',
    enableNativeZoomGesture: true,
    enableNativeTapToFocusGesture: Boolean(device.supportsFocusMetering),
    onStarted: markReady,
    onStopped: markStopped,
    onPreviewStarted: markReady,
    onPreviewStopped: markStopped,
    onError: (cause) => {
      markStopped();
      if (mounted.current && currentSession.current === session) setError(new Error(cause.message));
    },
  } : null;

  const isCapturing = pendingCaptures > 0;
  return {
    cameraRef, previewProps, device, permission, error, isReady, isCapturing, isBursting,
    /** Queued plus in-flight shots. */
    pendingCaptures,
    isActive: active,
    /** True while the session is ready and the capture queue has room; shots may already be pending. */
    canCapture: isReady && pendingCaptures < maxPending,
    canSwitchCamera: Boolean(front && back) && !isCapturing && !isBursting,
    canUseFlash: Boolean(device?.hasFlash),
    canFocus: Boolean(device?.supportsFocusMetering),
    /** Fast capture is available on Android when flash is not in use. */
    canUseFastMode: Platform.OS === 'android' && !usesFlash,
    captureMode, effectiveCaptureMode, captureMethod,
    /** Updates the preference when captureMode is uncontrolled. */
    setCaptureMode,
    flashEnabled, setFlashEnabled, capture, captureBurst, stopBurst, stop, switchCamera,
    /** Permission must be requested explicitly through permission.requestPermission(). */
    start: () => { setError(null); setRequestedActive(true); },
  };
}

export type UseCameraReturn = ReturnType<typeof useCamera>;
