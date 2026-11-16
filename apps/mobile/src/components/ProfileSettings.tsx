import { Ionicons } from '@expo/vector-icons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { changePin, errorText, getProfile, setProfileImage } from '../lib/api';
import { getSetting, setSetting } from '../lib/db';
import { confirm, showMessage } from '../lib/dialog';
import { useSession } from '../lib/session';
import { colors, space } from '../lib/theme';
import { PinInput, isPin } from './PinInput';
import { ThisPhoneCard } from './ThisPhoneCard';
import { Button, Card, SectionTitle } from './ui';

// Settings for someone signed in with a link name: their own profile only.
// The link name is shown but cannot be changed.
const PICTURE_SIZE = 256;

export function ProfileSettings() {
  const { identity, receipts, signOut } = useSession();
  const [picture, setPicture] = useState<string | null>(null);
  const [savingPicture, setSavingPicture] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        // Show the saved picture straight away, then refresh it from the server.
        setPicture(await getSetting('profile_image'));
        try {
          const profile = await getProfile();
          setPicture(profile.profile_image);
          await setSetting('profile_image', profile.profile_image);
        } catch {
          // Offline: the saved picture stays.
        }
      })();
    }, []),
  );

  const savePicture = async (image: string | null) => {
    setSavingPicture(true);
    try {
      const saved = await setProfileImage(image);
      setPicture(saved.profile_image);
      await setSetting('profile_image', saved.profile_image);
    } catch (e) {
      showMessage('Picture not saved', errorText(e));
    } finally {
      setSavingPicture(false);
    }
  };

  const choosePicture = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    const small = await ImageManipulator.manipulate(asset.uri).resize({ width: PICTURE_SIZE }).renderAsync();
    const saved = await small.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    if (!saved.base64) return showMessage('Picture not saved', 'That picture cannot be used. Choose another one.');
    await savePicture(`data:image/jpeg;base64,${saved.base64.replace(/^data:[^,]+,/, '')}`);
  };

  const closePin = () => {
    setChangingPin(false);
    setCurrent('');
    setNext('');
    setAgain('');
    setPinError(null);
  };

  const savePin = async () => {
    if (!current) return setPinError('Enter your current PIN.');
    if (!isPin(next)) return setPinError('A new PIN is 4 to 6 numbers.');
    if (next !== again) return setPinError('The two new PINs are not the same.');
    if (next === current) return setPinError('The new PIN is the same as the current one.');
    setSavingPin(true);
    setPinError(null);
    try {
      await changePin(current, next);
      closePin();
      showMessage('PIN changed', 'Use your new PIN the next time you sign in.');
    } catch (e) {
      setPinError(errorText(e));
    } finally {
      setSavingPin(false);
    }
  };

  const waiting = receipts.filter((r) => r.sync_status !== 'synced').length;
  const leave = () => {
    const message =
      waiting > 0
        ? `${waiting} receipt${waiting === 1 ? ' is' : 's are'} still waiting to upload. They stay on this phone and upload when you sign in again with this name.`
        : 'You will need your link name and PIN to sign in again.';
    void confirm({ title: 'Sign out?', message, confirmLabel: 'Sign out', destructive: true, icon: 'log-out-outline' }).then(async (ok) => {
      if (!ok) return;
      await setSetting('profile_image', null);
      await signOut();
      router.replace('/welcome');
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle>Profile</SectionTitle>
      <Card style={styles.card}>
        <View style={styles.profile}>
          {/* The picture itself is the button: tap it to add or change the picture. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={picture ? 'Change profile picture' : 'Add a profile picture'}
            disabled={savingPicture}
            onPress={() => void choosePicture()}
          >
            <View style={styles.avatar}>
              {picture ? <Image source={{ uri: picture }} style={styles.avatarImage} /> : <Ionicons name="person" size={40} color={colors.faint} />}
              {savingPicture && (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator color={colors.primaryText} />
                </View>
              )}
            </View>
            <View style={styles.badge}>
              <Ionicons name="camera" size={15} color={colors.primaryText} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Your link</Text>
            <Text style={styles.value}>{identity?.name}</Text>
            <Text style={styles.note}>The link name cannot be changed.</Text>
          </View>
        </View>
        <Text style={styles.note}>Tap the picture to {picture ? 'change it' : 'add your photo'}.</Text>
        {picture && !savingPicture && (
          <Pressable accessibilityRole="button" onPress={() => void savePicture(null)}>
            <Text style={styles.link}>Remove picture</Text>
          </Pressable>
        )}
      </Card>

      <SectionTitle>PIN</SectionTitle>
      <Card style={styles.card}>
        {changingPin ? (
          <>
            <Text style={styles.field}>Current PIN</Text>
            <PinInput value={current} onChangeText={setCurrent} label="Current PIN" autoFocus />
            <Text style={styles.field}>New PIN</Text>
            <PinInput value={next} onChangeText={setNext} label="New PIN" />
            <Text style={styles.field}>Type the new PIN again</Text>
            <PinInput value={again} onChangeText={setAgain} label="New PIN again" onSubmit={() => void savePin()} />
            {!!pinError && (
              <Text style={styles.error} accessibilityRole="alert">
                {pinError}
              </Text>
            )}
            <Button label="Save new PIN" icon="checkmark" busy={savingPin} onPress={() => void savePin()} />
            <Button label="Cancel" variant="secondary" onPress={closePin} />
          </>
        ) : (
          <>
            <View style={styles.pinRow}>
              <Ionicons name="lock-closed" size={20} color={colors.accent} />
              <Text style={styles.pinText}>Your PIN protects this link.</Text>
              <Text style={styles.pinDots}>••••</Text>
            </View>
            <Button label="Change PIN" icon="key-outline" variant="secondary" onPress={() => setChangingPin(true)} />
          </>
        )}
      </Card>

      <ThisPhoneCard />

      <Button label="Sign out" icon="log-out-outline" variant="secondary" onPress={leave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg },
  card: { gap: space.md },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 84, height: 84 },
  avatarBusy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { fontSize: 14, fontWeight: '600', color: colors.danger },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pinText: { flex: 1, fontSize: 15, color: colors.text },
  pinDots: { fontSize: 20, letterSpacing: 4, color: colors.muted },
  label: { fontSize: 13, color: colors.muted },
  value: { fontSize: 22, fontWeight: '700', color: colors.text },
  note: { fontSize: 13, color: colors.muted },
  field: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: -space.xs },
  error: { color: colors.danger, fontSize: 14 },
});
