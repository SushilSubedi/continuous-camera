import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraPreview, useCamera, type CapturedPhoto } from '@continuous-camera/react-native';
import { PhotoGallery } from './photo-gallery';
import { theme } from './theme';
import { useCaptures, type DemoPhoto } from './use-captures';

type ShootMode = 'photo' | 'burst';
const BURST_COUNT = 5;

function IconButton({ icon, label, active, disabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }}
    disabled={disabled} onPress={onPress} hitSlop={10} style={[styles.icon, disabled && styles.disabled]}>
    <Ionicons name={icon} size={22} color={active ? theme.mode : theme.text} />
  </Pressable>;
}

/** Tap for the current mode, hold to shoot continuously. The disc becomes a rounded square while shooting. */
function Shutter({ disabled, shooting, onPress, onHoldStart, onHoldEnd }: {
  disabled: boolean; shooting: boolean; onPress: () => void; onHoldStart: () => void; onHoldEnd: () => void;
}) {
  const press = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  // Release only ends a burst this press started by holding; a tap in BURST mode must run to its count.
  const holding = useRef(false);
  useEffect(() => {
    Animated.spring(burst, { toValue: shooting ? 1 : 0, useNativeDriver: false, speed: 30, bounciness: 4 }).start();
  }, [burst, shooting]);
  const pressTo = (toValue: number) => Animated.spring(press, { toValue, useNativeDriver: false, speed: 40, bounciness: 0 }).start();

  return <Pressable
    accessibilityRole="button" accessibilityLabel="Shutter" accessibilityHint="Tap to shoot, hold to shoot continuously"
    // Stays enabled mid-burst so releasing the hold always reaches stopBurst.
    disabled={disabled && !shooting}
    onPress={() => { if (!shooting) onPress(); }}
    // A hold during a tap-started burst would restart and then cut it short; ignore it.
    onLongPress={() => { if (shooting) return; holding.current = true; onHoldStart(); }}
    onPressIn={() => pressTo(1)}
    onPressOut={() => {
      pressTo(0);
      if (holding.current) onHoldEnd();
      holding.current = false;
    }}
    style={[styles.shutter, disabled && !shooting && styles.disabled]}>
    <View style={styles.shutterRing}>
      <Animated.View style={[styles.shutterDisc, {
        transform: [{ scale: Animated.add(press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }), burst.interpolate({ inputRange: [0, 1], outputRange: [0, -0.45] })) }],
        borderRadius: burst.interpolate({ inputRange: [0, 1], outputRange: [33, 10] }),
        backgroundColor: burst.interpolate({ inputRange: [0, 1], outputRange: [theme.text, theme.record] }),
      }]} />
    </View>
  </Pressable>;
}

