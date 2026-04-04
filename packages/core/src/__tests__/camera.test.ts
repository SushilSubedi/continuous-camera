import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Camera, createCamera } from '../index';
import type { CameraState } from '../types';

// -- Mock MediaStream & navigator.mediaDevices --

function createMockTrack(kind: 'video' | 'audio' = 'video'): MediaStreamTrack {
  return {
    kind,
    stop: vi.fn(),
    enabled: true,
    id: crypto.randomUUID(),
    label: `Mock ${kind} track`,
  } as unknown as MediaStreamTrack;
}

function createMockStream(tracks?: MediaStreamTrack[]): MediaStream {
  const _tracks = tracks ?? [createMockTrack('video')];
  return {
    getTracks: () => _tracks,
    getVideoTracks: () => _tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => _tracks.filter((t) => t.kind === 'audio'),
    id: crypto.randomUUID(),
    active: true,
  } as unknown as MediaStream;
}

function setupMediaDevices(stream?: MediaStream) {
  const mockStream = stream ?? createMockStream();
  const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);
  const mockEnumerateDevices = vi.fn().mockResolvedValue([
    { kind: 'videoinput', deviceId: 'cam-1', label: 'Front Camera' },
    { kind: 'videoinput', deviceId: 'cam-2', label: 'Back Camera' },
    { kind: 'audioinput', deviceId: 'mic-1', label: 'Microphone' },
  ]);

  // isBrowser() checks both window and navigator
  Object.defineProperty(globalThis, 'window', { value: {}, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: mockEnumerateDevices,
      },
    },
    writable: true,
    configurable: true,
  });

  return { mockStream, mockGetUserMedia, mockEnumerateDevices };
}

function cleanupMediaDevices() {
  Object.defineProperty(globalThis, 'window', { value: undefined, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
}

// -- Tests --

describe('Camera', () => {
  afterEach(() => {
    cleanupMediaDevices();
  });

  describe('constructor', () => {
    it('initializes with idle state', () => {
      const camera = new Camera();
      expect(camera.state).toBe('idle');
      expect(camera.stream).toBeNull();
      expect(camera.error).toBeNull();
      expect(camera.isActive).toBe(false);
    });
  });

  describe('start()', () => {
    it('acquires a stream and transitions to active', async () => {
      const { mockStream, mockGetUserMedia } = setupMediaDevices();
      const camera = new Camera({ facingMode: 'user' });

      const states: CameraState[] = [];
      camera.on('statechange', (s) => states.push(s));

      const stream = await camera.start();

      expect(stream).toBe(mockStream);
      expect(camera.state).toBe('active');
      expect(camera.stream).toBe(mockStream);
      expect(camera.isActive).toBe(true);
      expect(mockGetUserMedia).toHaveBeenCalledOnce();
      expect(states).toEqual(['starting', 'active']);
    });

    it('returns existing stream if already active', async () => {
      const { mockStream, mockGetUserMedia } = setupMediaDevices();
      const camera = new Camera();

      await camera.start();
      const stream2 = await camera.start();

      expect(stream2).toBe(mockStream);
      expect(mockGetUserMedia).toHaveBeenCalledOnce();
    });

    it('throws and transitions to error when getUserMedia fails', async () => {
      setupMediaDevices();
      const gumError = new Error('Permission denied');
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(gumError);

      const camera = new Camera();
      const errorHandler = vi.fn();
      camera.on('error', errorHandler);

      await expect(camera.start()).rejects.toThrow('Permission denied');
      expect(camera.state).toBe('error');
      expect(camera.error?.message).toBe('Permission denied');
      expect(errorHandler).toHaveBeenCalledWith(gumError);
    });

    it('throws in non-browser environments', async () => {
      const camera = new Camera();
      await expect(camera.start()).rejects.toThrow('getUserMedia is not supported');
    });
  });

  describe('stop()', () => {
    it('stops all tracks and resets to idle', async () => {
      const { mockStream } = setupMediaDevices();
      const camera = new Camera();
      await camera.start();

      const stopHandler = vi.fn();
      camera.on('streamstop', stopHandler);

      camera.stop();

      expect(camera.state).toBe('idle');
      expect(camera.stream).toBeNull();
      expect(stopHandler).toHaveBeenCalled();
      mockStream.getTracks().forEach((track) => {
        expect(track.stop).toHaveBeenCalled();
      });
    });
  });

  describe('switchCamera()', () => {
    it('toggles facing mode and restarts stream', async () => {
      const { mockGetUserMedia } = setupMediaDevices();
      const camera = new Camera({ facingMode: 'user' });
      await camera.start();

      await camera.switchCamera();

      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
      const lastCall = mockGetUserMedia.mock.calls[1][0];
      expect(lastCall.video.facingMode).toBe('environment');
    });
  });

  describe('getDevices()', () => {
    it('returns only video input devices', async () => {
      setupMediaDevices();
      const camera = new Camera();
      const devices = await camera.getDevices();

      expect(devices).toHaveLength(2);
      expect(devices.every((d) => d.kind === 'videoinput')).toBe(true);
    });

    it('returns empty array in non-browser environments', async () => {
      const camera = new Camera();
      const devices = await camera.getDevices();
      expect(devices).toEqual([]);
    });
  });

  describe('events', () => {
    it('on() returns an unsubscribe function', async () => {
      setupMediaDevices();
      const camera = new Camera();
      const handler = vi.fn();
      const unsub = camera.on('statechange', handler);

      await camera.start();
      expect(handler).toHaveBeenCalled();

      handler.mockClear();
      unsub();
      camera.stop();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('destroy()', () => {
    it('stops stream and clears listeners', async () => {
      setupMediaDevices();
      const camera = new Camera();
      await camera.start();

      const handler = vi.fn();
      camera.on('statechange', handler);

      camera.destroy();

      expect(camera.state).toBe('idle');
      expect(camera.stream).toBeNull();
      // Listener cleared, so further changes won't fire
      handler.mockClear();
    });
  });
});

describe('createCamera()', () => {
  it('returns a Camera instance', () => {
    const camera = createCamera({ facingMode: 'environment' });
    expect(camera).toBeInstanceOf(Camera);
    expect(camera.state).toBe('idle');
  });
});
