import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { colors, radius, space } from '../lib/theme';

// One hidden number box for a PIN (4 to 6 numbers).

export const isPin = (value: string) => /^\d{4,6}$/.test(value);

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  label?: string;
}

export function PinInput({ value, onChangeText, onSubmit, autoFocus, label = 'PIN' }: Props) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 6))}
      keyboardType="number-pad"
      inputMode="numeric"
      secureTextEntry
      maxLength={6}
      autoFocus={autoFocus}
      placeholder="••••"
      placeholderTextColor={colors.faint}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      accessibilityLabel={label}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    minHeight: 52,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.text,
  },
});
