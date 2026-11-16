import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isPdf, setViewerHost, type ViewerFile } from '../lib/viewer';
import { PdfView } from './PdfView';

// Full-screen view of one receipt file, photo or PDF. Mounted once in the root
// layout; lib/viewer.ts opens it from any screen.

async function openOutside(file: ViewerFile): Promise<void> {
  if (Platform.OS === 'web') {
    // A data URL cannot be opened in a new tab directly, so it goes through a blob link.
    const url = file.uri.startsWith('data:') ? URL.createObjectURL(await (await fetch(file.uri)).blob()) : file.uri;
    window.open(url, '_blank', 'noopener');
  } else if (/^https?:/i.test(file.uri)) {
    await Linking.openURL(file.uri);
  } else if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: file.contentType });
  }
}

export function FileViewer() {
  const [file, setFile] = useState<ViewerFile | null>(null);

  useEffect(() => {
    setViewerHost(setFile);
    return () => setViewerHost(null);
  }, []);

  if (!file) return null;
  const close = () => setFile(null);

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.bar}>
          <Text style={styles.title} numberOfLines={1}>
            {file.title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Open in another app" onPress={() => void openOutside(file)} style={styles.barButton}>
            <Ionicons name="open-outline" size={22} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.barButton}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        {isPdf(file.contentType) ? (
          <View style={styles.body}>
            <PdfView file={file} />
          </View>
        ) : (
          // Pinch to zoom works on iPhone; elsewhere the photo is fitted to the screen.
          <ScrollView style={styles.body} contentContainerStyle={styles.photoWrap} maximumZoomScale={5} minimumZoomScale={1} centerContent bouncesZoom>
            <Image source={{ uri: file.uri }} resizeMode="contain" style={styles.photo} accessibilityLabel="Receipt" />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#15171A' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 6, minHeight: 56 },
  title: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  barButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23 },
  body: { flex: 1 },
  photoWrap: { flexGrow: 1 },
  photo: { flex: 1, width: '100%', minHeight: 300 },
});
