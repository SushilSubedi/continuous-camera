import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CameraPreview, useCamera } from '@continuous-camera/react-native';
import { PhotoGallery } from './photo-gallery';
import { useCaptures, type DemoPhoto } from './use-captures';

function Button({ label, disabled, selected, onPress, onLongPress, onPressOut }: {
  label: string; disabled?: boolean; selected?: boolean; onPress: () => void;
  onLongPress?: () => void; onPressOut?: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }}
    disabled={disabled} onPress={onPress} onLongPress={onLongPress} onPressOut={onPressOut} style={[styles.button, selected && styles.selected, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, selected && styles.selectedText]}>{label}</Text>
  </Pressable>;
}

function CameraDemo() {
  const [photo, setPhoto] = useState<DemoPhoto | null>(null);
  const [paused, setPaused] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const gallery = useCaptures();
  const camera = useCamera({ isActive: !paused && !photo, defaultCaptureMode: 'fast', onCapture: gallery.save });
  const busy = camera.isCapturing || camera.isBursting;

  // Each photo reaches gallery.save through onCapture, including from a failed burst.
  function burst(count?: number) {
    camera.captureBurst({ count })
      .then((photos) => gallery.setMessage(`Burst: ${photos.length} photo${photos.length === 1 ? '' : 's'}`))
      .catch(gallery.report);
  }

  async function requestPermission() {
    try {
      setPermissionError(null);
      if (camera.permission.canRequestPermission) await camera.permission.requestPermission();
      else await Linking.openSettings();
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : String(error));
    }
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar barStyle="light-content" />
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>CONTINUOUS CAMERA</Text>
      <Text style={styles.title}>Every shot. Your pace.</Text>
      <Text style={styles.muted}>{camera.device?.name ?? 'Camera demo'} · {camera.isReady ? 'Ready' : 'Waiting / paused'}</Text>
    </View>
    <View style={styles.preview}>
      {camera.permission.hasPermission && camera.device ? <CameraPreview camera={camera} /> :
        <View style={styles.empty}>
          <Text style={styles.muted}>{camera.permission.hasPermission ? 'No camera available' : 'Allow camera access to get started.'}</Text>
          {!camera.permission.hasPermission && <Button label={camera.permission.canRequestPermission ? 'Allow camera' : 'Open settings'} onPress={() => void requestPermission()} />}
        </View>}
    </View>
    <ScrollView style={styles.controls} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Button label="Fast" selected={camera.captureMode === 'fast'} disabled={busy || Platform.OS !== 'android'} onPress={() => camera.setCaptureMode('fast')} />
        <Button label="HD" selected={camera.captureMode === 'hd'} disabled={busy} onPress={() => camera.setCaptureMode('hd')} />
        <Text style={styles.muted}>Capturing in {camera.effectiveCaptureMode.toUpperCase()}</Text>
      </View>
      <Text style={styles.muted}>{Platform.OS === 'ios' ? 'iPhone uses the native photo pipeline.' : camera.flashEnabled ? 'Flash uses HD; your mode preference is kept.' : 'Fast captures the preview. HD uses the photo pipeline.'} Pinch to zoom; tap to focus.</Text>
      <View style={styles.row}>
        <Button label={camera.flashEnabled ? 'Flash on' : 'Flash off'} disabled={busy || !camera.canUseFlash} onPress={() => camera.setFlashEnabled(!camera.flashEnabled)} />
        <Button label="Flip" disabled={busy || !camera.canSwitchCamera} onPress={camera.switchCamera} />
        <Button label={paused ? 'Resume' : 'Pause'} onPress={() => setPaused(!paused)} />
      </View>
      <View style={styles.row}>
        {/* Stays enabled mid-burst so releasing the hold always reaches stopBurst. */}
        <Button label={camera.isBursting ? 'Shooting…' : 'Capture'} selected disabled={!camera.isBursting && !camera.canCapture}
          onPress={() => { if (!camera.isBursting) void camera.capture().catch(gallery.report); }} onLongPress={() => burst()} onPressOut={camera.stopBurst} />
        <Button label="Burst 5" disabled={camera.isBursting || !camera.canCapture} onPress={() => burst(5)} />
        <Button label="Clear" disabled={busy || gallery.busy || !gallery.photos.length} onPress={() => void gallery.clear()} />
        {camera.pendingCaptures > 1 && <Text style={styles.muted}>{camera.pendingCaptures} queued</Text>}
      </View>
      <Text selectable style={styles.muted}>{permissionError ?? camera.error?.message ?? gallery.message}</Text>
      <Text style={styles.eyebrow}>LOCAL GALLERY · {gallery.photos.length}</Text>
      <PhotoGallery photos={gallery.photos} selected={photo} onSelect={setPhoto} />
    </ScrollView>
  </SafeAreaView>;
}

export function App() {
  return <SafeAreaProvider><CameraDemo /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111513' }, heading: { padding: 20, gap: 6 },
  eyebrow: { color: '#a4e3bd', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#eef4f0', fontSize: 26, fontWeight: '600' }, muted: { color: '#b4c1b9', fontSize: 12, lineHeight: 18 },
  preview: { flex: 1, minHeight: 160, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: '#202923' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  controls: { flexGrow: 0, maxHeight: 340 }, content: { padding: 20, gap: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  button: { backgroundColor: '#29362f', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 24 },
  selected: { backgroundColor: '#a4e3bd' }, disabled: { opacity: 0.35 }, buttonText: { color: '#eef4f0', fontWeight: '600' }, selectedText: { color: '#112319' },
});
