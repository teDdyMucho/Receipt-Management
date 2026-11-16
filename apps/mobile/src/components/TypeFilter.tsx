import { RECEIPT_TYPES, typeColour } from '@lionrock/shared';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, typeTints } from '../lib/theme';

// The coloured Type filter from the office screen: Renovation, Turn Over, Work Order, Other, All.

export type TypeChoice = 'all' | 'renovation' | 'turn_over' | 'work_order' | 'other';

const CHOICES: { value: TypeChoice; label: string; colour: keyof typeof typeTints | null }[] = [
  ...RECEIPT_TYPES.map((t) => ({ value: t.value as TypeChoice, label: t.label, colour: t.colour as keyof typeof typeTints })),
  { value: 'other', label: 'Other', colour: 'slate' },
  { value: 'all', label: 'All', colour: null },
];

/** "Other" is every receipt whose type is not one of the three named ones. */
export function matchesType(type: string | null | undefined, choice: TypeChoice): boolean {
  if (choice === 'all') return true;
  const known = RECEIPT_TYPES.some((t) => t.value === type);
  return choice === 'other' ? !known : type === choice;
}

/** Card background for a receipt of this type; plain white until a type is chosen. */
export function typeCardColour(type: string | null | undefined): string {
  return type ? typeTints[typeColour(type)].bg : colors.card;
}

export function TypeFilter({ value, onChange }: { value: TypeChoice; onChange: (next: TypeChoice) => void }) {
  return (
    <View style={styles.row}>
      {CHOICES.map((choice) => {
        const selected = value === choice.value;
        const tint = choice.colour ? typeTints[choice.colour] : null;
        const background = selected ? (tint?.solid ?? colors.primary) : (tint?.bg ?? colors.card);
        const border = selected ? background : (tint?.border ?? colors.border);
        const text = selected ? '#FFFFFF' : (tint?.text ?? colors.text);
        return (
          <Pressable
            key={choice.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${choice.label}`}
            onPress={() => onChange(choice.value)}
            style={[styles.chip, { backgroundColor: background, borderColor: border }]}
          >
            <Text style={[styles.text, { color: text }]}>{choice.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Small enough that all five fit on one line of a narrow phone.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: space.sm, minHeight: 32, justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
  text: { fontSize: 12, fontWeight: '600' },
});
