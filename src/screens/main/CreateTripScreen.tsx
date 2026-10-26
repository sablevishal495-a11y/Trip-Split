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
      name: name.trim(),
      destination: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      description,
      currency: 'INR',
    });

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