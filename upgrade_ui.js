const fs = require('fs');
const path = require('path');
function w(f, c) {
  const p = path.join(__dirname, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c.trim(), 'utf8');
  console.log('Updated', f);
}

// ===== THEME =====
w('src/theme/colors.ts', `
export const colors = {
  primary: '#0F766E',
  primaryDark: '#0D9488',
  primarySoft: '#CCFBF1',
  accent: '#F59E0B',
  bg: '#F0FDFA',
  card: '#FFFFFF',
  text: '#134E4A',
  textMuted: '#5EEAD4',
  textDark: '#115E59',
  danger: '#EF4444',
  success: '#10B981',
  border: '#99F6E4',
  white: '#FFFFFF',
  black: '#042F2E',
  gradientStart: '#0F766E',
  gradientEnd: '#14B8A6',
};
`);

// ===== AUTH HELPERS (phone -> internal email) =====
w('src/lib/auth.ts', `
/** Phone auth without SMS: store as internal email phone@tripsplit.app */
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\\D/g, '');
  return digits + '@tripsplit.app';
}

export function formatPhoneDisplay(phone: string): string {
  const d = phone.replace(/\\D/g, '');
  if (d.length === 10) return '+91 ' + d.slice(0,5) + ' ' + d.slice(5);
  return phone;
}

export function normalizePhone(phone: string): string {
  let d = phone.replace(/\\D/g, '');
  if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  return d;
}
`);

// ===== ONBOARDING =====
w('src/screens/auth/OnboardingScreen.tsx', `
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, StatusBar } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { colors } from '@/theme/colors';

const { width } = Dimensions.get('window');

export function OnboardingScreen({ navigation }: any) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.hero}>
        <Animated.View style={[styles.orb, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.emoji}>✈️</Text>
        </Animated.View>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <Text style={styles.brand}>TripSplit</Text>
          <Text style={styles.tagline}>Split trip money fairly.\\nNo awkward UPI chases.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.sheet, { opacity: fade }]}>
        <Feature icon="💰" title="Shared trip fund" desc="Pool money once, spend together" />
        <Feature icon="📊" title="Live balances" desc="Everyone sees who paid what, instantly" />
        <Feature icon="🔗" title="Invite friends" desc="Share a code — they join in seconds" />

        <Button mode="contained" onPress={() => navigation.navigate('SignUp')}
          buttonColor={colors.primary} textColor="#fff"
          style={styles.cta} labelStyle={styles.ctaLabel} contentStyle={{ paddingVertical: 6 }}>
          Create account
        </Button>
        <Button mode="outlined" onPress={() => navigation.navigate('Login')}
          textColor={colors.primary} style={styles.secondary}
          labelStyle={{ fontWeight: '700' }}>
          I already have an account
        </Button>
      </Animated.View>
    </View>
  );
}

function Feature({ icon, title, desc }: any) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  hero: { flex: 0.42, alignItems: 'center', justifyContent: 'center', paddingTop: 24 },
  orb: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emoji: { fontSize: 48 },
  brand: { fontSize: 40, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8, lineHeight: 24 },
  sheet: { flex: 0.58, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 28 },
  feature: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: colors.black },
  featureDesc: { fontSize: 13, color: '#64748B', marginTop: 2 },
  cta: { borderRadius: 16, marginTop: 12, elevation: 0 },
  ctaLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondary: { borderRadius: 16, marginTop: 10, borderColor: colors.border, borderWidth: 1.5 },
});
`);

