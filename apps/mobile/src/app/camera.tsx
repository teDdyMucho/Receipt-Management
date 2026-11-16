import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { setCaptured, type CapturedPhoto } from '../lib/captured';
import { showMessage } from '../lib/dialog';

// The camera, full screen. While aiming there is only the round shutter button.
// After the shot the photo is shown with two buttons: X takes it again, the
// check mark uses it and goes back to Scan.
export default function Camera() {
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);

  // Ask for the camera the first time this screen opens.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const shoot = async () => {
    if (!camera.current || shooting) return;
    setShooting(true);
    try {
      const shot = await camera.current.takePictureAsync({ quality: 1 });
      setPhoto({ uri: shot.uri, width: shot.width, height: shot.height });
    } catch {
      showMessage('Could not take the picture', 'Please try again.');
    } finally {
      setShooting(false);
    }
  };

  const usePhoto = () => {
    if (!photo) return;
    setCaptured(photo);
    router.back();
  };

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
        <Text style={styles.message}>Lionrock needs the camera to photograph receipts.</Text>
        <Button
          label={permission.canAskAgain ? 'Allow the camera' : 'Open Settings'}
          onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
          style={styles.wide}
        />
        <Button label="Back" variant="secondary" onPress={() => router.back()} style={styles.wide} />
      </SafeAreaView>
    );
  }

  if (photo) {
    return (
      <SafeAreaView style={styles.screen}>
        <Image source={{ uri: photo.uri }} resizeMode="contain" style={styles.fill} accessibilityLabel="The picture you took" />
        <View style={styles.bar}>
          <RoundButton icon="close" label="Take the picture again" color="#C8322B" onPress={() => setPhoto(null)} />
          <RoundButton icon="checkmark" label="Use this picture" color="#15803D" onPress={usePhoto} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <CameraView ref={camera} style={styles.fill} facing="back" onCameraReady={() => setReady(true)} />
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take the picture"
          disabled={!ready || shooting}
          onPress={() => void shoot()}
          style={({ pressed }) => [styles.shutter, (pressed || shooting) && { opacity: 0.6 }]}
        >
          {shooting ? <ActivityIndicator color="#15171A" /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
      {/* Small and out of the way: the only way out without taking a picture. */}
      <Pressable accessibilityRole="button" accessibilityLabel="Close the camera" onPress={() => router.back()} hitSlop={10} style={styles.close}>
        <Ionicons name="chevron-down" size={26} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}

interface RoundButtonProps {
  icon: 'close' | 'checkmark';
  label: string;
  color: string;
  onPress: () => void;
}

function RoundButton({ icon, label, color, onPress }: RoundButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { backgroundColor: color }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={38} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  message: { color: '#FFFFFF', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  wide: { alignSelf: 'stretch' },
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 24, backgroundColor: '#000000' },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  round: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 44, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
