import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCamera } from '../use-camera';

function setupCapture() {
  const grabFrame = vi.fn(() => Promise.resolve({ width: 640, height: 480, close: vi.fn() }));
  let encoded = 0;
  vi.stubGlobal('ImageCapture', class { grabFrame = grabFrame; });
  vi.stubGlobal('OffscreenCanvas', class {
    getContext = () => ({ save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn(), drawImage: vi.fn() });
    convertToBlob = () => Promise.resolve(new Blob([`photo-${encoded++}`]));
  });
  function hold() {
    let release!: () => void;
    grabFrame.mockImplementationOnce(() => new Promise((done) => {
      release = () => done({ width: 640, height: 480, close: vi.fn() });
    }));
    return () => release();
  }
  return { grabFrame, hold };
}

function createMockTrack(): MediaStreamTrack {
  return {
    kind: 'video',
    stop: vi.fn(),
    enabled: true,
    id: 'mock-track',
    label: 'Mock Camera',
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    getCapabilities: vi.fn().mockReturnValue({}),
    getSettings: vi.fn().mockReturnValue({}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function createMockStream(): MediaStream {
  const tracks = [createMockTrack()];
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
    getAudioTracks: () => [],
    id: 'mock-stream',
    active: true,
  } as unknown as MediaStream;
}

function setupMediaDevices() {
  const mockStream = createMockStream();
  const getUserMedia = vi.fn().mockResolvedValue(mockStream);
  const enumerateDevices = vi.fn().mockResolvedValue([
    { kind: 'videoinput', deviceId: 'cam-1', label: 'Camera' },
  ]);

  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia, enumerateDevices, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    writable: true,
    configurable: true,
  });

  return { mockStream, getUserMedia, enumerateDevices };
}

describe('useCamera', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.state).toBe('idle');
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isActive).toBe(false);
  });

  it('starts camera and provides stream', async () => {
    const { mockStream } = setupMediaDevices();
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.state).toBe('active');
    expect(result.current.stream).toBe(mockStream);
    expect(result.current.isActive).toBe(true);
  });

  it('stops camera and clears stream', async () => {
    setupMediaDevices();
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.stream).toBeNull();
  });

  it('selectDevice switches to a specific camera', async () => {
    const { getUserMedia } = setupMediaDevices();
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.selectDevice('cam-2');
    });

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          deviceId: { exact: 'cam-2' },
        }),
      }),
    );
  });

  it('exposes getCapabilities and getSettings', async () => {
    setupMediaDevices();
    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    const capabilities = result.current.getCapabilities();
    const settings = result.current.getSettings();

    expect(capabilities).toEqual({});
    expect(settings).toEqual({});
  });

  it('cleans up on unmount', async () => {
    const { mockStream } = setupMediaDevices();
    const { result, unmount } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.start();
    });

    unmount();

    mockStream.getTracks().forEach((track) => {
      expect(track.stop).toHaveBeenCalled();
    });
  });

  it('tracks queued shots and delivers each photo to onCapture', async () => {
    setupMediaDevices();
    const { hold } = setupCapture();
    const onCapture = vi.fn();
    const { result } = renderHook(() => useCamera({ onCapture }));
    await act(async () => { await result.current.start(); });
    expect(result.current.canCapture).toBe(true);

    const release = hold();
    let shots!: Promise<Blob[]>;
    await act(async () => {
      shots = Promise.all([result.current.capture(), result.current.capture()]);
    });
    expect(result.current.pendingCaptures).toBe(2);
    expect(result.current.isCapturing).toBe(true);

    await act(async () => {
      release();
      await shots;
    });
    expect(result.current.pendingCaptures).toBe(0);
    expect(result.current.isCapturing).toBe(false);
    expect(onCapture).toHaveBeenCalledTimes(2);
    expect(await onCapture.mock.calls[0][0].blob.text()).toBe('photo-0');
  });

  it('uses the latest onCapture without rebuilding the camera', async () => {
    const { getUserMedia } = setupMediaDevices();
    setupCapture();
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onCapture }) => useCamera({ onCapture }), {
      initialProps: { onCapture: first },
    });
    await act(async () => { await result.current.start(); });
    rerender({ onCapture: second });
    await act(async () => { await result.current.capture(); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(result.current.isActive).toBe(true);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('runs a burst and reports isBursting until stopBurst', async () => {
    setupMediaDevices();
    setupCapture();
    const onCapture = vi.fn();
    const { result } = renderHook(() => useCamera({ onCapture }));
    await act(async () => { await result.current.start(); });

    await act(async () => {
      expect(await result.current.captureBurst({ count: 3 })).toHaveLength(3);
    });
    expect(onCapture).toHaveBeenCalledTimes(3);

    onCapture.mockImplementation(() => {
      if (onCapture.mock.calls.length === 5) result.current.stopBurst();
    });
    let burst!: Promise<Blob[]>;
    act(() => { burst = result.current.captureBurst(); });
    expect(result.current.isBursting).toBe(true);
    await act(async () => { await burst; });
    expect(await burst).toHaveLength(2);
    expect(result.current.isBursting).toBe(false);
  });

  it('disallows capture while inactive or when the queue is full', async () => {
    setupMediaDevices();
    const { hold } = setupCapture();
    const { result } = renderHook(() => useCamera({ maxPendingCaptures: 1 }));
    expect(result.current.canCapture).toBe(false);
    await act(async () => { await result.current.start(); });
    hold();
    await act(async () => { void result.current.capture(); });
    expect(result.current.canCapture).toBe(false);
  });

  it('keeps method identities stable across renders and camera rebuilds', async () => {
    setupMediaDevices();
    const { result, rerender } = renderHook(({ facingMode }) => useCamera({ facingMode }), {
      initialProps: { facingMode: 'user' as 'user' | 'environment' },
    });
    const { capture, captureBurst, stopBurst, start } = result.current;
    rerender({ facingMode: 'environment' });
    expect(result.current.capture).toBe(capture);
    expect(result.current.captureBurst).toBe(captureBurst);
    expect(result.current.stopBurst).toBe(stopBurst);
    expect(result.current.start).toBe(start);
  });

  it('resets state when changed options rebuild the camera', async () => {
    setupMediaDevices();
    const { result, rerender } = renderHook(({ facingMode }) => useCamera({ facingMode }), {
      initialProps: { facingMode: 'user' as 'user' | 'environment' },
    });
    await act(async () => { await result.current.start(); });
    expect(result.current.canCapture).toBe(true);

    rerender({ facingMode: 'environment' });
    expect(result.current.state).toBe('idle');
    expect(result.current.stream).toBeNull();
    expect(result.current.isActive).toBe(false);
    expect(result.current.canCapture).toBe(false);
  });
});
