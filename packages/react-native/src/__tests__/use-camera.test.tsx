import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: 'android',
  back: { id: 'back', hasFlash: true, supportsFocusMetering: true },
  front: { id: 'front', hasFlash: false },
  hasPermission: true,
  capture: vi.fn(),
  outputOptions: vi.fn(),
  snapshot: vi.fn(),
  remove: vi.fn(),
  stateListener: null as null | ((state: string) => void),
}));
vi.mock('react-native', () => ({
  Platform: { get OS() { return native.platform; } },
  AppState: {
    currentState: 'active',
    addEventListener: (_: string, listener: (state: string) => void) => {
      native.stateListener = listener;
      return { remove: native.remove };
    },
  },
}));
vi.mock('react-native-vision-camera', () => ({
  useCameraDevice: (position: string) => position === 'back' ? native.back : native.front,
  useCameraPermission: () => ({ hasPermission: native.hasPermission, requestPermission: vi.fn() }),
  usePhotoOutput: (options: unknown) => {
    native.outputOptions(options);
    return { capturePhotoToFile: native.capture };
  },
}));
import { CaptureBurstError, useCamera } from '../use-camera';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function ready(result: { current: ReturnType<typeof useCamera> }) {
  result.current.cameraRef.current = { takeSnapshot: native.snapshot } as never;
  act(() => result.current.previewProps?.onStarted?.());
}

beforeEach(() => {
  vi.clearAllMocks();
  native.hasPermission = true;
  native.platform = 'android';
  native.capture.mockResolvedValue({ filePath: '/tmp/photo.jpg' });
  native.snapshot.mockResolvedValue({
    saveToTemporaryFileAsync: vi.fn().mockResolvedValue('/tmp/snapshot.jpg'),
    dispose: vi.fn(),
  });
});

