import { useRef, useEffect, type ComponentPropsWithoutRef } from 'react';

export interface CameraPreviewProps extends Omit<ComponentPropsWithoutRef<'video'>, 'src' | 'srcObject'> {
  /** The MediaStream to display */
  stream: MediaStream | null;
  /** Mirror the video horizontally (useful for selfie cam). Default: false */
  mirror?: boolean;
}

export function CameraPreview({ stream, mirror = false, style, ...props }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {
        // Autoplay may be blocked; user interaction required
      });
    } else {
      video.srcObject = null;
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        transform: mirror ? 'scaleX(-1)' : undefined,
        ...style,
      }}
      {...props}
    />
  );
}
