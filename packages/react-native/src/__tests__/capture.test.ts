import { describe, expect, it, vi } from 'vitest';
import { capturePhoto, selectCaptureMethod } from '../capture';

describe('native capture', () => {
  it.each([
    ['android', 'fast', false, 'preview-snapshot'],
    ['android', 'fast', true, 'photo'],
    ['android', 'hd', false, 'photo'],
    ['ios', 'fast', false, 'photo'],
  ] as const)('selects %s / %s / flash %s', (platform, mode, flash, expected) => {
    expect(selectCaptureMethod(platform, mode, flash)).toBe(expected);
  });

  it.each([false, true])('disposes snapshots even when saving fails: %s', async (fails) => {
    const dispose = vi.fn();
    const save = fails ? vi.fn().mockRejectedValue(new Error('save failed')) : vi.fn().mockResolvedValue('file:///tmp/snap.jpg');
    const pending = capturePhoto({
      camera: { takeSnapshot: vi.fn().mockResolvedValue({ dispose, saveToTemporaryFileAsync: save }) },
      photoOutput: { capturePhotoToFile: vi.fn() },
      platform: 'android', mode: 'fast', flash: false, quality: 0.9,
    });
    if (fails) await expect(pending).rejects.toThrow('save failed');
    else expect((await pending).uri).toBe('file:///tmp/snap.jpg');
    expect(dispose).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('jpg', 90);
  });
});
