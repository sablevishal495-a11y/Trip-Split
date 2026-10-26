const fs = require('fs');
const path = require('path');

function writeFile(filePath, content) {
  const fullPath = path.join(__dirname, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim(), 'utf8');
  console.log('Created:', filePath);
}

// 1. tsconfig.json
writeFile('tsconfig.json', `{
  "compilerOptions": {
    "target": "esnext",
    "module": "commonjs",
    "lib": ["es2022"],
    "jsx": "react-native",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "App.tsx", "index.js"]
}`);

// 2. babel.config.js
writeFile('babel.config.js', `module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    ['module-resolver', { root: ['./src'], alias: { '@': './src' } }],
    'react-native-reanimated/plugin',
  ],
};`);

// 3. src/lib/supabase.ts
writeFile('src/lib/supabase.ts', `import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// REPLACE THESE WITH YOUR SUPABASE VALUES!
export const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});`);

// 4. src/lib/financial.ts
writeFile('src/lib/financial.ts', `export type Paise = number;

export function inrToPaise(inr: number): Paise {
  return Math.round(inr * 100);
}

export function paiseToInr(paise: Paise): number {
  return paise / 100;
}

export function formatINR(paise: Paise): string {
  const inr = paiseToInr(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(inr);
}

export interface SplitInput {
  participantIds: string[];
  totalAmountPaise: Paise;
  method: 'equal' | 'custom' | 'percentage';
  customAmounts?: Record<string, Paise>;
  percentages?: Record<string, number>;
}

export function calculateSplit(input: SplitInput) {
  const { participantIds, totalAmountPaise, method, customAmounts, percentages } = input;
  if (!participantIds.length || totalAmountPaise <= 0) {
    return { allocations: {}, isValid: false, error: 'Invalid input' };
  }

  const allocations: Record<string, Paise> = {};

  if (method === 'equal') {
    const base = Math.floor(totalAmountPaise / participantIds.length);
    const remainder = totalAmountPaise - base * participantIds.length;
    participantIds.forEach((id, i) => {
      allocations[id] = base + (i < remainder ? 1 : 0);
    });
  } else if (method === 'custom' && customAmounts) {
    participantIds.forEach(id => { allocations[id] = customAmounts[id] || 0; });
  } else if (method === 'percentage' && percentages) {
    let allocated = 0;
    for (let i = 0; i < participantIds.length - 1; i++) {
      const id = participantIds[i];
      const amt = Math.round((totalAmountPaise * (percentages[id] || 0)) / 100);
      allocations[id] = amt;
      allocated += amt;
    }
    allocations[participantIds[participantIds.length - 1]] = totalAmountPaise - allocated;
  }

  return { allocations, isValid: true };
}

export function computeSettlement(sharedFundBalance: Paise, members: any[]) {
  let totalOwedTo = 0;
  let totalOwedBy = 0;
  members.forEach(m => {
    if (m.netPositionPaise > 0) totalOwedTo += m.netPositionPaise;
    else totalOwedBy += Math.abs(m.netPositionPaise);
  });
  return {
    sharedFundBalancePaise: sharedFundBalance,
    members,
    totalOwedToMembersPaise: totalOwedTo,
    totalOwedByMembersPaise: totalOwedBy,
    isReconciled: Math.abs(totalOwedTo - totalOwedBy) < 100,
  };
}`);

