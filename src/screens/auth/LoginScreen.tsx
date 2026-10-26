import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Pressable } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import { phoneToEmail, normalizePhone } from '@/lib/auth';
import { colors } from '@/theme/colors';

export function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onLogin = async () => {
    setError('');
    const p = normalizePhone(phone);
    if (p.length !== 10) return setError('Enter a valid 10-digit mobile number');
    if (password.length < 6) return setError('Enter your password');

    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(p),
      password,
    });
    if (err) setError(err.message === 'Invalid login credentials' ? 'Wrong number or password' : err.message);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.logoWrap}><Text style={{ fontSize: 40 }}>✈️</Text></View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in with your mobile number</Text>

        {!!error && (
          <View style={styles.errBox}><Text style={styles.errText}>{error}</Text></View>
        )}

        <Text style={styles.label}>Mobile number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.cc}><Text style={styles.ccText}>+91</Text></View>
          <TextInput mode="outlined" value={phone} onChangeText={setPhone}
            placeholder="98765 43210" keyboardType="phone-pad" maxLength={10}
            style={[styles.input, { flex: 1 }]} outlineColor={colors.border}
            activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />
        </View>

        <Text style={styles.label}>Password</Text>
        <TextInput mode="outlined" value={password} onChangeText={setPassword}
          placeholder="Your password" secureTextEntry={!showPass}
          right={<TextInput.Icon icon={showPass ? 'eye-off' : 'eye'} onPress={() => setShowPass(!showPass)} />}
          style={styles.input} outlineColor={colors.border}
          activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />

        <Button mode="contained" onPress={onLogin} loading={loading} disabled={loading}
          buttonColor={colors.primary} style={styles.btn} labelStyle={styles.btnLabel}
          contentStyle={{ paddingVertical: 6 }}>
          Sign In
        </Button>

        <Pressable onPress={() => navigation.navigate('SignUp')} style={{ marginTop: 18 }}>
          <Text style={styles.link}>New here? <Text style={{ fontWeight: '800', color: colors.primary }}>Create account</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  back: { position: 'absolute', top: 48, left: 24 },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  logoWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', color: colors.black, marginBottom: 6 },
  sub: { fontSize: 15, color: '#64748B', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#F8FFFE', marginBottom: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cc: { height: 56, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primarySoft, justifyContent: 'center', marginBottom: 4 },
  ccText: { fontWeight: '800', color: colors.primary, fontSize: 16 },
  btn: { borderRadius: 16, marginTop: 20, elevation: 0 },
  btnLabel: { fontSize: 16, fontWeight: '800' },
  link: { textAlign: 'center', color: '#64748B', fontSize: 14 },
  errBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 12 },
  errText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
});