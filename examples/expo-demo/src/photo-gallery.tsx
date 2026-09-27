import { useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './theme';
import type { DemoPhoto } from './use-captures';

const COLUMNS = 3;
const GAP = 4;

function describe(photo: DemoPhoto) {
  const mode = photo.method === 'preview-snapshot' ? 'Fast' : 'HD';
  return `${mode} · ${photo.elapsedMs} ms · ${photo.width}×${photo.height} · ${Math.round(photo.bytes / 1024)} KB`;
}

/** Full-screen sheet: a grid of this session's shots, tap one to review it with its capture stats. */
export function PhotoGallery({ visible, photos, busy, onClose, onClear }: {
  visible: boolean;
  photos: DemoPhoto[];
  busy: boolean;
  onClose: () => void;
  onClear: () => void;
}) {
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<DemoPhoto | null>(null);
  const size = (width - GAP * (COLUMNS + 1)) / COLUMNS;
  const close = () => { setSelected(null); onClose(); };

  // A Modal renders outside the app's SafeAreaProvider, so it needs its own for correct insets.
  return <Modal visible={visible} onRequestClose={selected ? () => setSelected(null) : close} animationType="slide">
    <SafeAreaProvider>
    <SafeAreaView style={styles.sheet}>
      <View style={styles.header}>
        <Pressable onPress={selected ? () => setSelected(null) : close} hitSlop={12} accessibilityRole="button">
          <Text style={styles.link}>{selected ? '‹ Photos' : 'Done'}</Text>
        </Pressable>
        <Text style={styles.title}>{selected ? 'Review' : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}</Text>
        <Pressable onPress={onClear} disabled={busy || !photos.length || selected !== null} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.link, styles.danger, (busy || !photos.length || selected) && styles.hidden]}>Clear</Text>
        </Pressable>
      </View>

      {selected ? <View style={styles.review}>
        <Image source={{ uri: selected.uri }} resizeMode="contain" style={styles.image} />
        <View style={styles.stats}>
          <Text selectable style={styles.statsText}>{describe(selected)}</Text>
        </View>
      </View> : photos.length ? <FlatList
        data={photos}
        keyExtractor={(photo) => photo.uri}
        numColumns={COLUMNS}
        contentContainerStyle={{ padding: GAP, gap: GAP }}
        columnWrapperStyle={{ gap: GAP }}
        renderItem={({ item }) => <Pressable onPress={() => setSelected(item)} accessibilityRole="imagebutton" accessibilityLabel={describe(item)}>
          <Image source={{ uri: item.uri }} style={{ width: size, height: size * 4 / 3, borderRadius: 6 }} />
        </Pressable>}
      /> : <View style={styles.empty}>
        <Text style={styles.emptyText}>No photos yet. Tap the shutter, or hold it to shoot continuously.</Text>
      </View>}
    </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { color: theme.text, fontSize: 16, fontWeight: '600' },
  link: { color: theme.mode, fontSize: 16, fontWeight: '500', minWidth: 64 },
  danger: { color: theme.danger, textAlign: 'right' },
  hidden: { opacity: 0 },
  review: { flex: 1 },
  image: { flex: 1 },
  stats: { padding: 20, alignItems: 'center' },
  statsText: { color: theme.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: theme.muted, textAlign: 'center', lineHeight: 20 },
});
