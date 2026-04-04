"use client";

import { useState, useCallback } from "react";
import { useCamera, CameraPreview } from "@continuous-camera/react";

export function CameraDemo() {
  const camera = useCamera({ facingMode: "user" });
  const [captures, setCaptures] = useState<string[]>([]);

  const handleCapture = useCallback(async () => {
    try {
      const blob = await camera.capture({ format: "image/jpeg", quality: 0.9 });
      const url = URL.createObjectURL(blob);
      setCaptures((prev) => [url, ...prev]);
    } catch (err) {
      console.error("Capture failed:", err);
    }
  }, [camera]);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto">
      {/* Camera viewfinder */}
      <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden">
        {camera.isActive ? (
          <CameraPreview
            stream={camera.stream}
            mirror
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            {camera.state === "starting" ? (
              <p>Starting camera…</p>
            ) : (
              <p>Camera is off</p>
            )}
          </div>
        )}

        {/* State badge */}
        <span
          className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${
            camera.isActive
              ? "bg-green-500/20 text-green-400"
              : camera.state === "error"
                ? "bg-red-500/20 text-red-400"
                : "bg-neutral-500/20 text-neutral-400"
          }`}
        >
          {camera.state}
        </span>
      </div>

      {/* Error message */}
      {camera.error && (
        <p className="text-red-400 text-sm">Error: {camera.error.message}</p>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        {!camera.isActive ? (
          <button
            onClick={() => camera.start()}
            disabled={camera.state === "starting"}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            Start Camera
          </button>
        ) : (
          <>
            <button
              onClick={handleCapture}
              className="px-5 py-2.5 bg-white hover:bg-neutral-100 text-black rounded-lg font-medium transition-colors"
            >
              📸 Capture
            </button>
            <button
              onClick={() => camera.switchCamera()}
              className="px-5 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium transition-colors"
            >
              🔄 Switch
            </button>
            <button
              onClick={camera.stop}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Stop
            </button>
          </>
        )}
      </div>

      {/* Captured images */}
      {captures.length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-medium text-neutral-400 mb-3">
            Captures ({captures.length})
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {captures.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Capture ${i + 1}`}
                className="w-full aspect-video object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