// 5. src/lib/queries.ts
writeFile('src/lib/queries.ts', `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
    staleTime: Infinity,
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useMyTrips(userId: string | undefined) {
  return useQuery({
    queryKey: ['trips', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_members')
        .select('trip_id, role, trips(*)')
        .eq('user_id', userId!)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('*').eq('id', tripId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trip: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: newTrip, error: tripErr } = await supabase
        .from('trips')
        .insert({ ...trip, created_by: user.id })
        .select().single();
      if (tripErr) throw tripErr;

      const { error: memberErr } = await supabase
        .from('trip_members')
        .insert({ trip_id: newTrip.id, user_id: user.id, role: 'organizer' });
      if (memberErr) throw memberErr;

      return newTrip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useTripMembers(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip_members', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_members')
        .select('*, profiles(id, full_name, email, avatar_url)')
        .eq('trip_id', tripId!)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}

export function useContributions(tripId: string | undefined) {
  return useQuery({
    queryKey: ['contributions', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select('*, profiles!contributions_user_id_fkey(full_name)')
        .eq('trip_id', tripId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}

export function useRecordContribution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: any) => {
      const idempotencyKey = uuidv4();
      const { data, error } = await supabase.rpc('record_contribution', {
        p_trip_id: params.tripId,
        p_user_id: params.userId,
        p_amount_paise: params.amountPaise,
        p_is_initial: params.isInitial,
        p_idempotency_key: idempotencyKey,
        p_notes: params.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['contributions', vars.tripId] });
      qc.invalidateQueries({ queryKey: ['fund_balance', vars.tripId] });
    },
  });
}

export function useSharedFundBalance(tripId: string | undefined) {
  return useQuery({
    queryKey: ['fund_balance', tripId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_shared_fund_balance', { p_trip_id: tripId! });
      if (error) throw error;
      return data as number;
    },
    enabled: !!tripId,
  });
}

export function useExpenses(tripId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_splits(*, profiles(full_name)), profiles!expenses_paid_by_fkey(full_name)')
        .eq('trip_id', tripId!)
        .eq('is_reversed', false)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}

export function useRecordExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: any) => {
      const idempotencyKey = uuidv4();
      const { data, error } = await supabase.rpc('record_expense', {
        p_trip_id: params.tripId,
        p_title: params.title,
        p_amount_paise: params.amountPaise,
        p_category: params.category,
        p_expense_date: params.expenseDate,
        p_paid_by: params.paidBy,
        p_payment_source: params.paymentSource,
        p_split_method: params.splitMethod,
        p_participants: params.participants,
        p_split_amounts: params.splitAmounts,
        p_idempotency_key: idempotencyKey,
        p_notes: params.notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['expenses', vars.tripId] });
      qc.invalidateQueries({ queryKey: ['fund_balance', vars.tripId] });
    },
  });
}

export function useContributionRequests(tripId: string | undefined) {
  return useQuery({
    queryKey: ['contribution_requests', tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from('contribution_requests').select('*').eq('trip_id', tripId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}

export function useSettlements(tripId: string | undefined) {
  return useQuery({
    queryKey: ['settlements', tripId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('calculate_settlements', { p_trip_id: tripId! });
      if (error) throw error;
      return data as Array<{ user_id: string; full_name: string; net_position_paise: number }>;
    },
    enabled: !!tripId,
  });
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}`);

// 6. src/lib/realtime.ts
writeFile('src/lib/realtime.ts', `import { useEffect } from 'react';
import { supabase } from './supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useTripRealtime(tripId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel('trip:' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions', filter: 'trip_id=eq.' + tripId }, () => {
        queryClient.invalidateQueries({ queryKey: ['contributions', tripId] });
        queryClient.invalidateQueries({ queryKey: ['fund_balance', tripId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: 'trip_id=eq.' + tripId }, () => {
        queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
        queryClient.invalidateQueries({ queryKey: ['fund_balance', tripId] });
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [tripId, queryClient]);
}`);

// 7. src/navigation/AppNavigator.tsx
writeFile('src/navigation/AppNavigator.tsx', `import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/lib/supabase';

import { LoginScreen } from '@/screens/auth/LoginScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { OnboardingScreen } from '@/screens/auth/OnboardingScreen';

import { DashboardScreen } from '@/screens/main/DashboardScreen';
import { CreateTripScreen } from '@/screens/main/CreateTripScreen';
import { TripDetailScreen } from '@/screens/main/TripDetailScreen';
import { AddExpenseScreen } from '@/screens/main/AddExpenseScreen';
import { AddContributionScreen } from '@/screens/main/AddContributionScreen';
import { MembersScreen } from '@/screens/main/MembersScreen';
import { SettlementScreen } from '@/screens/main/SettlementScreen';
import { NotificationsScreen } from '@/screens/main/NotificationsScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { JoinTripScreen } from '@/screens/main/JoinTripScreen';
import { ContributionRequestsScreen } from '@/screens/main/ContributionRequestsScreen';
import { RequestMoneyScreen } from '@/screens/main/RequestMoneyScreen';
import { MemberBalanceScreen } from '@/screens/main/MemberBalanceScreen';
import { ExpenseDetailScreen } from '@/screens/main/ExpenseDetailScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#FFF' }, headerTintColor: '#1A1A2E' }}>
      <MainStack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'My Trips' }} />
      <MainStack.Screen name="CreateTrip" component={CreateTripScreen} options={{ title: 'Create Trip' }} />
      <MainStack.Screen name="JoinTrip" component={JoinTripScreen} options={{ title: 'Join Trip' }} />
      <MainStack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Trip Overview' }} />
      <MainStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <MainStack.Screen name="AddContribution" component={AddContributionScreen} options={{ title: 'Add Contribution' }} />
      <MainStack.Screen name="Members" component={MembersScreen} options={{ title: 'Members' }} />
      <MainStack.Screen name="ContributionRequests" component={ContributionRequestsScreen} options={{ title: 'Money Requests' }} />
      <MainStack.Screen name="RequestMoney" component={RequestMoneyScreen} options={{ title: 'Request Money' }} />
      <MainStack.Screen name="MemberBalance" component={MemberBalanceScreen} options={{ title: 'Member Balance' }} />
      <MainStack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Expense Detail' }} />
      <MainStack.Screen name="Settlement" component={SettlementScreen} options={{ title: 'Trip Settlement' }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <MainStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
    </MainStack.Navigator>
  );
}

export function AppNavigator() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}`);

