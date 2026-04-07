import { describe, it, expect, vi, afterEach } from 'vitest';
import { isBrowser, isMediaDevicesSupported, buildConstraints, stopStream } from '../utils';

describe('isBrowser()', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'window', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
  });

  it('returns false in Node environment', () => {
    expect(isBrowser()).toBe(false);
  });

  it('returns true when window and navigator exist', () => {
    Object.defineProperty(globalThis, 'window', { value: {}, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
    expect(isBrowser()).toBe(true);
  });
});

describe('isMediaDevicesSupported()', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'window', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
  });

  it('returns false without navigator.mediaDevices', () => {
    expect(isMediaDevicesSupported()).toBe(false);
  });

  it('returns true with getUserMedia', () => {
    Object.defineProperty(globalThis, 'window', { value: {}, writable: true, configurable: true });
    Object.defineProperty(globalThis, 'navigator', {
      value: { mediaDevices: { getUserMedia: vi.fn() } },
      writable: true,
      configurable: true,
    });
    expect(isMediaDevicesSupported()).toBe(true);
  });
});

describe('buildConstraints()', () => {
  it('builds default constraints', () => {
    const result = buildConstraints({});
    expect(result).toEqual({
      video: {
        facingMode: 'user',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  });

  it('respects custom options', () => {
    const result = buildConstraints({
      facingMode: 'environment',
      resolution: { width: 1280, height: 720 },
      audio: true,
    });
    expect(result).toEqual({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: true,
    });
  });

  it('uses deviceId when provided', () => {
    const result = buildConstraints({ deviceId: 'cam-123' });
    expect(result).toEqual({
      video: {
        deviceId: { exact: 'cam-123' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    expect((result.video as MediaTrackConstraints).facingMode).toBeUndefined();
  });

  it('deviceId takes precedence over facingMode', () => {
    const result = buildConstraints({ deviceId: 'cam-123', facingMode: 'environment' });
    expect(result).toEqual({
      video: {
        deviceId: { exact: 'cam-123' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    expect((result.video as MediaTrackConstraints).facingMode).toBeUndefined();
  });

  it('uses raw constraints when provided', () => {
    const raw: MediaStreamConstraints = { video: true, audio: true };
    const result = buildConstraints({ constraints: raw });
    expect(result).toBe(raw);
  });
});

describe('stopStream()', () => {
  it('stops all tracks', () => {
    const track1 = { stop: vi.fn() };
    const track2 = { stop: vi.fn() };
    const stream = { getTracks: () => [track1, track2] } as unknown as MediaStream;

    stopStream(stream);
    expect(track1.stop).toHaveBeenCalled();
    expect(track2.stop).toHaveBeenCalled();
  });

  it('handles null gracefully', () => {
    expect(() => stopStream(null)).not.toThrow();
  });
});