// ===== SIGN UP (phone + password) =====
w('src/screens/auth/SignUpScreen.tsx', `
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Pressable } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import { phoneToEmail, normalizePhone } from '@/lib/auth';
import { colors } from '@/theme/colors';

export function SignUpScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSignUp = async () => {
    setError('');
    const p = normalizePhone(phone);
    if (name.trim().length < 2) return setError('Enter your full name');
    if (p.length !== 10) return setError('Enter a valid 10-digit mobile number');
    if (password.length < 6) return setError('Password must be at least 6 characters');

    setLoading(true);
    const email = phoneToEmail(p);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim(), phone: p } },
    });
    if (err) {
      if (err.message.toLowerCase().includes('rate')) setError('Too many tries. Wait 2 min or Sign In if you already registered.');
      else if (err.message.toLowerCase().includes('already')) setError('Number already registered. Please Sign In.');
      else setError(err.message);
    }
    // also update profile phone
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ phone: p, full_name: name.trim() }).eq('id', user.id);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>Use your mobile number — no email needed</Text>

        {!!error && (
          <View style={styles.errBox}><Text style={styles.errText}>{error}</Text></View>
        )}

        <Text style={styles.label}>Full name</Text>
        <TextInput mode="outlined" value={name} onChangeText={setName}
          placeholder="Vishal Kumar" style={styles.input} outlineColor={colors.border}
          activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />

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
          placeholder="Min 6 characters" secureTextEntry={!showPass}
          right={<TextInput.Icon icon={showPass ? 'eye-off' : 'eye'} onPress={() => setShowPass(!showPass)} />}
          style={styles.input} outlineColor={colors.border}
          activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />

        <Button mode="contained" onPress={onSignUp} loading={loading} disabled={loading}
          buttonColor={colors.primary} style={styles.btn} labelStyle={styles.btnLabel}
          contentStyle={{ paddingVertical: 6 }}>
          Sign Up
        </Button>

        <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: 18 }}>
          <Text style={styles.link}>Already have an account? <Text style={{ fontWeight: '800', color: colors.primary }}>Sign In</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, backgroundColor: '#fff', justifyContent: 'center' },
  back: { position: 'absolute', top: 48, left: 24, zIndex: 2 },
  backText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  title: { fontSize: 32, fontWeight: '800', color: colors.black, marginBottom: 6 },
  sub: { fontSize: 15, color: '#64748B', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: '#F8FFFE', marginBottom: 4 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cc: { height: 56, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primarySoft, justifyContent: 'center', marginBottom: 4 },
  ccText: { fontWeight: '800', color: colors.primary, fontSize: 16 },
  btn: { borderRadius: 16, marginTop: 20, elevation: 0 },
  btnLabel: { fontSize: 16, fontWeight: '800' },
  link: { textAlign: 'center', color: '#64748B', fontSize: 14 },
  errBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errText: { color: colors.danger, fontWeight: '600', fontSize: 13 },
});
`);

// ===== LOGIN (phone + password) =====
w('src/screens/auth/LoginScreen.tsx', `
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
`);

// ===== DASHBOARD =====
w('src/screens/main/DashboardScreen.tsx', `
import React from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Pressable, StatusBar } from 'react-native';
import { Text, FAB, ActivityIndicator } from 'react-native-paper';
import { useSession, useMyTrips, useProfile } from '@/lib/queries';
import { colors } from '@/theme/colors';

export function DashboardScreen({ navigation }: any) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: profile } = useProfile(userId);
  const { data: trips, isLoading, refetch, isRefetching } = useMyTrips(userId);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const firstName = (profile?.full_name || 'Traveller').split(' ')[0];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hello, {firstName} 👋</Text>
          <Text style={styles.headerSub}>Your group trips</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('JoinTrip', { code: '' })}>
            <Text style={{ fontSize: 18 }}>🔗</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Profile')}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sheet}>
        <FlatList
          data={trips || []}
          keyExtractor={(item: any) => item.trip_id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 56 }}>🧳</Text>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.emptySub}>Create a trip or join with an invite code</Text>
              <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('CreateTrip')}>
                <Text style={styles.emptyBtnText}>+ Create trip</Text>
              </Pressable>
              <Pressable style={[styles.emptyBtn, styles.emptyBtnOutline]} onPress={() => navigation.navigate('JoinTrip', { code: '' })}>
                <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Join with code</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }: any) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 }]}
              onPress={() => navigation.navigate('TripDetail', { tripId: item.trip_id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.role === 'organizer' ? '👑 Organizer' : '👤 Member'}</Text>
                </View>
                <Text style={styles.cardArrow}>→</Text>
              </View>
              <Text style={styles.cardTitle}>{item.trips?.name || 'Trip'}</Text>
              <Text style={styles.cardDest}>📍 {item.trips?.destination}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>
                  {item.trips?.start_date || ''} → {item.trips?.end_date || ''}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>

      <FAB icon="plus" label="New trip" style={styles.fab} color="#fff"
        onPress={() => navigation.navigate('CreateTrip')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  header: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { fontSize: 26, fontWeight: '800', color: '#fff' },
  headerSub: { color: 'rgba(255,255,255,0.75)', marginTop: 2, fontSize: 14 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, elevation: 2, shadowColor: '#0F766E', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  cardArrow: { fontSize: 18, color: colors.primary, fontWeight: '700' },
  cardTitle: { fontSize: 20, fontWeight: '800', color: colors.black },
  cardDest: { fontSize: 14, color: '#64748B', marginTop: 4 },
  cardFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  cardDate: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.black, marginTop: 12 },
  emptySub: { color: '#94A3B8', marginTop: 6, textAlign: 'center' },
  emptyBtn: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyBtnOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.primary, marginTop: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  fab: { position: 'absolute', right: 20, bottom: 28, backgroundColor: colors.primary, borderRadius: 16 },
});
`);

