import DateTimePicker from '@react-native-community/datetimepicker';
import { RECEIPT_TYPES, formatReceiptDate, needsWorkOrder, validateDetails, type ReceiptDetails } from '@lionrock/shared';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip } from '../../components/ui';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { getReceipt, saveDetails } from '../../lib/db';
import { extractAndStore } from '../../lib/extract';
import { syncReceipt } from '../../lib/sync';
import { colors, radius, space } from '../../lib/theme';

// Receipt Data wizard (spec 8.4): one field per step, Back / Next / Done, plus Later.
type TypeKey = 'renovation' | 'turn_over' | 'work_order' | 'other';
type Step = 'type' | 'date' | 'total' | 'work_order' | 'address' | 'review';

const TYPE_CHOICES: { key: TypeKey; label: string }[] = [
  ...RECEIPT_TYPES.map((t) => ({ key: t.value as TypeKey, label: t.label })),
  { key: 'other', label: 'Other' },
];

function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fromIsoDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}

export default function Wizard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState(false);
  const [typeKey, setTypeKey] = useState<TypeKey>('work_order');
  const [typeOther, setTypeOther] = useState('');
  const [date, setDate] = useState('');
  const [total, setTotal] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [address, setAddress] = useState('');
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [stepIndex, setStepIndex] = useState(0);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reading, setReading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Pre-fill from saved details first, then from AI extraction. A receipt that
  // has not been read by AI yet is read here, whichever way the wizard was opened.
  useEffect(() => {
    void (async () => {
      let receipt = await getReceipt(id);
      if (receipt && !receipt.extracted && !receipt.details_confirmed) {
        setReading(true);
        const outcome = await extractAndStore(id);
        setReading(false);
        setAiNote(
          outcome.reason ??
            (outcome.fields && Object.values(outcome.fields).every((v) => v === null)
              ? 'AI could not find any details on this receipt. Please type them in.'
              : null),
        );
        receipt = await getReceipt(id);
      }
      if (receipt) {
        const d = receipt.details;
        const ai = receipt.extracted;
        const fromAi = new Set<string>();
        const pick = (key: 'receipt_date' | 'total' | 'work_order' | 'tenant_address') => {
          if (d[key]) return d[key] as string;
          if (ai?.[key]) {
            fromAi.add(key);
            return ai[key] as string;
          }
          return '';
        };
        if (d.type) {
          const known = RECEIPT_TYPES.some((t) => t.value === d.type);
          setTypeKey(known ? (d.type as TypeKey) : 'other');
          if (!known) setTypeOther(d.type_other || d.type);
        }
        setDate(pick('receipt_date').slice(0, 10));
        setTotal(pick('total').replace(/^\$/, ''));
        setWorkOrder(pick('work_order'));
        setAddress(pick('tenant_address'));
        setSuggested(fromAi);
      }
      setLoaded(true);
    })();
  }, [id, attempt]);

  const isOther = typeKey === 'other';
  const steps = useMemo<Step[]>(
    () => (needsWorkOrder(typeKey) ? ['type', 'date', 'total', 'work_order', 'address', 'review'] : ['type', 'date', 'total', 'address', 'review']),
    [typeKey],
  );
  const step = steps[Math.min(stepIndex, steps.length - 1)] as Step;

  const details = (): ReceiptDetails => ({
    type: isOther ? typeOther.trim() : typeKey,
    type_other: isOther ? typeOther.trim() : null,
    receipt_date: date || null,
    total: total.trim() || null,
    work_order: needsWorkOrder(typeKey) ? workOrder.trim() || null : null,
    tenant_address: address.trim() || null,
  });

  const errors = validateDetails(details(), isOther);
  const stepError: Record<Step, string | undefined> = {
    type: errors.type ?? errors.type_other,
    date: errors.receipt_date,
    total: errors.total,
    work_order: errors.work_order,
    address: errors.tenant_address,
    review: Object.values(errors)[0],
  };

  const next = () => {
    if (stepError[step]) return setError(stepError[step] ?? null);
    setError(null);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const back = () => {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };
  const done = async () => {
    if (stepError.review) return setError(stepError.review ?? null);
    await saveDetails(id, details(), true);
    void syncReceipt(id);
    router.back();
  };
  // Later keeps whatever was typed, unconfirmed. The file upload never waits for this.
  const later = async () => {
    await saveDetails(id, details(), false);
    void syncReceipt(id);
    router.back();
  };

  const aiHint = (key: string) => (suggested.has(key) ? <Text style={styles.ai}>Suggested by AI</Text> : null);

  if (!loaded) {
    return (
      <View style={styles.screen}>
        <LoadingOverlay visible={reading} title="Reading your receipt" steps={['Reading the receipt with AI', 'Filling in the details']} current={0} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!!aiNote && (
          <View style={styles.aiNote} accessibilityRole="alert">
            <Text style={styles.aiNoteText}>{aiNote}</Text>
            <Button
              label="Try AI again"
              size="small"
              variant="secondary"
              onPress={() => {
                setLoaded(false);
                setAiNote(null);
                setAttempt((n) => n + 1);
              }}
            />
          </View>
        )}
        {suggested.size > 0 && !aiNote && (
          <Text style={styles.aiBanner}>AI filled in {suggested.size} of 4 details. Check each step, then tap Done.</Text>
        )}
        <Text style={styles.progress}>
          Step {stepIndex + 1} of {steps.length}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
        </View>

        {step === 'type' && (
          <View style={styles.block}>
            <Text style={styles.title}>Type</Text>
            <View style={styles.chips}>
              {TYPE_CHOICES.map((t) => (
                <Chip key={t.key} label={t.label} selected={typeKey === t.key} onPress={() => setTypeKey(t.key)} />
              ))}
            </View>
            {isOther && (
              <TextInput
                value={typeOther}
                onChangeText={setTypeOther}
                placeholder="Label for Other"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoFocus
              />
            )}
          </View>
        )}

        {step === 'date' && (
          <View style={styles.block}>
            <Text style={styles.title}>Receipt Date</Text>
            {aiHint('receipt_date')}
            <Text style={styles.value}>{date ? formatReceiptDate(date) : 'No date chosen'}</Text>
            {Platform.OS === 'web' &&
              React.createElement('input', {
                type: 'date',
                value: date,
                max: toIsoDate(new Date()),
                'aria-label': 'Receipt Date',
                style: { fontSize: 20, padding: 12, borderRadius: 12, border: '1px solid #E5E7EB' },
                onChange: (e: { target: { value: string } }) => setDate(e.target.value),
              })}
            {Platform.OS === 'android' && <Button label="Choose date" variant="secondary" onPress={() => setShowAndroidPicker(true)} />}
            {(Platform.OS === 'ios' || (Platform.OS === 'android' && showAndroidPicker)) && (
              <DateTimePicker
                value={date ? fromIsoDate(date) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                onValueChange={(_event, picked) => {
                  setShowAndroidPicker(false);
                  setDate(toIsoDate(picked));
                }}
                onDismiss={() => setShowAndroidPicker(false)}
              />
            )}
          </View>
        )}

        {step === 'total' && (
          <View style={styles.block}>
            <Text style={styles.title}>Total</Text>
            {aiHint('total')}
            <TextInput
              value={total}
              onChangeText={(t) => setTotal(t.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.input}
              autoFocus
            />
          </View>
        )}

        {step === 'work_order' && (
          <View style={styles.block}>
            <Text style={styles.title}>Work order</Text>
            {aiHint('work_order')}
            <TextInput value={workOrder} onChangeText={setWorkOrder} style={styles.input} autoCapitalize="characters" autoCorrect={false} autoFocus />
          </View>
        )}

        {step === 'address' && (
          <View style={styles.block}>
            <Text style={styles.title}>Tenant Address</Text>
            {aiHint('tenant_address')}
            <TextInput value={address} onChangeText={setAddress} style={[styles.input, styles.multiline]} multiline autoFocus />
          </View>
        )}

        {step === 'review' && (
          <View style={styles.block}>
            <Text style={styles.title}>Review</Text>
            <ReviewRow label="Type" value={isOther ? typeOther : TYPE_CHOICES.find((t) => t.key === typeKey)?.label} />
            <ReviewRow label="Receipt Date" value={date ? formatReceiptDate(date) : ''} />
            <ReviewRow label="Total" value={total ? `$${total}` : ''} />
            {needsWorkOrder(typeKey) && <ReviewRow label="Work order" value={workOrder} />}
            <ReviewRow label="Tenant Address" value={address} />
          </View>
        )}

        {!!error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.row}>
          <Button label="Back" variant="secondary" style={styles.flex} disabled={stepIndex === 0} onPress={back} />
          {step === 'review' ? (
            <Button label="Done" style={styles.flex} onPress={() => void done()} />
          ) : (
            <Button label="Next" style={styles.flex} onPress={next} />
          )}
        </View>
        <Button label="Later" variant="secondary" size="small" onPress={() => void later()} />
      </View>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, !value && { color: colors.danger }]}>{value || 'Missing'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  aiNote: { backgroundColor: colors.offlineBg, borderRadius: radius, padding: space.md, gap: space.sm },
  aiNoteText: { color: colors.offlineText, fontSize: 14, lineHeight: 20 },
  aiBanner: { backgroundColor: colors.needsDetailsBg, color: colors.needsDetails, borderRadius: radius, padding: space.md, fontSize: 14, fontWeight: '600' },
  progress: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginBottom: space.md },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  block: { gap: space.md },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  ai: { fontSize: 13, color: colors.needsDetails, fontWeight: '600', marginTop: -space.sm },
  value: { fontSize: 20, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    minHeight: 56,
    fontSize: 20,
    color: colors.text,
  },
  multiline: { minHeight: 100, paddingVertical: space.md, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 15 },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewLabel: { fontSize: 15, color: colors.muted },
  reviewValue: { flex: 1, fontSize: 15, color: colors.text, textAlign: 'right', fontWeight: '500' },
});
