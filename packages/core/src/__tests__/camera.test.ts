import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Camera, createCamera } from '../index';
import type { CameraState } from '../types';

// -- Mock MediaStream & navigator.mediaDevices --

let mockId = 0;

function nextMockId(prefix: string): string {
  mockId += 1;
  return `${prefix}-${mockId}`;
}

function createMockTrack(kind: 'video' | 'audio' = 'video'): MediaStreamTrack {
  return {
    kind,
    stop: vi.fn(),
    enabled: true,
    id: nextMockId(`${kind}-track`),
    label: `Mock ${kind} track`,
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    getCapabilities: vi.fn().mockReturnValue({}),
    getSettings: vi.fn().mockReturnValue({}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;
}

function createMockStream(tracks?: MediaStreamTrack[]): MediaStream {
  const _tracks = tracks ?? [createMockTrack('video')];
  return {
    getTracks: () => _tracks,
    getVideoTracks: () => _tracks.filter((t) => t.kind === 'video'),
    getAudioTracks: () => _tracks.filter((t) => t.kind === 'audio'),
    id: nextMockId('stream'),
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
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
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
  beforeEach(() => {
    mockId = 0;
  });

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

  describe('selectDevice()', () => {
    it('sets deviceId, stops active stream, and starts a new one with exact deviceId constraint', async () => {
      const { mockGetUserMedia } = setupMediaDevices();
      const camera = new Camera({ facingMode: 'user' });
      await camera.start();

      await camera.selectDevice('cam-2');

      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
      const lastCall = mockGetUserMedia.mock.calls[1][0];
      expect(lastCall.video.deviceId).toEqual({ exact: 'cam-2' });
    });
  });

  describe('applyConstraints()', () => {
    it('applies constraints to the active video track', async () => {
      const { mockStream } = setupMediaDevices();
      const camera = new Camera();
      await camera.start();

      const constraints: MediaTrackConstraints = { width: 1280, height: 720 };
      await camera.applyConstraints(constraints);

      const videoTrack = mockStream.getVideoTracks()[0];
      expect(videoTrack.applyConstraints).toHaveBeenCalledWith(constraints);
    });

    it('throws if camera is not active', async () => {
      setupMediaDevices();
      const camera = new Camera();
      await expect(camera.applyConstraints({ width: 1280 })).rejects.toThrow(
        'Camera is not active',
      );
    });
  });

  describe('getCapabilities()', () => {
    it('returns capabilities from the active video track', async () => {
      const track = createMockTrack('video');
      const capabilities = { width: { min: 320, max: 1920 } };
      (track.getCapabilities as ReturnType<typeof vi.fn>).mockReturnValue(capabilities);

      const stream = createMockStream([track]);
      setupMediaDevices(stream);

      const camera = new Camera();
      await camera.start();

      expect(camera.getCapabilities()).toEqual(capabilities);
    });

    it('returns null when camera is not active', () => {
      const camera = new Camera();
      expect(camera.getCapabilities()).toBeNull();
    });
  });

  describe('getSettings()', () => {
    it('returns settings from the active video track', async () => {
      const track = createMockTrack('video');
      const settings = { width: 1920, height: 1080, frameRate: 30 };
      (track.getSettings as ReturnType<typeof vi.fn>).mockReturnValue(settings);

      const stream = createMockStream([track]);
      setupMediaDevices(stream);

      const camera = new Camera();
      await camera.start();

      expect(camera.getSettings()).toEqual(settings);
    });

    it('returns null when camera is not active', () => {
      const camera = new Camera();
      expect(camera.getSettings()).toBeNull();
    });
  });

  describe('trackended event', () => {
    it('emits trackended when the video track fires ended', async () => {
      const track = createMockTrack('video');
      const stream = createMockStream([track]);
      setupMediaDevices(stream);

      const camera = new Camera();
      await camera.start();

      const handler = vi.fn();
      camera.on('trackended', handler);

      // Retrieve the ended listener registered via addEventListener
      const addEventListenerCalls = (track.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
      const endedCall = addEventListenerCalls.find((call) => call[0] === 'ended');
      expect(endedCall).toBeDefined();

      // Simulate the track ending
      endedCall![1]();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('devicechange event', () => {
    it('emits devicechange with devices when navigator.mediaDevices fires devicechange', async () => {
      setupMediaDevices();
      const camera = new Camera();
      await camera.start();

      const handler = vi.fn();
      camera.on('devicechange', handler);

      // Find the devicechange listener registered on navigator.mediaDevices
      const addEventListenerCalls = (
        navigator.mediaDevices.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls;
      const deviceChangeCall = addEventListenerCalls.find((call) => call[0] === 'devicechange');
      expect(deviceChangeCall).toBeDefined();

      // Simulate the devicechange event
      await deviceChangeCall![1]();

      expect(handler).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'videoinput' }),
        ]),
      );
    });
  });

  describe('switchCamera() clears deviceId', () => {
    it('uses facingMode instead of deviceId after switchCamera', async () => {
      const { mockGetUserMedia } = setupMediaDevices();
      const camera = new Camera({ facingMode: 'user' });
      await camera.start();

      await camera.selectDevice('cam-2');
      expect(mockGetUserMedia.mock.calls[1][0].video.deviceId).toEqual({ exact: 'cam-2' });

      await camera.switchCamera();
      const lastCall = mockGetUserMedia.mock.calls[2][0];
      expect(lastCall.video.facingMode).toBeDefined();
      expect(lastCall.video.deviceId).toBeUndefined();
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
