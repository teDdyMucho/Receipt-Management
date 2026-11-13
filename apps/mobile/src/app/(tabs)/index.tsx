import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { Button, Card, OfflineBanner, type IconName } from '../../components/ui';
import { SAVE_STEPS, saveReceiptLocally, type PickedFile } from '../../lib/capture';
import { confirm, showMessage } from '../../lib/dialog';
import { useSession } from '../../lib/session';
import { colors, radius, shadow, space, type } from '../../lib/theme';

// Scan (spec 8.3): take a picture, choose from the library or pick a PDF,
// preview with Rotate and Retake, then Save receipt. Saving never needs a
// connection: the receipt is on this phone before any network call.

/** The loading screen stays up at least this long so it never just flashes. */
const MIN_LOADING_MS = 900;

export default function Scan() {
  const { identity, online, receipts } = useSession();
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);

  const waiting = receipts.filter((r) => r.sync_status !== 'synced').length;

  const reset = () => {
    setPicked(null);
    setRotation(0);
    setSavedId(null);
  };

  const permissionDenied = async (what: string) => {
    const open = await confirm({
      title: `${what} access is off`,
      message: `Turn on ${what.toLowerCase()} access for Receipts in Settings.`,
      confirmLabel: 'Open Settings',
    });
    if (open) void Linking.openSettings();
  };

  // Permissions are asked only here, the first time the user taps the button.
  const takePicture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return permissionDenied('Camera');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
    const asset = result.assets?.[0];
    if (asset) {
      reset();
      setPicked({ uri: asset.uri, kind: 'image', width: asset.width, height: asset.height, fromCamera: true });
    }
  };

  const chooseFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
    const asset = result.assets?.[0];
    if (asset) {
      reset();
      setPicked({ uri: asset.uri, kind: 'image', width: asset.width, height: asset.height, fromCamera: false });
    }
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    const asset = result.assets?.[0];
    if (asset) {
      reset();
      setPicked({ uri: asset.uri, kind: 'pdf', width: 0, height: 0, fromCamera: false, fileName: asset.name });
    }
  };

  const save = async () => {
    if (!picked || !identity) return;
    setStep(0);
    setSaving(true);
    const started = Date.now();
    try {
      const id = await saveReceiptLocally(picked, identity.name, rotation, setStep);
      const remaining = MIN_LOADING_MS - (Date.now() - started);
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      setSavedId(id);
      setSaving(false);
      router.push({ pathname: '/wizard/[id]', params: { id } });
    } catch (e) {
      setSaving(false);
      showMessage('Could not save the receipt', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <LoadingOverlay visible={saving} title="Saving your receipt" steps={SAVE_STEPS} current={step} />

      {!online && <OfflineBanner />}

      {!picked && (
        <>
          <View style={styles.hero}>
            <Image source={require('../../../assets/logo.png')} style={styles.logo} accessibilityLabel="Lion Rock logo" />
            <View style={styles.heroText}>
              <Text style={styles.heroLabel}>Scanning as</Text>
              <Text style={styles.heroName} numberOfLines={1}>
                {identity?.name}
              </Text>
            </View>
            {waiting > 0 && (
              <View style={styles.waiting}>
                <Text style={styles.waitingText}>{waiting} waiting</Text>
              </View>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take a picture"
            onPress={() => void takePicture()}
            style={({ pressed }) => [styles.primaryTile, pressed && styles.pressed]}
          >
            <View style={styles.cameraCircle}>
              <Ionicons name="camera" size={34} color={colors.primary} />
            </View>
            <Text style={styles.primaryTitle}>Take a picture</Text>
            <Text style={styles.primaryHint}>Lay the receipt flat and fill the frame</Text>
          </Pressable>

          <View style={styles.row}>
            <Tile icon="images" label="Choose from library" onPress={() => void chooseFromLibrary()} />
            <Tile icon="document-text" label="Pick a PDF" onPress={() => void pickPdf()} />
          </View>
        </>
      )}

      {picked && (
        <>
          <View style={styles.previewFrame}>
            {picked.kind === 'image' ? (
              <Image
                source={{ uri: picked.uri }}
                resizeMode="contain"
                style={[styles.preview, { transform: [{ rotate: `${rotation}deg` }] }]}
                accessibilityLabel="Receipt preview"
              />
            ) : (
              <View style={styles.pdf}>
                <Ionicons name="document-text" size={56} color={colors.muted} />
                <Text style={styles.pdfName}>{picked.fileName ?? 'receipt.pdf'}</Text>
              </View>
            )}
          </View>

          {savedId ? (
            <>
              <Card style={styles.status}>
                <Ionicons name="checkmark-circle" size={30} color={colors.synced} />
                <View style={styles.heroText}>
                  <Text style={styles.statusTitle}>Saved on this phone</Text>
                  <Text style={styles.statusText}>
                    {online
                      ? 'It is in your Uploads list and goes to the office after you finish the details.'
                      : 'It will upload automatically when the connection is back.'}
                  </Text>
                </View>
              </Card>
              <Button label="Scan another receipt" size="large" icon="camera" onPress={reset} />
            </>
          ) : (
            <>
              <View style={styles.row}>
                {picked.kind === 'image' && (
                  <Button label="Rotate" icon="refresh" variant="secondary" style={styles.flex} onPress={() => setRotation((r) => (r + 90) % 360)} />
                )}
                <Button label="Retake" icon="arrow-undo" variant="secondary" style={styles.flex} onPress={reset} />
              </View>
              <Button label="Save receipt" size="large" icon="checkmark" busy={saving} onPress={() => void save()} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Tile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={26} color={colors.text} />
      <Text style={styles.tileText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, flexGrow: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 48, height: 48 },
  heroText: { flex: 1 },
  heroLabel: { ...type.small },
  heroName: { ...type.title },
  waiting: { backgroundColor: colors.pendingBg, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: 14 },
  waitingText: { color: colors.pending, fontSize: 13, fontWeight: '700' },
  primaryTile: {
    backgroundColor: colors.primary,
    borderRadius: radius + 8,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.sm,
    ...shadow,
  },
  cameraCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  primaryTitle: { color: colors.primaryText, fontSize: 22, fontWeight: '700' },
  primaryHint: { color: '#C9CCD1', fontSize: 14 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: space.lg,
    minHeight: 104,
    justifyContent: 'space-between',
    ...shadow,
  },
  tileText: { fontSize: 15, fontWeight: '600', color: colors.text },
  previewFrame: { backgroundColor: colors.card, borderRadius: radius, padding: space.sm, overflow: 'hidden', ...shadow },
  preview: { width: '100%', height: 380, borderRadius: radius - 6 },
  pdf: { alignItems: 'center', justifyContent: 'center', height: 240, gap: space.md },
  pdfName: { fontSize: 15, color: colors.text, textAlign: 'center', fontWeight: '500' },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.syncedBg },
  statusTitle: { ...type.heading },
  statusText: { ...type.small, color: colors.text, marginTop: 2 },
});