// 8. Auth Screens
writeFile('src/screens/auth/OnboardingScreen.tsx', `import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';

export function OnboardingScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>💰</Text>
      <Text variant="headlineLarge" style={styles.title}>TripSplit</Text>
      <Text variant="bodyLarge" style={styles.subtitle}>Split group trip expenses with complete financial transparency.</Text>
      <Button mode="contained" onPress={() => navigation.navigate('SignUp')} buttonColor="#2E7D32" style={styles.button}>Get Started</Button>
      <Button mode="outlined" onPress={() => navigation.navigate('Login')} textColor="#2E7D32" style={styles.button}>Sign In</Button>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  logo: { fontSize: 64, marginBottom: 16 },
  title: { fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 32 },
  button: { width: '100%', marginBottom: 12, paddingVertical: 6 },
});`);

writeFile('src/screens/auth/LoginScreen.tsx', `import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '@/lib/supabase';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text variant="headlineLarge" style={styles.title}>Welcome Back</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Password" value={password} onChangeText={setPassword} mode="outlined" secureTextEntry style={styles.input} />

      <Button mode="contained" onPress={onLogin} loading={loading} buttonColor="#2E7D32" style={styles.button}>Sign In</Button>
      <Button mode="text" onPress={() => navigation.navigate('ForgotPassword')} textColor="#1565C0">Forgot Password?</Button>
      <Button mode="text" onPress={() => navigation.navigate('SignUp')} textColor="#1565C0">Don't have an account? Sign Up</Button>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F8F9FA' },
  title: { fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  error: { color: '#D32F2F', marginBottom: 12 },
  input: { marginBottom: 12, backgroundColor: '#FFF' },
  button: { marginTop: 8, paddingVertical: 6 },
});`);

writeFile('src/screens/auth/SignUpScreen.tsx', `import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '@/lib/supabase';

export function SignUpScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSignUp = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } }
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text variant="headlineLarge" style={styles.title}>Create Account</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput label="Full Name" value={fullName} onChangeText={setFullName} mode="outlined" style={styles.input} />
      <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Password" value={password} onChangeText={setPassword} mode="outlined" secureTextEntry style={styles.input} />

      <Button mode="contained" onPress={onSignUp} loading={loading} buttonColor="#2E7D32" style={styles.button}>Sign Up</Button>
      <Button mode="text" onPress={() => navigation.goBack()} textColor="#1565C0">Already have an account? Sign In</Button>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F8F9FA' },
  title: { fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  error: { color: '#D32F2F', marginBottom: 12 },
  input: { marginBottom: 12, backgroundColor: '#FFF' },
  button: { marginTop: 8, paddingVertical: 6 },
});`);

writeFile('src/screens/auth/ForgotPasswordScreen.tsx', `import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '@/lib/supabase';

export function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onReset = async () => {
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email);
    setSent(true);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Reset Password</Text>
      {sent ? (
        <Text variant="bodyLarge" style={{ color: '#2E7D32', marginBottom: 16 }}>Password reset email sent!</Text>
      ) : (
        <>
          <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" keyboardType="email-address" style={styles.input} />
          <Button mode="contained" onPress={onReset} loading={loading} buttonColor="#2E7D32" style={styles.button}>Send Reset Link</Button>
        </>
      )}
      <Button mode="text" onPress={() => navigation.goBack()} textColor="#1565C0">Back to Login</Button>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F8F9FA' },
  title: { fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: '#FFF' },
  button: { paddingVertical: 6, marginBottom: 12 },
});`);

