import { useEffect, useRef, useState } from "react";
import { Image } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import type { CapturedPhoto } from "@continuous-camera/react-native";

export interface DemoPhoto {
  uri: string;
  method: string;
  elapsedMs: number;
  width: number;
  height: number;
  bytes: number;
}

/** App-owned gallery: pass `save` as the camera's `onCapture` so every shot is kept as it lands. */
export function useCaptures() {
  const [photos, setPhotos] = useState<DemoPhoto[]>([]);
  const [saving, setSaving] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const saved = useRef<DemoPhoto[]>([]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function report(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    // Pausing, backgrounding or flipping cancels queued shots on purpose; that isn't an error.
    if (message === 'Camera stopped') return;
    if (mounted.current) setError(message);
  }

  async function saveOne(photo: CapturedPhoto) {
    let uri: string | null = null;
    try {
      if (!FileSystem.cacheDirectory) throw new Error("App cache is unavailable");
      const directory = `${FileSystem.cacheDirectory}continuous-camera-demo/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      uri = `${directory}${randomUUID()}.jpg`;
      await FileSystem.copyAsync({ from: photo.uri, to: uri });
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(uri!, (width, height) => resolve({ width, height }), reject);
      });
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error("Captured file could not be read");
      if (!mounted.current) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        return;
      }
      const result = { uri, method: photo.method, elapsedMs: photo.durationMs, ...dimensions, bytes: info.size };
      saved.current = [result, ...saved.current];
      setPhotos(saved.current);
      setError(null);
    } catch (error) {
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      throw error;
    } finally {
      await FileSystem.deleteAsync(photo.uri, { idempotent: true }).catch(() => {});
    }
  }

  /** Saves run alongside further captures, so the shutter never waits on file I/O. */
  function save(photo: CapturedPhoto) {
    setSaving((count) => count + 1);
    saveOne(photo).catch(report).finally(() => {
      if (mounted.current) setSaving((count) => count - 1);
    });
  }

  async function clear() {
    if (clearing || saving) return;
    setClearing(true);
    try {
      for (const photo of saved.current) await FileSystem.deleteAsync(photo.uri, { idempotent: true });
      saved.current = [];
      setPhotos([]);
    } catch (cause) {
      report(cause);
    } finally {
      setClearing(false);
    }
  }

  return { photos, busy: saving > 0 || clearing, error, report, save, clear };
}