// ===== CREATE TRIP =====
w('src/screens/main/CreateTripScreen.tsx', `
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, StatusBar } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useCreateTrip } from '@/lib/queries';
import { colors } from '@/theme/colors';
import { supabase } from '@/lib/supabase';

export function CreateTripScreen({ navigation }: any) {
  const createTrip = useCreateTrip();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-07');
  const [description, setDescription] = useState('');

  const onSubmit = async () => {
    if (!name.trim() || !destination.trim()) return alert('Name and destination required');
    try {
      const trip = await createTrip.mutateAsync({
        name: name.trim(), destination: destination.trim(),
        start_date: startDate, end_date: endDate, description, currency: 'INR',
      });
      // auto-create invite code
      await supabase.rpc('create_invite_code', { p_trip_id: trip.id });
      navigation.replace('TripDetail', { tripId: trip.id });
    } catch (e: any) {
      alert(e.message || 'Failed to create trip');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.scroll}>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.title}>Plan a new trip</Text>
      <Text style={styles.sub}>You’ll be the organizer & money manager</Text>

      <Field label="Trip name" value={name} onChangeText={setName} placeholder="Manali Boys Trip" />
      <Field label="Destination" value={destination} onChangeText={setDestination} placeholder="Manali, HP" />
      <Field label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
      <Field label="End date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
      <Field label="Notes (optional)" value={description} onChangeText={setDescription} placeholder="Snow + cafes" />

      <Button mode="contained" onPress={onSubmit} loading={createTrip.isPending}
        buttonColor={colors.primary} style={styles.btn} labelStyle={{ fontWeight: '800', fontSize: 16 }}
        contentStyle={{ paddingVertical: 6 }}>
        Create trip
      </Button>
    </ScrollView>
  );
}

function Field({ label, ...rest }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput mode="outlined" {...rest} style={styles.input}
        outlineColor={colors.border} activeOutlineColor={colors.primary}
        outlineStyle={{ borderRadius: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: colors.black },
  sub: { color: '#64748B', marginBottom: 20, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 6 },
  input: { backgroundColor: '#fff' },
  btn: { borderRadius: 16, marginTop: 8, elevation: 0 },
});
`);

