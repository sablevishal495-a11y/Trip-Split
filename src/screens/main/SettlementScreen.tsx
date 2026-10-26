import React from 'react';
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
});