// 9. Main Screens
writeFile('src/screens/main/DashboardScreen.tsx', `import React from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, FAB, ActivityIndicator, Button } from 'react-native-paper';
import { useSession, useMyTrips } from '@/lib/queries';

export function DashboardScreen({ navigation }: any) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: trips, isLoading, refetch, isRefetching } = useMyTrips(userId);

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8 }}>
        <Button mode="text" icon="account" onPress={() => navigation.navigate('Profile')}>Profile</Button>
      </View>
      <FlatList
        data={trips || []}
        keyExtractor={(item: any) => item.trip_id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="titleMedium" style={{ color: '#999' }}>No trips yet</Text>
            <Text variant="bodyMedium" style={{ color: '#BBB', marginTop: 4 }}>Tap + below to create a trip</Text>
          </View>
        }
        renderItem={({ item }: any) => (
          <Card style={styles.card} mode="elevated" onPress={() => navigation.navigate('TripDetail', { tripId: item.trip_id })}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.tripName}>{item.trips?.name}</Text>
              <Text variant="bodyMedium" style={styles.tripDest}>📍 {item.trips?.destination}</Text>
              <Text variant="labelMedium" style={styles.role}>{item.role === 'organizer' ? '👑 Organizer' : '👤 Member'}</Text>
            </Card.Content>
          </Card>
        )}
      />
      <FAB icon="plus" label="New Trip" style={styles.fab} onPress={() => navigation.navigate('CreateTrip')} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 12, backgroundColor: '#FFF', borderRadius: 12 },
  tripName: { fontWeight: '700', color: '#1A1A2E' },
  tripDest: { color: '#555', marginTop: 4 },
  role: { color: '#2E7D32', marginTop: 8 },
  empty: { alignItems: 'center', marginTop: 80 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#2E7D32' },
});`);

writeFile('src/screens/main/CreateTripScreen.tsx', `import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useCreateTrip } from '@/lib/queries';

export function CreateTripScreen({ navigation }: any) {
  const createTrip = useCreateTrip();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-01-07');
  const [description, setDescription] = useState('');

  const onSubmit = async () => {
    try {
      const trip = await createTrip.mutateAsync({
        name, destination, start_date: startDate, end_date: endDate, description, currency: 'INR'
      });
      navigation.replace('TripDetail', { tripId: trip.id });
    } catch (e: any) { alert(e.message || 'Failed to create trip'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text variant="titleLarge" style={styles.title}>New Trip</Text>
      <TextInput label="Trip Name" value={name} onChangeText={setName} mode="outlined" style={styles.input} />
      <TextInput label="Destination" value={destination} onChangeText={setDestination} mode="outlined" style={styles.input} />
      <TextInput label="Start Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} mode="outlined" style={styles.input} />
      <TextInput label="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} mode="outlined" style={styles.input} />
      <TextInput label="Description (optional)" value={description} onChangeText={setDescription} mode="outlined" style={styles.input} />
      <Button mode="contained" onPress={onSubmit} loading={createTrip.isPending} buttonColor="#2E7D32" style={styles.button}>Create Trip</Button>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { padding: 20, backgroundColor: '#F8F9FA' },
  title: { fontWeight: '700', marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: '#FFF' },
  button: { marginTop: 12, paddingVertical: 6 },
});`);

