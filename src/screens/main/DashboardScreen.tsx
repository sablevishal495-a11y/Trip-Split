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
          keyExtractor={(item: any) => item.id}
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
              onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.trip_members?.[0]?.role === 'organizer' ? '👑 Organizer' : '👤 Member'}</Text>
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