// ===== TRIP DETAIL with INVITE =====
w('src/screens/main/TripDetailScreen.tsx', `
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Share, Pressable, StatusBar, Modal } from 'react-native';
import { Text, Button, ProgressBar, ActivityIndicator } from 'react-native-paper';
import { useTrip, useSharedFundBalance, useContributions, useExpenses, useTripMembers } from '@/lib/queries';
import { useTripRealtime } from '@/lib/realtime';
import { formatINR } from '@/lib/financial';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  useTripRealtime(tripId);

  const { data: trip, isLoading } = useTrip(tripId);
  const { data: balance = 0 } = useSharedFundBalance(tripId);
  const { data: contributions = [] } = useContributions(tripId);
  const { data: expenses = [] } = useExpenses(tripId);
  const { data: members = [] } = useTripMembers(tripId);

  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const totalIn = contributions.reduce((s: number, c: any) => s + (c.amount_paise || 0), 0);
  const totalOut = expenses.reduce((s: number, e: any) => s + (e.amount_paise || 0), 0);
  const usage = totalIn > 0 ? Math.min(totalOut / totalIn, 1) : 0;
  const low = balance < (trip?.low_balance_threshold_paise || 100000);

  const openInvite = async () => {
    setInviteLoading(true);
    setInviteVisible(true);
    // try existing code first
    const { data: existing } = await supabase
      .from('invitations')
      .select('code')
      .eq('trip_id', tripId)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1);
    if (existing && existing.length) {
      setInviteCode(existing[0].code);
    } else {
      const { data } = await supabase.rpc('create_invite_code', { p_trip_id: tripId });
      setInviteCode(data?.code || '--------');
    }
    setInviteLoading(false);
  };

  const shareInvite = async () => {
    await Share.share({
      message:
        'Join my trip "' + (trip?.name || '') + '" on TripSplit!\\n\\n' +
        'Invite code: ' + inviteCode + '\\n\\n' +
        '1. Open TripSplit\\n2. Tap Join with code\\n3. Enter ' + inviteCode,
      title: 'TripSplit Invite',
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{trip?.name}</Text>
        <Text style={styles.heroDest}>📍 {trip?.destination}</Text>
        <View style={styles.heroStats}>
          <Stat label="Members" value={String(members.length)} />
          <Stat label="Expenses" value={String(expenses.length)} />
          <Stat label="In fund" value={formatINR(balance).replace('₹', '₹')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Fund card */}
        <View style={styles.fundCard}>
          <Text style={styles.fundLabel}>Available shared fund</Text>
          <Text style={[styles.fundValue, low && { color: colors.danger }]}>{formatINR(balance)}</Text>
          <ProgressBar progress={usage} color={low ? colors.danger : colors.primary} style={styles.progress} />
          <View style={styles.fundRow}>
            <Text style={styles.fundMeta}>Pooled {formatINR(totalIn)}</Text>
            <Text style={styles.fundMeta}>Spent {formatINR(totalOut)}</Text>
          </View>
          {low && (
            <Pressable style={styles.lowBanner} onPress={() => navigation.navigate('RequestMoney', { tripId })}>
              <Text style={styles.lowText}>⚠️ Fund running low — Request more money</Text>
            </Pressable>
          )}
        </View>

        {/* Quick actions */}
        <Text style={styles.section}>Quick actions</Text>
        <View style={styles.actions}>
          <Action icon="🧾" label="Add expense" color="#ECFDF5" onPress={() => navigation.navigate('AddExpense', { tripId })} />
          <Action icon="💵" label="Add money" color="#EFF6FF" onPress={() => navigation.navigate('AddContribution', { tripId })} />
          <Action icon="🔗" label="Invite" color="#FEF3C7" onPress={openInvite} />
          <Action icon="⚖️" label="Settle" color="#FCE7F3" onPress={() => navigation.navigate('Settlement', { tripId })} />
        </View>

        {/* Members strip */}
        <View style={styles.rowBetween}>
          <Text style={styles.section}>Members</Text>
          <Pressable onPress={() => navigation.navigate('Members', { tripId })}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {members.map((m: any) => (
            <Pressable key={m.id} style={styles.avatar}
              onPress={() => navigation.navigate('MemberBalance', { tripId, userId: m.user_id })}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{(m.profiles?.full_name || '?')[0].toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={styles.avatarName}>{m.profiles?.full_name?.split(' ')[0]}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.avatar} onPress={openInvite}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed' }]}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 22 }}>+</Text>
            </View>
            <Text style={styles.avatarName}>Invite</Text>
          </Pressable>
        </ScrollView>

        {/* Expenses */}
        <Text style={styles.section}>Recent expenses</Text>
        {(expenses || []).slice(0, 8).map((e: any) => (
          <Pressable key={e.id} style={styles.expRow}
            onPress={() => navigation.navigate('ExpenseDetail', { tripId, expenseId: e.id })}>
            <View style={styles.expIcon}><Text>🧾</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.expTitle}>{e.title}</Text>
              <Text style={styles.expMeta}>{e.category} · {e.payment_source === 'shared_fund' ? 'Shared fund' : 'Personal'}</Text>
            </View>
            <Text style={styles.expAmt}>-{formatINR(e.amount_paise)}</Text>
          </Pressable>
        ))}
        {!expenses.length && (
          <View style={styles.emptyBox}>
            <Text style={{ color: '#94A3B8' }}>No expenses yet. Tap “Add expense”.</Text>
          </View>
        )}

        <Button mode="outlined" onPress={() => navigation.navigate('ContributionRequests', { tripId })}
          textColor={colors.primary} style={{ marginTop: 8, borderRadius: 14, borderColor: colors.border }}>
          Contribution requests
        </Button>
      </ScrollView>

      {/* INVITE MODAL */}
      <Modal visible={inviteVisible} transparent animationType="slide" onRequestClose={() => setInviteVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite friends</Text>
            <Text style={styles.modalSub}>Share this code. Friends open TripSplit → Join with code.</Text>

            <View style={styles.codeBox}>
              {inviteLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.codeText}>{inviteCode}</Text>
              )}
            </View>

            <Button mode="contained" icon="share-variant" onPress={shareInvite}
              buttonColor={colors.primary} style={styles.btn} labelStyle={{ fontWeight: '800' }}
              contentStyle={{ paddingVertical: 4 }}>
              Share via WhatsApp / SMS
            </Button>
            <Button mode="text" onPress={() => setInviteVisible(false)} textColor="#64748B">Close</Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value }: any) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, color, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.action, { backgroundColor: color }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { backgroundColor: colors.primary, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 0 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroDest: { color: 'rgba(255,255,255,0.85)', marginTop: 4, marginBottom: 16 },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 12 },
  scroll: { padding: 16, paddingBottom: 40 },
  fundCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginTop: -18, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12 },
  fundLabel: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  fundValue: { fontSize: 36, fontWeight: '800', color: colors.primary, marginVertical: 4 },
  progress: { height: 8, borderRadius: 8, marginTop: 8, backgroundColor: '#E2E8F0' },
  fundRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  fundMeta: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  lowBanner: { marginTop: 12, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12 },
  lowText: { color: '#B45309', fontWeight: '700', fontSize: 13 },
  section: { fontSize: 16, fontWeight: '800', color: colors.black, marginTop: 20, marginBottom: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { width: '47%', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  actionLabel: { marginTop: 6, fontWeight: '700', color: colors.black, fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.primary, fontWeight: '700' },
  avatar: { alignItems: 'center', marginRight: 14, width: 64 },
  avatarCircle: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  avatarName: { fontSize: 11, color: '#64748B', marginTop: 4, fontWeight: '600' },
  expRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8 },
  expIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  expTitle: { fontWeight: '700', color: colors.black },
  expMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  expAmt: { fontWeight: '800', color: colors.danger },
  emptyBox: { backgroundColor: '#fff', padding: 20, borderRadius: 14, alignItems: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.black },
  modalSub: { color: '#64748B', marginTop: 6, marginBottom: 18, lineHeight: 20 },
  codeBox: { backgroundColor: colors.primarySoft, borderRadius: 16, paddingVertical: 22, alignItems: 'center', marginBottom: 16, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' },
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 6, color: colors.primary },
  btn: { borderRadius: 14, elevation: 0 },
});
`);

