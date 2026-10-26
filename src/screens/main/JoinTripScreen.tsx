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