describe('useCamera', () => {
  it('keeps output resolution stable across controls and equivalent inline options', () => {
    const { result, rerender } = renderHook(
      ({ width }) => useCamera({ resolution: { width, height: 1920 } }),
      { initialProps: { width: 2560 } },
    );
    const initial = native.outputOptions.mock.lastCall![0].targetResolution;
    act(() => result.current.setFlashEnabled(true));
    act(() => result.current.setCaptureMode('hd'));
    rerender({ width: 2560 });
    expect(native.outputOptions.mock.lastCall![0].targetResolution).toBe(initial);
    rerender({ width: 1280 });
    expect(native.outputOptions.mock.lastCall![0].targetResolution).not.toBe(initial);
    expect(native.outputOptions.mock.lastCall![0].targetResolution.width).toBe(1280);
  });

  it('uses the TextureView-backed preview so Android snapshots are never blank', () => {
    const { result } = renderHook(() => useCamera());
    expect(result.current.previewProps?.implementationMode).toBe('compatible');
  });

  it('requires session readiness and permission', async () => {
    native.hasPermission = false;
    const { result } = renderHook(() => useCamera());
    ready(result);
    expect(result.current.canCapture).toBe(false);
    await expect(result.current.capture()).rejects.toThrow('not ready');
  });

  it('queues overlapping captures and runs them one at a time, in order', async () => {
    const releases: Array<() => void> = [];
    native.capture.mockImplementation(() => new Promise((done) => {
      const index = releases.length;
      releases.push(() => done({ filePath: `/tmp/${index}.jpg` }));
    }));
    const onCapture = vi.fn();
    const { result } = renderHook(() => useCamera({ captureMode: 'hd', onCapture }));
    ready(result);
    let shots!: Promise<Array<{ uri: string }>>;
    await act(async () => {
      shots = Promise.all([result.current.capture(), result.current.capture(), result.current.capture()]);
      await flush();
    });
    expect(native.capture).toHaveBeenCalledTimes(1);
    expect(result.current.pendingCaptures).toBe(3);
    expect(result.current.isCapturing).toBe(true);
    expect(result.current.canCapture).toBe(true);
    for (let index = 0; index < 3; index++) {
      await act(async () => { releases[index]!(); await flush(); });
    }
    const photos = await shots;
    expect(photos.map((photo) => photo.uri)).toEqual(['file:///tmp/0.jpg', 'file:///tmp/1.jpg', 'file:///tmp/2.jpg']);
    expect(onCapture).toHaveBeenCalledTimes(3);
    expect(onCapture.mock.calls[0]![0]).toMatchObject({ uri: 'file:///tmp/0.jpg', method: 'photo' });
    expect(onCapture.mock.calls[0]![0].durationMs).toBeGreaterThanOrEqual(0);
    expect(result.current.pendingCaptures).toBe(0);
  });

  it('rejects captures beyond maxPendingCaptures', async () => {
    native.capture.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useCamera({ captureMode: 'hd', maxPendingCaptures: 2 }));
    ready(result);
    await act(async () => {
      void result.current.capture();
      void result.current.capture();
      await expect(result.current.capture()).rejects.toThrow('queue is full');
    });
    expect(result.current.canCapture).toBe(false);
  });

  it('cancels queued shots when the camera stops but lets the in-flight shot finish', async () => {
    let release!: () => void;
    native.capture.mockImplementationOnce(() => new Promise((done) => { release = () => done({ filePath: '/tmp/a.jpg' }); }));
    const { result } = renderHook(() => useCamera({ captureMode: 'hd' }));
    ready(result);
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = result.current.capture();
      second = result.current.capture().catch((error: Error) => error);
      await flush();
    });
    act(() => result.current.stop());
    await act(async () => { release(); await flush(); });
    await expect(first).resolves.toMatchObject({ uri: 'file:///tmp/a.jpg' });
    expect(await second).toMatchObject({ message: 'Camera stopped' });
    expect(native.capture).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.pendingCaptures).toBe(0);
  });

  it('blocks switching cameras while a burst is running, even between shots', async () => {
    const { result } = renderHook(() => useCamera({ captureMode: 'hd' }));
    ready(result);
    let burst!: Promise<unknown[]>;
    act(() => { burst = result.current.captureBurst({ count: 2, interval: 60_000 }); });
    await act(async () => { await flush(); });
    expect(result.current.pendingCaptures).toBe(0);
    expect(result.current.canSwitchCamera).toBe(false);
    act(() => result.current.switchCamera());
    expect(result.current.device?.id).toBe('back');
    act(() => result.current.stopBurst());
    await act(async () => { await burst; });
    expect(result.current.canSwitchCamera).toBe(true);
  });

  describe('captureBurst', () => {
    it('takes count photos and delivers each to onCapture', async () => {
      const onCapture = vi.fn();
      const { result } = renderHook(() => useCamera({ captureMode: 'hd', onCapture }));
      ready(result);
      let photos!: unknown[];
      await act(async () => { photos = await result.current.captureBurst({ count: 4 }); });
      expect(photos).toHaveLength(4);
      expect(onCapture).toHaveBeenCalledTimes(4);
      expect(result.current.isBursting).toBe(false);
    });

    it('runs until stopBurst when unbounded', async () => {
      const onCapture = vi.fn();
      const { result } = renderHook(() => useCamera({ captureMode: 'hd', onCapture }));
      ready(result);
      onCapture.mockImplementation(() => { if (onCapture.mock.calls.length === 3) result.current.stopBurst(); });
      let burst!: Promise<unknown[]>;
      act(() => { burst = result.current.captureBurst(); });
      expect(result.current.isBursting).toBe(true);
      await expect(result.current.captureBurst()).rejects.toThrow('already running');
      await act(async () => { await burst; });
      expect(await burst).toHaveLength(3);
      expect(result.current.isBursting).toBe(false);
    });

    it('ends on abort signal and when the camera stops, returning photos so far', async () => {
      const controller = new AbortController();
      const onCapture = vi.fn(() => { if (onCapture.mock.calls.length === 2) controller.abort(); });
      const { result } = renderHook(() => useCamera({ captureMode: 'hd', onCapture }));
      ready(result);
      await act(async () => {
        expect(await result.current.captureBurst({ signal: controller.signal })).toHaveLength(2);
      });
      onCapture.mockImplementation(() => { if (onCapture.mock.calls.length === 3) result.current.stop(); });
      await act(async () => {
        expect(await result.current.captureBurst({ count: 10 })).toHaveLength(1);
      });
    });

    it('rejects with the photos already taken when a shot fails', async () => {
      native.capture
        .mockResolvedValueOnce({ filePath: '/tmp/1.jpg' })
        .mockResolvedValueOnce({ filePath: '/tmp/2.jpg' })
        .mockRejectedValueOnce(new Error('Disk full'));
      const { result } = renderHook(() => useCamera({ captureMode: 'hd' }));
      ready(result);
      let failure: unknown;
      await act(async () => { await result.current.captureBurst({ count: 5 }).catch((error) => { failure = error; }); });
      expect(failure).toBeInstanceOf(CaptureBurstError);
      expect((failure as CaptureBurstError).message).toBe('Disk full');
      expect((failure as CaptureBurstError).photos.map((photo) => photo.filePath)).toEqual(['/tmp/1.jpg', '/tmp/2.jpg']);
      expect(result.current.error?.message).toBe('Disk full');
    });

    it('spaces shots by interval and wakes early on stopBurst', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
      try {
        const { result } = renderHook(() => useCamera({ captureMode: 'hd' }));
        ready(result);
        let burst!: Promise<unknown[]>;
        await act(async () => { burst = result.current.captureBurst({ count: 3, interval: 500 }); await vi.advanceTimersByTimeAsync(0); });
        expect(native.capture).toHaveBeenCalledTimes(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(499); });
        expect(native.capture).toHaveBeenCalledTimes(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(native.capture).toHaveBeenCalledTimes(2);
        await act(async () => { result.current.stopBurst(); await burst; });
        expect(await burst).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('validates options and readiness', async () => {
      const { result } = renderHook(() => useCamera());
      await expect(result.current.captureBurst()).rejects.toThrow('not ready');
      ready(result);
      await expect(result.current.captureBurst({ count: 0 })).rejects.toThrow(RangeError);
      await expect(result.current.captureBurst({ interval: -1 })).rejects.toThrow(RangeError);
    });
  });

  it('uses snapshots on Android and photo output when flash is enabled', async () => {
    const { result } = renderHook(() => useCamera());
    ready(result);
    await act(async () => {
      expect((await result.current.capture()).method).toBe('preview-snapshot');
    });
    act(() => result.current.setFlashEnabled(true));
    await act(async () => { await result.current.capture(); });
    expect(native.capture).toHaveBeenCalledWith(expect.objectContaining({ flashMode: 'on' }), {});
  });

  it('switches Fast/HD without restarting the session', async () => {
    const { result } = renderHook(() => useCamera());
    ready(result);
    expect(result.current.captureMode).toBe('fast');
    act(() => result.current.setCaptureMode('hd'));
    expect(result.current.isReady).toBe(true);
    expect(result.current.effectiveCaptureMode).toBe('hd');
    await act(async () => {
      expect((await result.current.capture()).method).toBe(result.current.captureMethod);
    });
    act(() => result.current.setCaptureMode('fast'));
    expect(result.current.effectiveCaptureMode).toBe('fast');
    await act(async () => {
      expect((await result.current.capture()).method).toBe('preview-snapshot');
    });
  });

  it('preserves Fast preference while flash temporarily forces HD', () => {
    const { result } = renderHook(() => useCamera());
    act(() => result.current.setFlashEnabled(true));
    expect(result.current.captureMode).toBe('fast');
    expect(result.current.effectiveCaptureMode).toBe('hd');
    expect(result.current.canUseFastMode).toBe(false);
    act(() => result.current.setFlashEnabled(false));
    expect(result.current.effectiveCaptureMode).toBe('fast');
    expect(result.current.canUseFastMode).toBe(true);
  });

  it('reports the photo path on iOS even with a Fast preference', async () => {
    native.platform = 'ios';
    const { result } = renderHook(() => useCamera());
    ready(result);
    expect(result.current.canUseFastMode).toBe(false);
    expect(result.current.effectiveCaptureMode).toBe('hd');
    await act(async () => {
      expect((await result.current.capture()).method).toBe('photo');
    });
    expect(native.snapshot).not.toHaveBeenCalled();
  });

  it('supports controlled mode updates and an initial uncontrolled preference', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: 'fast' | 'hd' }) => useCamera({ captureMode: mode }),
      { initialProps: { mode: 'hd' } },
    );
    act(() => result.current.setCaptureMode('fast'));
    expect(result.current.captureMode).toBe('hd');
    rerender({ mode: 'fast' });
    expect(result.current.captureMode).toBe('fast');
    const uncontrolled = renderHook(() => useCamera({ defaultCaptureMode: 'hd' }));
    expect(uncontrolled.result.current.captureMode).toBe('hd');
  });

  it('recovers from capture failure', async () => {
    native.capture.mockRejectedValueOnce(new Error('Disk full'));
    const { result } = renderHook(() => useCamera({ captureMode: 'hd' }));
    ready(result);
    await act(async () => { await expect(result.current.capture()).rejects.toThrow('Disk full'); });
    expect(result.current.error?.message).toBe('Disk full');
    expect(result.current.isCapturing).toBe(false);
    await act(async () => { await result.current.capture(); });
    expect(result.current.error).toBeNull();
  });

  it('invalidates readiness when backgrounded, resumed, stopped, or switched', async () => {
    const { result, unmount } = renderHook(() => useCamera());
    ready(result);
    const staleStarted = result.current.previewProps!.onStarted;
    act(() => native.stateListener?.('background'));
    expect(result.current.isActive).toBe(false);
    act(() => native.stateListener?.('active'));
    act(() => staleStarted?.());
    expect(result.current.isReady).toBe(false);
    ready(result);
    act(() => result.current.switchCamera());
    expect(result.current.device?.id).toBe('front');
    expect(result.current.isReady).toBe(false);
    ready(result);
    act(() => result.current.stop());
    await expect(result.current.capture()).rejects.toThrow('not ready');
    unmount();
    expect(native.remove).toHaveBeenCalledOnce();
  });

  it('pauses for screen focus and requires a fresh session on return', () => {
    const { result, rerender } = renderHook(({ active }) => useCamera({ isActive: active }), { initialProps: { active: true } });
    ready(result);
    rerender({ active: false });
    expect(result.current.canCapture).toBe(false);
    rerender({ active: true });
    expect(result.current.canCapture).toBe(false);
    ready(result);
    expect(result.current.canCapture).toBe(true);
  });
});
