import { useState, useCallback, useRef, useEffect } from 'react';
import { Camera } from '@continuous-camera/core';
import type {
  CameraOptions,
  CameraState,
  CaptureBurstOptions,
  CapturedPhoto,
  CaptureOptions,
} from '@continuous-camera/core';

export interface UseCameraOptions extends CameraOptions {
  /** Called with every photo from `capture()` and `captureBurst()` as soon as it is encoded */
  onCapture?: (photo: CapturedPhoto) => void;
}

export interface UseCameraReturn {
  /** Current camera state */
  state: CameraState;
  /** Active MediaStream (null when idle) */
  stream: MediaStream | null;
  /** Last error encountered */
  error: Error | null;
  /** Whether the camera is currently active */
  isActive: boolean;
  /** Start the camera */
  start: () => Promise<MediaStream>;
  /** Stop the camera */
  stop: () => void;
  /** Switch between front/back cameras */
  switchCamera: () => Promise<MediaStream>;
  /** Select a specific camera by deviceId */
  selectDevice: (deviceId: string) => Promise<MediaStream>;
  /** Apply constraints to the active video track without restarting */
  applyConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
  /** Get capabilities of the active video track */
  getCapabilities: () => MediaTrackCapabilities | null;
  /** Get current settings of the active video track */
  getSettings: () => MediaTrackSettings | null;
  /** Queue a shot of the active stream; shots run one at a time in order */
  capture: (options?: CaptureOptions) => Promise<Blob>;
  /** Capture repeatedly until `count`, `stopBurst()`, `signal`, or the camera stops */
  captureBurst: (options?: CaptureBurstOptions) => Promise<Blob[]>;
  /** End a running burst after its in-flight shot */
  stopBurst: () => void;
  /** Queued plus in-flight shots */
  pendingCaptures: number;
  /** Whether any shot is queued or in flight */
  isCapturing: boolean;
  /** Whether a burst is running */
  isBursting: boolean;
  /** Whether the camera is active and the capture queue has room */
  canCapture: boolean;
  /** List available video input devices */
  getDevices: () => Promise<MediaDeviceInfo[]>;
  /** The underlying Camera instance */
  camera: Camera;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { onCapture, ...cameraOptions } = options;
  const cameraRef = useRef<Camera | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pendingCaptures, setPendingCaptures] = useState(0);
  const [isBursting, setIsBursting] = useState(false);

  // An inline onCapture must not rebuild the camera, so it is read through a ref.
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;

  // Initialize camera once, rebuild if options change via key serialization
  const optionsKey = JSON.stringify(cameraOptions);

  useEffect(() => {
    const cam = new Camera(cameraOptions);
    cameraRef.current = cam;
    setPendingCaptures(0);
    setIsBursting(false);

    const unsubState = cam.on('statechange', setState);
    const unsubError = cam.on('error', setError);
    const unsubStart = cam.on('streamstart', setStream);
    const unsubStop = cam.on('streamstop', () => setStream(null));
    const unsubCapture = cam.on('capture', (photo) => onCaptureRef.current?.(photo));
    const unsubCaptureChange = cam.on('capturechange', ({ pending, bursting }) => {
      setPendingCaptures(pending);
      setIsBursting(bursting);
    });

    return () => {
      unsubState();
      unsubError();
      unsubStart();
      unsubStop();
      unsubCapture();
      unsubCaptureChange();
      cam.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  const start = useCallback(async () => {
    if (!cameraRef.current) throw new Error('Camera not initialized');
    return cameraRef.current.start();
  }, []);

  const stop = useCallback(() => {
    cameraRef.current?.stop();
  }, []);

  const switchCamera = useCallback(async () => {
    if (!cameraRef.current) throw new Error('Camera not initialized');
    return cameraRef.current.switchCamera();
  }, []);

  const selectDevice = useCallback(async (deviceId: string) => {
    if (!cameraRef.current) throw new Error('Camera not initialized');
    return cameraRef.current.selectDevice(deviceId);
  }, []);

  const applyConstraints = useCallback(async (constraints: MediaTrackConstraints) => {
    if (!cameraRef.current) throw new Error('Camera not initialized');
    return cameraRef.current.applyConstraints(constraints);
  }, []);

  const getCapabilities = useCallback(() => {
    return cameraRef.current?.getCapabilities() ?? null;
  }, []);

  const getSettings = useCallback(() => {
    return cameraRef.current?.getSettings() ?? null;
  }, []);

  const capture = useCallback(async (captureOptions?: CaptureOptions) => {
    if (!cameraRef.current) throw new Error('Camera not initialized');
    return cameraRef.current.capture(captureOptions);
  }, []);

  const captureBurst = useCallback(async (burstOptions?: CaptureBurstOptions) => {
    if (!cameraRef.current) throw new Error('Camera not initialized');
    return cameraRef.current.captureBurst(burstOptions);
  }, []);

  const stopBurst = useCallback(() => {
    cameraRef.current?.stopBurst();
  }, []);

  const getDevices = useCallback(async () => {
    if (!cameraRef.current) return [];
    return cameraRef.current.getDevices();
  }, []);

  return {
    state,
    stream,
    error,
    isActive: state === 'active',
    start,
    stop,
    switchCamera,
    selectDevice,
    applyConstraints,
    getCapabilities,
    getSettings,
    capture,
    captureBurst,
    stopBurst,
    pendingCaptures,
    isCapturing: pendingCaptures > 0,
    isBursting,
    canCapture: state === 'active' && pendingCaptures < (cameraOptions.maxPendingCaptures ?? 10),
    getDevices,
    camera: cameraRef.current!,
  };
}