// ===== JOIN TRIP =====
w('src/screens/main/JoinTripScreen.tsx', `
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export function JoinTripScreen({ route, navigation }: any) {
  const initial = (route.params?.code || '').toUpperCase();
  const [code, setCode] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) setCode(initial);
  }, [initial]);

  const join = async () => {
    setError('');
    if (code.trim().length < 4) return setError('Enter a valid invite code');
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc('join_trip_via_invitation', {
      p_code: code.trim().toUpperCase(),
    });
    setLoading(false);
    if (rpcErr) return setError(rpcErr.message);
    if (!data?.success) return setError(data?.error || 'Could not join');
    navigation.replace('TripDetail', { tripId: data.trip_id });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <Text style={{ fontSize: 48, marginBottom: 8 }}>🔗</Text>
      <Text style={styles.title}>Join a trip</Text>
      <Text style={styles.sub}>Ask your friend for the 8-letter invite code</Text>

      {!!error && <View style={styles.err}><Text style={{ color: colors.danger, fontWeight: '600' }}>{error}</Text></View>}

      <TextInput
        mode="outlined"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="ABCD1234"
        autoCapitalize="characters"
        maxLength={8}
        style={styles.input}
        outlineColor={colors.border}
        activeOutlineColor={colors.primary}
        outlineStyle={{ borderRadius: 16 }}
        contentStyle={{ fontSize: 24, fontWeight: '800', letterSpacing: 4, textAlign: 'center' }}
      />

      <Button mode="contained" onPress={join} loading={loading}
        buttonColor={colors.primary} style={styles.btn} labelStyle={{ fontWeight: '800', fontSize: 16 }}
        contentStyle={{ paddingVertical: 6 }}>
        Join trip
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.black },
  sub: { color: '#64748B', marginBottom: 24, textAlign: 'center' },
  input: { width: '100%', backgroundColor: colors.primarySoft, marginBottom: 12 },
  btn: { width: '100%', borderRadius: 16, elevation: 0 },
  err: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 12, marginBottom: 12, width: '100%' },
});
`);

