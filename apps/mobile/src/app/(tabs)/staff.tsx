import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PasswordInput } from '../../components/PasswordInput';
import { Button, Card, Chip, SectionTitle } from '../../components/ui';
import { createStaff, errorText, listStaff, setStaffPassword, type StaffAccount } from '../../lib/api';
import { showMessage } from '../../lib/dialog';
import { useSession } from '../../lib/session';
import { colors, space } from '../../lib/theme';

// Admin only: make staff accounts and reset their passwords.
const MIN_PASSWORD = 8;

export default function Staff() {
  const { identity } = useSession();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // The account whose password is being reset, and the new password typed for it.
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStaff((await listStaff()).staff);
      setListError(null);
    } catch (e) {
      setListError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (identity?.kind !== 'staff' || identity.role !== 'admin') return <Redirect href="/" />;

  const create = async () => {
    if (!name.trim()) return setFormError("Enter the person's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setFormError('Enter a valid email address.');
    if (password.length < MIN_PASSWORD) return setFormError(`A password needs at least ${MIN_PASSWORD} characters.`);
    setSaving(true);
    setFormError(null);
    try {
      await createStaff({ name: name.trim(), email: email.trim(), password, role });
      showMessage('Account created', `${name.trim()} can now sign in with ${email.trim().toLowerCase()} and the password you set.`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('user');
      await load();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const saveReset = async (account: StaffAccount) => {
    if (resetPassword.length < MIN_PASSWORD) return showMessage('Password too short', `A password needs at least ${MIN_PASSWORD} characters.`);
    setResetting(true);
    try {
      await setStaffPassword(account.id, resetPassword);
      setResetId(null);
      setResetPassword('');
      showMessage('Password changed', `${account.user_name || account.email} must use the new password from now on.`);
    } catch (e) {
      showMessage('Password not changed', errorText(e));
    } finally {
      setResetting(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <SectionTitle>New staff account</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.faint} style={styles.input} />
        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor={colors.faint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD} characters`}
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
        <Text style={styles.label}>Can this person manage staff accounts?</Text>
        <View style={styles.chips}>
          <Chip label="No, staff only" selected={role === 'user'} onPress={() => setRole('user')} />
          <Chip label="Yes, admin" selected={role === 'admin'} onPress={() => setRole('admin')} />
        </View>
        {!!formError && (
          <Text style={styles.error} accessibilityRole="alert">
            {formError}
          </Text>
        )}
        <Button label="Create account" icon="person-add-outline" busy={saving} onPress={() => void create()} />
      </Card>

      <SectionTitle>{`Staff accounts (${staff.length})`}</SectionTitle>
      {!!listError && (
        <Text style={styles.error} accessibilityRole="alert">
          {listError}
        </Text>
      )}
      {staff.map((account) => (
        <Card key={account.id} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Ionicons name={account.role === 'admin' ? 'shield-checkmark' : 'person'} size={20} color={account.role === 'admin' ? colors.accent : colors.faint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{account.user_name || account.email}</Text>
              <Text style={styles.email}>{account.email}</Text>
            </View>
            <Text style={[styles.role, account.role === 'admin' && { color: colors.accent, backgroundColor: colors.accentBg }]}>
              {account.role === 'admin' ? 'Admin' : 'Staff'}
            </Text>
          </View>
          {resetId === account.id ? (
            <>
              <PasswordInput
                value={resetPassword}
                onChangeText={setResetPassword}
                placeholder={`New password, at least ${MIN_PASSWORD} characters`}
                placeholderTextColor={colors.faint}
                autoFocus
                style={styles.input}
              />
              <View style={styles.chips}>
                <Button label="Cancel" size="small" variant="secondary" onPress={() => setResetId(null)} style={{ flex: 1 }} />
                <Button label="Save password" size="small" busy={resetting} onPress={() => void saveReset(account)} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <Button
              label="Change password"
              icon="key-outline"
              size="small"
              variant="secondary"
              onPress={() => {
                setResetId(account.id);
                setResetPassword('');
              }}
            />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg },
  card: { gap: space.sm },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: space.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: space.md, minHeight: 48, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  error: { color: colors.danger, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.muted },
  role: { fontSize: 12, fontWeight: '700', color: colors.muted, backgroundColor: colors.bg, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
});
