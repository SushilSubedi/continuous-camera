import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCamera } from '../use-camera';

function createMockTrack(): MediaStreamTrack {
  return {
    kind: 'video',
    stop: vi.fn(),
    enabled: true,
    id: 'mock-track',
    label: 'Mock Camera',
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
    value: { getUserMedia, enumerateDevices },
    writable: true,
    configurable: true,
  });

  return { mockStream, getUserMedia, enumerateDevices };
}

describe('useCamera', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