// ===== ADD EXPENSE prettier =====
w('src/screens/main/AddExpenseScreen.tsx', `
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRecordExpense, useTripMembers, useSession } from '@/lib/queries';
import { inrToPaise, calculateSplit, formatINR } from '@/lib/financial';
import { colors } from '@/theme/colors';

const CATS = [
  { id: 'food', label: 'Food', icon: '🍽️' },
  { id: 'hotel', label: 'Hotel', icon: '🏨' },
  { id: 'petrol', label: 'Travel', icon: '⛽' },
  { id: 'shopping', label: 'Shop', icon: '🛍️' },
  { id: 'tickets', label: 'Tickets', icon: '🎫' },
  { id: 'misc', label: 'Misc', icon: '📦' },
];

export function AddExpenseScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { data: session } = useSession();
  const { data: members = [] } = useTripMembers(tripId);
  const recordExpense = useRecordExpense();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [source, setSource] = useState<'shared_fund' | 'personal'>('shared_fund');

  const onSubmit = async () => {
    const amountPaise = inrToPaise(parseFloat(amount) || 0);
    if (!title.trim() || amountPaise <= 0) return alert('Enter title and amount');
    const participantIds = members.map((m: any) => m.user_id);
    if (!participantIds.length) return alert('No members to split with');
    const split = calculateSplit({ participantIds, totalAmountPaise: amountPaise, method: 'equal' });
    const splitAmounts = participantIds.map((id) => split.allocations[id] || 0);

    try {
      await recordExpense.mutateAsync({
        tripId, title: title.trim(), amountPaise, category,
        expenseDate: new Date().toISOString(),
        paidBy: session?.user?.id,
        paymentSource: source,
        splitMethod: 'equal',
        participants: participantIds,
        splitAmounts,
      });
      navigation.goBack();
    } catch (e: any) {
      alert(e.message || 'Failed');
    }
  };

  const preview = (() => {
    const a = inrToPaise(parseFloat(amount) || 0);
    if (!a || !members.length) return null;
    const each = Math.floor(a / members.length);
    return formatINR(each);
  })();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>New expense</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput mode="outlined" value={title} onChangeText={setTitle} placeholder="Dinner at cafe"
        style={styles.input} outlineColor={colors.border} activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput mode="outlined" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00"
        style={styles.input} outlineColor={colors.border} activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />

      <Text style={styles.label}>Category</Text>
      <View style={styles.cats}>
        {CATS.map((c) => (
          <Pressable key={c.id} onPress={() => setCategory(c.id)}
            style={[styles.cat, category === c.id && styles.catOn]}>
            <Text style={{ fontSize: 18 }}>{c.icon}</Text>
            <Text style={[styles.catText, category === c.id && { color: colors.primary }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Paid from</Text>
      <View style={styles.seg}>
        <Pressable onPress={() => setSource('shared_fund')} style={[styles.segBtn, source === 'shared_fund' && styles.segOn]}>
          <Text style={[styles.segText, source === 'shared_fund' && styles.segTextOn]}>Shared fund</Text>
        </Pressable>
        <Pressable onPress={() => setSource('personal')} style={[styles.segBtn, source === 'personal' && styles.segOn]}>
          <Text style={[styles.segText, source === 'personal' && styles.segTextOn]}>Personal</Text>
        </Pressable>
      </View>

      {preview && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Equal split preview</Text>
          <Text style={styles.previewVal}>{preview} each · {members.length} people</Text>
        </View>
      )}

      <Button mode="contained" onPress={onSubmit} loading={recordExpense.isPending}
        buttonColor={colors.primary} style={styles.btn} labelStyle={{ fontWeight: '800', fontSize: 16 }}
        contentStyle={{ paddingVertical: 6 }}>
        Save expense
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.black, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#fff', marginBottom: 4 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { width: '30%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
  catOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 4 },
  seg: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  segOn: { backgroundColor: '#fff', elevation: 1 },
  segText: { fontWeight: '700', color: '#64748B' },
  segTextOn: { color: colors.primary },
  preview: { marginTop: 16, backgroundColor: colors.primarySoft, padding: 14, borderRadius: 14 },
  previewTitle: { fontWeight: '700', color: colors.primary, fontSize: 12 },
  previewVal: { fontWeight: '800', color: colors.black, fontSize: 16, marginTop: 4 },
  btn: { marginTop: 20, borderRadius: 16, elevation: 0 },
});
`);