writeFile('src/screens/main/TripDetailScreen.tsx', `import React from 'react';
import { View, ScrollView, StyleSheet, Share } from 'react-native';
import { Card, Text, Button, ProgressBar, ActivityIndicator } from 'react-native-paper';
import { useTrip, useSharedFundBalance, useContributions, useExpenses, useTripMembers } from '@/lib/queries';
import { useTripRealtime } from '@/lib/realtime';
import { formatINR } from '@/lib/financial';

export function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  useTripRealtime(tripId);

  const { data: trip, isLoading } = useTrip(tripId);
  const { data: balance = 0 } = useSharedFundBalance(tripId);
  const { data: contributions = [] } = useContributions(tripId);
  const { data: expenses = [] } = useExpenses(tripId);
  const { data: members = [] } = useTripMembers(tripId);

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;

  const totalContributions = contributions.reduce((s: number, c: any) => s + c.amount_paise, 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + e.amount_paise, 0);
  const budgetUsage = totalContributions > 0 ? Math.min(totalExpenses / totalContributions, 1) : 0;
  const isLowBalance = balance < (trip?.low_balance_threshold_paise || 100000);

  const shareInvite = () => {
    Share.share({ message: 'Join my trip "' + trip?.name + '" on TripSplit!' });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text variant="headlineMedium" style={styles.title}>{trip?.name}</Text>
      <Text variant="bodyLarge" style={styles.dest}>📍 {trip?.destination}</Text>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium">Shared Fund Balance</Text>
          <Text variant="displaySmall" style={[styles.balance, isLowBalance && { color: '#D32F2F' }]}>{formatINR(balance)}</Text>
          <Text variant="bodySmall" style={{ color: '#888' }}>Total Pooled: {formatINR(totalContributions)}</Text>
          <ProgressBar progress={budgetUsage} color={isLowBalance ? '#D32F2F' : '#2E7D32'} style={{ marginTop: 8, height: 8, borderRadius: 4 }} />
          <Text variant="labelSmall" style={{ marginTop: 4, color: '#666' }}>{Math.round(budgetUsage * 100)}% spent ({formatINR(totalExpenses)})</Text>
        </Card.Content>
      </Card>

      <View style={styles.row}>
        <Button mode="contained" icon="receipt" onPress={() => navigation.navigate('AddExpense', { tripId })} buttonColor="#2E7D32" style={{ flex: 1 }}>Add Expense</Button>
        <Button mode="outlined" icon="cash-plus" onPress={() => navigation.navigate('AddContribution', { tripId })} textColor="#2E7D32" style={{ flex: 1 }}>Add Money</Button>
      </View>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="titleMedium">Members ({members.length})</Text>
            <Button mode="text" onPress={() => navigation.navigate('Members', { tripId })}>View All</Button>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>Recent Expenses</Text>
          {expenses.slice(0, 5).map((e: any) => (
            <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text>{e.title}</Text>
              <Text style={{ fontWeight: '700', color: '#D32F2F' }}>-{formatINR(e.amount_paise)}</Text>
            </View>
          ))}
          {!expenses.length && <Text style={{ color: '#999' }}>No expenses yet</Text>}
        </Card.Content>
      </Card>

      <Button mode="outlined" onPress={shareInvite} style={{ marginBottom: 8 }}>Share Invite Link</Button>
      <Button mode="contained" onPress={() => navigation.navigate('Settlement', { tripId })} buttonColor="#1565C0">View Final Settlement</Button>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, backgroundColor: '#F8F9FA' },
  title: { fontWeight: '700', color: '#1A1A2E' },
  dest: { color: '#555', marginBottom: 12 },
  card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12 },
  balance: { fontWeight: '700', color: '#2E7D32', marginVertical: 4 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
});`);

writeFile('src/screens/main/AddExpenseScreen.tsx', `import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRecordExpense, useTripMembers, useSession } from '@/lib/queries';
import { inrToPaise, calculateSplit } from '@/lib/financial';

export function AddExpenseScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { data: session } = useSession();
  const { data: members = [] } = useTripMembers(tripId);
  const recordExpense = useRecordExpense();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');

  const onSubmit = async () => {
    const amountPaise = inrToPaise(parseFloat(amount) || 0);
    const participantIds = members.map((m: any) => m.user_id);
    const split = calculateSplit({ participantIds, totalAmountPaise: amountPaise, method: 'equal' });
    const splitAmounts = participantIds.map(id => split.allocations[id] || 0);

    try {
      await recordExpense.mutateAsync({
        tripId, title, amountPaise, category, expenseDate: new Date().toISOString(),
        paidBy: session?.user?.id, paymentSource: 'shared_fund', splitMethod: 'equal',
        participants: participantIds, splitAmounts
      });
      navigation.goBack();
    } catch (e: any) { alert(e.message || 'Failed to record expense'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16 }}>Record Expense</Text>
      <TextInput label="Title (e.g. Dinner)" value={title} onChangeText={setTitle} mode="outlined" style={styles.input} />
      <TextInput label="Amount (₹)" value={amount} onChangeText={setAmount} mode="outlined" keyboardType="decimal-pad" style={styles.input} />
      <TextInput label="Category" value={category} onChangeText={setCategory} mode="outlined" style={styles.input} />
      <Button mode="contained" onPress={onSubmit} loading={recordExpense.isPending} buttonColor="#2E7D32" style={styles.button}>Save Expense</Button>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { padding: 16, backgroundColor: '#F8F9FA' },
  input: { marginBottom: 12, backgroundColor: '#FFF' },
  button: { marginTop: 12, paddingVertical: 6 },
});`);

