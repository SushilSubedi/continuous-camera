import { useRef, useEffect, type ComponentPropsWithoutRef, type ReactNode } from 'react';

/** Lower-level hook that binds a MediaStream to a video element ref */
export function useCameraPreview(stream: MediaStream | null) {
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

  return videoRef;
}

export interface CameraPreviewProps extends Omit<ComponentPropsWithoutRef<'video'>, 'src' | 'srcObject'> {
  /** The MediaStream to display */
  stream: MediaStream | null;
  /** Mirror the video horizontally (useful for selfie cam). Default: false */
  mirror?: boolean;
  /** Overlay content rendered on top of the video (e.g., viewfinder guides, capture buttons) */
  children?: ReactNode;
}

export function CameraPreview({ stream, mirror = false, style, children, ...props }: CameraPreviewProps) {
  const videoRef = useCameraPreview(stream);

  const videoElement = (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: mirror ? 'scaleX(-1)' : undefined,
        ...style,
      }}
      {...props}
    />
  );

  if (!children) return videoElement;

  return (
    <div style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
      {videoElement}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
