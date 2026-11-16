import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { colors } from '../lib/theme';

// A password box with an eye button that shows or hides what was typed.

interface Props extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  /** The same style the screen gives its other text boxes. */
  style?: StyleProp<TextStyle>;
}

const EYE_WIDTH = 48;

export function PasswordInput({ style, ...input }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <View>
      {/* Equal space on both sides keeps centred text centred under the eye button. */}
      <TextInput {...input} secureTextEntry={!shown} autoCapitalize="none" autoCorrect={false} style={[style, styles.input]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={shown ? 'Hide password' : 'Show password'}
        onPress={() => setShown((s) => !s)}
        hitSlop={6}
        style={styles.eye}
      >
        <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { paddingHorizontal: EYE_WIDTH },
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, width: EYE_WIDTH, alignItems: 'center', justifyContent: 'center' },
});