writeFile('src/screens/main/AddContributionScreen.tsx', `import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRecordContribution, useSession } from '@/lib/queries';
import { inrToPaise } from '@/lib/financial';

export function AddContributionScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { data: session } = useSession();
  const recordContribution = useRecordContribution();
  const [amount, setAmount] = useState('');

  const onSubmit = async () => {
    try {
      await recordContribution.mutateAsync({
        tripId, userId: session?.user?.id, amountPaise: inrToPaise(parseFloat(amount) || 0), isInitial: false
      });
      navigation.goBack();
    } catch (e: any) { alert(e.message || 'Failed to add contribution'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: 16 }}>Add Money to Shared Fund</Text>
      <TextInput label="Amount (₹)" value={amount} onChangeText={setAmount} mode="outlined" keyboardType="decimal-pad" style={styles.input} />
      <Button mode="contained" onPress={onSubmit} loading={recordContribution.isPending} buttonColor="#2E7D32" style={styles.button}>Confirm Deposit</Button>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { padding: 16, backgroundColor: '#F8F9FA' },
  input: { marginBottom: 12, backgroundColor: '#FFF' },
  button: { marginTop: 12, paddingVertical: 6 },
});`);

writeFile('src/screens/main/MembersScreen.tsx', `import React from 'react';
import { FlatList } from 'react-native';
import { List, Chip } from 'react-native-paper';
import { useTripMembers } from '@/lib/queries';

export function MembersScreen({ route }: any) {
  const { tripId } = route.params;
  const { data: members = [] } = useTripMembers(tripId);

  return (
    <FlatList
      data={members}
      keyExtractor={(item: any) => item.id}
      style={{ backgroundColor: '#F8F9FA' }}
      renderItem={({ item }: any) => (
        <List.Item
          title={item.profiles?.full_name || 'User'}
          description={item.profiles?.email}
          right={() => <Chip compact style={{ backgroundColor: '#E8F5E9' }}>{item.role}</Chip>}
        />
      )}
    />
  );
}`);

writeFile('src/screens/main/SettlementScreen.tsx', `import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, ActivityIndicator } from 'react-native-paper';
import { useSettlements, useSharedFundBalance } from '@/lib/queries';
import { formatINR } from '@/lib/financial';

export function SettlementScreen({ route }: any) {
  const { tripId } = route.params;
  const { data: settlements, isLoading } = useSettlements(tripId);
  const { data: balance = 0 } = useSharedFundBalance(tripId);

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#2E7D32" /></View>;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleLarge" style={{ fontWeight: '700' }}>Settlement Overview</Text>
          <Text style={{ marginTop: 8 }}>Remaining Pooled Cash: <Text style={{ fontWeight: '700' }}>{formatINR(balance)}</Text></Text>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: '700' }}>Member Net Positions</Text>
      {(settlements || []).map((s: any) => (
        <Card key={s.user_id} style={styles.card} mode="outlined">
          <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>{s.full_name}</Text>
            <Text style={{ fontWeight: '700', color: s.net_position_paise >= 0 ? '#2E7D32' : '#D32F2F' }}>
              {formatINR(s.net_position_paise)}
            </Text>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, backgroundColor: '#F8F9FA' },
  card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12 },
});`);

writeFile('src/screens/main/ProfileScreen.tsx', `import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSession, useProfile } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

export function ProfileScreen() {
  const { data: session } = useSession();
  const { data: profile } = useProfile(session?.user?.id);

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={{ fontWeight: '700' }}>{profile?.full_name || 'User'}</Text>
      <Text style={{ color: '#666', marginTop: 4 }}>{profile?.email}</Text>
      <Button mode="contained" onPress={() => supabase.auth.signOut()} buttonColor="#D32F2F" style={{ marginTop: 32 }}>Sign Out</Button>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
});`);

// Stubs for remaining routes
['NotificationsScreen', 'JoinTripScreen', 'ContributionRequestsScreen', 'RequestMoneyScreen', 'MemberBalanceScreen', 'ExpenseDetailScreen'].forEach(name => {
  writeFile('src/screens/main/' + name + '.tsx', `import React from 'react';
import { View, Text } from 'react-native';
export function ` + name + `() {
  return <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}><Text>` + name + `</Text></View>;
}`);
});

// 10. App.tsx
writeFile('App.tsx', `import React from 'react';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 30000 } } });

const theme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: '#2E7D32', background: '#F8F9FA', surface: '#FFFFFF' },
  roundness: 12,
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
}`);

console.log('\n✅ ALL FILES GENERATED SUCCESSFULLY!');