// ===== PROFILE =====
w('src/screens/main/ProfileScreen.tsx', `
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSession, useProfile } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export function ProfileScreen() {
  const { data: session } = useSession();
  const { data: profile } = useProfile(session?.user?.id);
  const phone = profile?.phone || (session?.user?.email || '').split('@')[0];

  return (
    <View style={styles.root}>
      <View style={styles.avatar}>
        <Text style={styles.letter}>{(profile?.full_name || 'U')[0].toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{profile?.full_name || 'User'}</Text>
      <Text style={styles.phone}>+91 {phone}</Text>

      <Button mode="contained" onPress={() => supabase.auth.signOut()}
        buttonColor={colors.danger} style={styles.btn} labelStyle={{ fontWeight: '800' }}>
        Sign out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  avatar: { width: 88, height: 88, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  letter: { fontSize: 36, fontWeight: '800', color: '#fff' },
  name: { fontSize: 24, fontWeight: '800', color: colors.black },
  phone: { color: '#64748B', marginTop: 4, marginBottom: 32, fontSize: 15 },
  btn: { borderRadius: 14, width: '100%', elevation: 0 },
});
`);

// Theme App.tsx
w('App.tsx', `
import React from 'react';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30000 } },
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0F766E',
    primaryContainer: '#CCFBF1',
    secondary: '#F59E0B',
    background: '#F0FDFA',
    surface: '#FFFFFF',
    onSurface: '#134E4A',
    error: '#EF4444',
  },
  roundness: 14,
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <AppNavigator />
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
`);

console.log('\\n✅ UI + phone auth + invites upgraded!');