import { parseAccessName } from '@lionrock/shared';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip } from '../components/ui';
import { DEMO_STAFF, hasApi, staffLogin, verifyAccessName } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, radius, space } from '../lib/theme';

// First launch: "I have an access name" or "Staff sign in" (spec 8.2).
export default function Welcome() {
  const { setIdentity } = useSession();
  const { access } = useLocalSearchParams<{ access?: string }>();
  const [mode, setMode] = useState<'access' | 'staff'>('access');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useAccessName = useCallback(
    async (input: string) => {
      const parsed = parseAccessName(input);
      if (!parsed) {
        setError('Enter your access name, or paste your access link.');
        return;
      }
      setBusy(true);
      setError(null);
      const result = await verifyAccessName(parsed);
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await setIdentity({ kind: 'access', name: parsed, verified: result.verified });
      router.replace('/');
    },
    [setIdentity],
  );

  // Opened from an access link: verify that NAME straight away.
  useEffect(() => {
    if (access) {
      setName(access);
      void useAccessName(access);
    }
  }, [access, useAccessName]);

  const signIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await staffLogin(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await setIdentity({ kind: 'staff', name: result.name, token: result.token, verified: hasApi });
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="Lion Rock logo" />
          <Text style={styles.title}>Receipts</Text>
          <Text style={styles.subtitle}>Lion Rock Property Management</Text>

          <View style={styles.chips}>
            <Chip label="I have an access name" selected={mode === 'access'} onPress={() => { setMode('access'); setError(null); }} />
            <Chip label="Staff sign in" selected={mode === 'staff'} onPress={() => { setMode('staff'); setError(null); }} />
          </View>

          {mode === 'access' ? (
            <View style={styles.form}>
              <Text style={styles.label}>Access name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="The name from your link"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => void useAccessName(name)}
                style={styles.input}
              />
              <Text style={styles.hint}>You can also paste the whole link the office sent you.</Text>
              <Button label="Continue" size="large" busy={busy} onPress={() => void useAccessName(name)} />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                style={styles.input}
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void signIn()}
                style={styles.input}
              />
              {!hasApi && (
                <Text style={styles.hint}>
                  Preview (no server): {DEMO_STAFF.email} / {DEMO_STAFF.password}
                </Text>
              )}
              <Button label="Sign in" size="large" busy={busy} onPress={() => void signIn()} />
            </View>
          )}

          {!!error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg, flexGrow: 1, justifyContent: 'center' },
  logo: { width: 88, height: 88, marginBottom: space.sm },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: -space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  form: { gap: space.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: space.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    minHeight: 52,
    fontSize: 17,
    color: colors.text,
  },
  hint: { fontSize: 13, color: colors.muted, marginBottom: space.sm },
  error: { color: colors.danger, fontSize: 15 },
});
