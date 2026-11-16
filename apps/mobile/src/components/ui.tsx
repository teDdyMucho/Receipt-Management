import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space, type } from '../lib/theme';

// Shared building blocks: Button, Chip, Card, SectionTitle, OfflineBanner, EmptyState.

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'large' | 'normal' | 'small';
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', size = 'normal', icon, disabled, busy, style }: ButtonProps) {
  const inactive = disabled || busy;
  const textColor = variant === 'primary' ? colors.primaryText : variant === 'danger' ? colors.danger : colors.text;
  const fontSize = size === 'large' ? 17 : size === 'small' ? 14 : 16;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[size],
        variant === 'primary' ? styles.primary : styles.outline,
        variant === 'danger' && { borderColor: colors.failedBg, backgroundColor: colors.failedBg },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        inactive && { opacity: 0.5 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={fontSize + 3} color={textColor} />}
          <Text style={[styles.buttonText, { color: textColor, fontSize }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, small }: { label: string; selected: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, small && styles.chipSmall, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, small && { fontSize: 12 }, selected && { color: colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function OfflineBanner() {
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Ionicons name="cloud-offline" size={20} color={colors.offlineText} />
      <Text style={styles.offlineText}>
        No connection. Receipts are saved on this phone and will upload automatically.
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius,
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  large: { minHeight: 58 },
  normal: { minHeight: 50 },
  small: { minHeight: 38, paddingHorizontal: space.md, borderRadius: 12 },
  primary: { backgroundColor: colors.primary, ...shadow },
  outline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontWeight: '600' },
  chip: {
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSmall: { paddingHorizontal: space.sm, minHeight: 32, borderRadius: 16 },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: space.lg, ...shadow },
  section: { ...type.label, marginBottom: -space.sm, marginLeft: space.xs },
  offline: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    backgroundColor: colors.offlineBg,
    padding: space.md,
    borderRadius: radius,
  },
  offlineText: { flex: 1, color: colors.offlineText, fontSize: 14, lineHeight: 20 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl * 1.5, paddingHorizontal: space.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
    ...shadow,
  },
  emptyTitle: { ...type.heading, textAlign: 'center' },
  emptyText: { ...type.small, fontSize: 14, textAlign: 'center' },
});
