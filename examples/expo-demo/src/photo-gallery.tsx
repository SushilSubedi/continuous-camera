import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DemoPhoto } from './use-captures';

export function PhotoGallery({ photos, selected, onSelect }: {
  photos: DemoPhoto[];
  selected: DemoPhoto | null;
  onSelect: (photo: DemoPhoto | null) => void;
}) {
  return <>
    <ScrollView horizontal style={styles.strip} contentContainerStyle={styles.thumbnails}>
      {photos.map((photo) => <Pressable key={photo.uri} onPress={() => onSelect(photo)} accessibilityRole="button" accessibilityLabel="Review captured photo">
        <Image source={{ uri: photo.uri }} style={styles.thumbnail} />
      </Pressable>)}
    </ScrollView>
    <Modal visible={selected !== null} onRequestClose={() => onSelect(null)} animationType="slide">
      <SafeAreaView style={styles.review}>
        <Pressable onPress={() => onSelect(null)} style={styles.close} accessibilityRole="button"><Text style={styles.text}>Close review</Text></Pressable>
        {selected && <>
          <Image source={{ uri: selected.uri }} resizeMode="contain" style={styles.image} />
          <View style={styles.close}><Text selectable style={styles.text}>{selected.width} × {selected.height} · {selected.elapsedMs} ms · {Math.round(selected.bytes / 1024)} KB</Text></View>
        </>}
      </SafeAreaView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  strip: { maxHeight: 80 }, thumbnails: { gap: 8 }, thumbnail: { height: 80, width: 64, borderRadius: 8 },
  review: { flex: 1, backgroundColor: '#111513' }, close: { padding: 20 }, text: { color: '#eef4f0' }, image: { flex: 1 },
});
