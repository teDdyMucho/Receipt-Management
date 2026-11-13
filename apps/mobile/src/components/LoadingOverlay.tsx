import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, space, type } from '../lib/theme';

// Full-screen loading state shown while a receipt is processed, saved and
// (from Phase 3) uploaded. `steps` are the stages in order; `current` is the
// index of the one in progress.

interface Props {
  visible: boolean;
  title: string;
  steps: string[];
  current: number;
  /** 0 to 1, when the real progress is known (file upload). Otherwise the steps drive the bar. */
  progress?: number;
}

export function LoadingOverlay({ visible, title, steps, current, progress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  // Gentle breathing animation on the logo while work is in progress.
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  const target = progress ?? (steps.length > 0 ? (current + 0.6) / steps.length : 0);
  useEffect(() => {
    if (!visible) {
      bar.setValue(0);
      return;
    }
    Animated.timing(bar, { toValue: Math.min(1, target), duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [visible, target, bar]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const width = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.backdrop} accessibilityRole="progressbar" accessibilityLabel={`${title}. ${steps[current] ?? ''}`}>
        <View style={styles.panel}>
          <Animated.View style={[styles.logoWrap, { transform: [{ scale }] }]}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} />
          </Animated.View>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width }]} />
          </View>
          {progress !== undefined && <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>}

          <View style={styles.steps}>
            {steps.map((label, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <View key={label} style={styles.step}>
                  {active ? (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.marker} />
                  ) : (
                    <View style={[styles.marker, styles.dot, done && styles.dotDone]}>
                      {done && <Text style={styles.check}>✓</Text>}
                    </View>
                  )}
                  <Text style={[styles.stepText, active && styles.stepActive, done && styles.stepDone]}>{label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.note}>Please keep the app open.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  panel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius + 8,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
    ...shadow,
  },
  logoWrap: { width: 72, height: 72 },
  logo: { width: 72, height: 72 },
  title: { ...type.title, textAlign: 'center' },
  track: { width: '100%', height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  percent: { ...type.small, fontWeight: '700', color: colors.text },
  steps: { alignSelf: 'stretch', gap: space.sm, marginTop: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  marker: { width: 22, height: 22 },
  dot: { borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.synced, borderColor: colors.synced },
  check: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  stepText: { fontSize: 15, color: colors.faint },
  stepActive: { color: colors.text, fontWeight: '600' },
  stepDone: { color: colors.muted },
  note: { ...type.small, marginTop: space.xs },
});
