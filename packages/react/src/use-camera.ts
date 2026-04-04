import { useState, useCallback, useRef, useEffect } from 'react';
import { Camera } from '@continuous-camera/core';
import type { CameraOptions, CameraState, CaptureOptions } from '@continuous-camera/core';

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
  /** Capture a still frame as a Blob */
  capture: (options?: CaptureOptions) => Promise<Blob>;
  /** List available video input devices */
  getDevices: () => Promise<MediaDeviceInfo[]>;
  /** The underlying Camera instance */
  camera: Camera;
}

export function useCamera(options: CameraOptions = {}): UseCameraReturn {
  const cameraRef = useRef<Camera | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Initialize camera once, rebuild if options change via key serialization
  const optionsKey = JSON.stringify(options);

  useEffect(() => {
    const cam = new Camera(options);
    cameraRef.current = cam;

    const unsubState = cam.on('statechange', setState);
    const unsubError = cam.on('error', setError);
    const unsubStart = cam.on('streamstart', setStream);
    const unsubStop = cam.on('streamstop', () => setStream(null));

    return () => {
      unsubState();
      unsubError();
      unsubStart();
      unsubStop();
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

  const capture = useCallback(async (captureOptions?: CaptureOptions) => {
    if (!cameraRef.current) throw new Error('Camera not initialized');
    return cameraRef.current.capture(captureOptions);
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
    capture,
    getDevices,
    camera: cameraRef.current!,
  };
}