function Thumbnail({ photo, onPress }: { photo?: DemoPhoto; onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Open photos" hitSlop={10} style={styles.side}>
    {photo ? <Image source={{ uri: photo.uri }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
  </Pressable>;
}

function PermissionScreen({ canRequest, error, onRequest }: { canRequest: boolean; error: string | null; onRequest: () => void }) {
  return <View style={styles.center}>
    <Ionicons name="camera-outline" size={44} color={theme.muted} />
    <Text style={styles.cardTitle}>Allow camera access</Text>
    <Text style={styles.cardBody}>Photos stay in this app's cache on your device. Nothing is uploaded.</Text>
    <Pressable accessibilityRole="button" onPress={onRequest} style={styles.primary}>
      <Text style={styles.primaryText}>{canRequest ? 'Continue' : 'Open Settings'}</Text>
    </Pressable>
    {error && <Text style={styles.error}>{error}</Text>}
  </View>;
}

function CameraDemo() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<ShootMode>('photo');
  const [shotsThisBurst, setShotsThisBurst] = useState(0);
  const [burstTarget, setBurstTarget] = useState<number | undefined>();
  // Shots already queued when a burst starts land first; they aren't the burst's.
  const skipBeforeBurst = useRef(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const gallery = useCaptures();
  const blink = useRef(new Animated.Value(0)).current;

  function onCapture(photo: CapturedPhoto) {
    gallery.save(photo);
    if (skipBeforeBurst.current > 0) skipBeforeBurst.current -= 1;
    else setShotsThisBurst((count) => count + 1);
    blink.setValue(0.45);
    Animated.timing(blink, { toValue: 0, duration: 160, useNativeDriver: true }).start();
  }

  const camera = useCamera({ isActive: !paused && !galleryOpen, defaultCaptureMode: 'fast', onCapture });
  const busy = camera.isCapturing || camera.isBursting;
  const latest = gallery.photos[0];
  const error = camera.error?.message ?? gallery.error;
  const fastAvailable = Platform.OS === 'android';

  async function requestPermission() {
    try {
      setPermissionError(null);
      if (camera.permission.canRequestPermission) await camera.permission.requestPermission();
      else await Linking.openSettings();
    } catch (cause) {
      setPermissionError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  // Every photo reaches gallery.save through onCapture, including those from a failed burst.
  function burst(count?: number) {
    if (camera.isBursting) return;
    skipBeforeBurst.current = camera.pendingCaptures;
    setShotsThisBurst(0);
    setBurstTarget(count);
    camera.captureBurst({ count }).catch(gallery.report);
  }

  function shoot() {
    if (mode === 'burst') return burst(BURST_COUNT);
    setShotsThisBurst(0);
    camera.capture().catch(gallery.report);
  }

  const lastShot = latest && `${latest.method === 'preview-snapshot' ? 'Fast' : 'HD'} · ${latest.elapsedMs} ms`;

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" />

    <View style={styles.topBar}>
      <IconButton icon={camera.flashEnabled ? 'flash' : 'flash-off'} label={camera.flashEnabled ? 'Flash on' : 'Flash off'}
        active={camera.flashEnabled} disabled={busy || !camera.canUseFlash} onPress={() => camera.setFlashEnabled(!camera.flashEnabled)} />
      {camera.isBursting || camera.pendingCaptures > 1
        ? <View style={styles.counter}><View style={styles.recDot} /><Text style={styles.counterText}>{camera.isBursting
          ? `${shotsThisBurst}${burstTarget ? `/${burstTarget}` : ''}`
          : `${camera.pendingCaptures} queued`}</Text></View>
        : <Pressable accessibilityRole="button" accessibilityLabel={`Quality ${camera.effectiveCaptureMode === 'hd' ? 'HD' : 'Fast'}`}
          disabled={busy || !fastAvailable || camera.flashEnabled} hitSlop={10}
          onPress={() => camera.setCaptureMode(camera.captureMode === 'fast' ? 'hd' : 'fast')}
          style={[styles.quality, camera.effectiveCaptureMode === 'hd' && styles.qualityOn]}>
          <Text style={[styles.qualityText, camera.effectiveCaptureMode === 'hd' && styles.qualityTextOn]}>{camera.effectiveCaptureMode === 'hd' ? 'HD' : 'FAST'}</Text>
        </Pressable>}
      <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Resume camera' : 'Pause camera'} onPress={() => setPaused(!paused)} />
    </View>

    <View style={styles.viewfinder}>
      {!camera.permission.hasPermission ? <PermissionScreen canRequest={camera.permission.canRequestPermission} error={permissionError} onRequest={() => void requestPermission()} />
        : !camera.device ? <View style={styles.center}>
          <Ionicons name="videocam-off-outline" size={40} color={theme.muted} />
          <Text style={styles.cardTitle}>No camera available</Text>
          <Text style={styles.cardBody}>Simulators have no camera. Run on a device to shoot.</Text>
        </View>
        : <CameraPreview camera={camera}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blink, { opacity: blink }]} />
          {paused && <View style={styles.pausedScrim}><Ionicons name="pause" size={36} color={theme.text} /></View>}
          {(error || lastShot) && <View style={styles.toast} pointerEvents="none">
            <Text style={[styles.toastText, error && styles.error]} numberOfLines={2}>{error ?? lastShot}</Text>
          </View>}
        </CameraPreview>}
    </View>

    <View style={styles.modes}>
      {(['photo', 'burst'] as const).map((value) => <Pressable key={value} onPress={() => setMode(value)} disabled={busy} hitSlop={8}
        accessibilityRole="button" accessibilityState={{ selected: mode === value }}>
        <Text style={[styles.modeText, mode === value && styles.modeTextOn]}>{value === 'photo' ? 'PHOTO' : `BURST ×${BURST_COUNT}`}</Text>
      </Pressable>)}
    </View>

    <View style={styles.controls}>
      <Thumbnail photo={latest} onPress={() => setGalleryOpen(true)} />
      <Shutter disabled={!camera.canCapture || (mode === 'burst' && camera.isBursting)} shooting={camera.isBursting}
        onPress={shoot} onHoldStart={() => burst()} onHoldEnd={camera.stopBurst} />
      <Pressable accessibilityRole="button" accessibilityLabel="Switch camera" disabled={busy || !camera.canSwitchCamera}
        onPress={camera.switchCamera} hitSlop={10} style={[styles.side, (busy || !camera.canSwitchCamera) && styles.disabled]}>
        <View style={styles.flip}><Ionicons name="camera-reverse-outline" size={26} color={theme.text} /></View>
      </Pressable>
    </View>

    <PhotoGallery visible={galleryOpen} photos={gallery.photos} busy={busy || gallery.busy}
      onClose={() => setGalleryOpen(false)} onClear={() => void gallery.clear()} />
  </SafeAreaView>;
}

export function App() {
  return <SafeAreaProvider><CameraDemo /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  quality: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5, borderColor: theme.text },
  qualityOn: { backgroundColor: theme.mode, borderColor: theme.mode },
  qualityText: { color: theme.text, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  qualityTextOn: { color: '#000' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, backgroundColor: theme.record },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.text },
  counterText: { color: theme.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  viewfinder: { flex: 1, backgroundColor: '#0b0b0c', overflow: 'hidden' },
  blink: { backgroundColor: '#000' },
  pausedScrim: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  toast: { position: 'absolute', bottom: 12, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' },
  toastText: { color: theme.text, fontSize: 12, fontVariant: ['tabular-nums'] },
  error: { color: theme.danger, textAlign: 'center' },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingTop: 16, paddingBottom: 6 },
  modeText: { color: theme.muted, fontSize: 13, fontWeight: '600', letterSpacing: 1.2 },
  modeTextOn: { color: theme.mode },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingTop: 10, paddingBottom: 18 },
  side: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: theme.text },
  thumbEmpty: { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: '#1c1c1e' },
  shutter: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  shutterRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: theme.text, alignItems: 'center', justifyContent: 'center' },
  shutterDisc: { width: 66, height: 66 },
  flip: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c1c1e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  cardTitle: { color: theme.text, fontSize: 20, fontWeight: '600' },
  cardBody: { color: theme.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  primary: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 999, backgroundColor: theme.text },
  primaryText: { color: '#000', fontSize: 15, fontWeight: '600' },
});
