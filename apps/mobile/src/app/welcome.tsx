import { parseAccessName } from '@lionrock/shared';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PasswordInput } from '../components/PasswordInput';
import { PinInput, isPin } from '../components/PinInput';
import { Button, Chip } from '../components/ui';
import { checkAccessName, claimAccessName, errorText, loginAccessName, staffLogin, type SignedIn } from '../lib/api';
import { setSetting } from '../lib/db';
import { useSession } from '../lib/session';
import { colors, radius, space } from '../lib/theme';

// First launch: "I have an access name" or "Staff sign in" (spec 8.2).
// A link name is protected by a PIN: the first person to use a name sets the
// PIN, and after that the name is not available to anyone else.
type Step = 'name' | 'create' | 'taken' | 'pin';

export default function Welcome() {
  const { setIdentity } = useSession();
  const { access } = useLocalSearchParams<{ access?: string }>();
  const [mode, setMode] = useState<'access' | 'staff'>('access');
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinAgain, setPinAgain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goTo = (next: Step) => {
    setStep(next);
    setPin('');
    setPinAgain('');
    setError(null);
  };

  /** Runs one server call with the busy state and the error line. */
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const enter = async (kind: 'access' | 'staff', signedIn: SignedIn) => {
    if (kind === 'access') await setSetting('profile_image', signedIn.profile_image ?? null);
    await setIdentity({ kind, name: signedIn.name, token: signedIn.token, role: signedIn.role });
    router.replace('/');
  };

  const checkName = useCallback(async (input: string) => {
    const parsed = parseAccessName(input);
    if (!parsed) {
      setError('Enter your access name, or paste your access link.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await checkAccessName(parsed);
      setName(result.name);
      if (result.status === 'disabled') setError('This access name is no longer active');
      else {
        setPin('');
        setPinAgain('');
        setStep(result.status === 'available' ? 'create' : 'taken');
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Opened from an access link: check that NAME straight away.
  useEffect(() => {
    if (access) {
      setName(access);
      void checkName(access);
    }
  }, [access, checkName]);

  const createPin = () => {
    if (!isPin(pin)) return setError('A PIN is 4 to 6 numbers.');
    if (pin !== pinAgain) return setError('The two PINs are not the same.');
    void run(async () => enter('access', await claimAccessName(name, pin)));
  };

  const signInWithPin = () => {
    if (!isPin(pin)) return setError('A PIN is 4 to 6 numbers.');
    void run(async () => enter('access', await loginAccessName(name, pin)));
  };

  const signInStaff = () => {
    if (!email.trim() || !password) return setError('Enter your email and password.');
    void run(async () => enter('staff', await staffLogin(email.trim(), password)));
  };

  const accessForm = () => {
    if (step === 'create') {
      return (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Set up your PIN</Text>
          <Text style={styles.hint}>
            You are setting up <Text style={styles.strong}>{name}</Text>. Choose a PIN of 4 to 6 numbers. You will need it to sign in again.
          </Text>
          <Text style={styles.label}>New PIN</Text>
          <PinInput value={pin} onChangeText={setPin} autoFocus />
          <Text style={styles.label}>Type the PIN again</Text>
          <PinInput value={pinAgain} onChangeText={setPinAgain} onSubmit={createPin} />
          <Button label="Save PIN and continue" size="large" busy={busy} onPress={createPin} />
          <Button label="Back" variant="secondary" onPress={() => goTo('name')} />
        </View>
      );
    }
    if (step === 'taken') {
      return (
        <View style={styles.form}>
          <Text style={styles.error} accessibilityRole="alert">
            This link is not available. Please use another name.
          </Text>
          <Text style={styles.hint}>
            <Text style={styles.strong}>{name}</Text> already belongs to someone and is protected by a PIN.
          </Text>
          <Button label="Use another name" size="large" onPress={() => goTo('name')} />
          <Button label="This is my link" variant="secondary" onPress={() => goTo('pin')} />
        </View>
      );
    }
    if (step === 'pin') {
      return (
        <View style={styles.form}>
          <Text style={styles.stepTitle}>Enter your PIN</Text>
          <Text style={styles.hint}>
            Signing in as <Text style={styles.strong}>{name}</Text>.
          </Text>
          <PinInput value={pin} onChangeText={setPin} onSubmit={signInWithPin} autoFocus />
          <Button label="Sign in" size="large" busy={busy} onPress={signInWithPin} />
          <Button label="Back" variant="secondary" onPress={() => goTo('name')} />
        </View>
      );
    }
    return (
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
          onSubmitEditing={() => void checkName(name)}
          style={styles.input}
        />
        <Text style={styles.hint}>You can also paste the whole link the office sent you.</Text>
        <Button label="Continue" size="large" busy={busy} onPress={() => void checkName(name)} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/logo.png')} style={styles.logo} accessibilityLabel="Lion Rock logo" />
          <Text style={styles.title}>Lionrock</Text>
          <Text style={styles.subtitle}>Receipts · Lion Rock Property Management</Text>

          {step === 'name' && (
            <View style={styles.chips}>
              <Chip label="I have an access name" selected={mode === 'access'} onPress={() => { setMode('access'); setError(null); }} />
              <Chip label="Staff sign in" selected={mode === 'staff'} onPress={() => { setMode('staff'); setError(null); }} />
            </View>
          )}

          {mode === 'access' ? (
            accessForm()
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
              <PasswordInput
                value={password}
                onChangeText={setPassword}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={signInStaff}
                style={styles.input}
              />
              <Text style={styles.hint}>Staff can see the receipts of everyone who uses the app.</Text>
              <Button label="Sign in" size="large" busy={busy} onPress={signInStaff} />
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
  logo: { width: 104, height: 104, marginBottom: space.sm, alignSelf: 'center' },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: -space.md, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  form: { gap: space.sm },
  stepTitle: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: space.sm, textAlign: 'center' },
  strong: { fontWeight: '700', color: colors.text },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: space.lg,
    minHeight: 52,
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
  },
  hint: { fontSize: 13, lineHeight: 19, color: colors.muted, marginBottom: space.sm, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center' },
});
