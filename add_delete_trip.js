const fs = require('fs');
const path = require('path');

// 1. Update queries.ts
const queriesPath = path.join(__dirname, 'src/lib/queries.ts');
let queriesContent = fs.readFileSync(queriesPath, 'utf8');

if (!queriesContent.includes('useDeleteTrip')) {
  const deleteTripHook = [
    '',
    'export function useDeleteTrip() {',
    '  const qc = useQueryClient();',
    '  return useMutation({',
    '    mutationFn: async (tripId: string) => {',
    '      const { error } = await supabase.from("trips").delete().eq("id", tripId);',
    '      if (error) throw error;',
    '    },',
    '    onSuccess: () => {',
    '      qc.invalidateQueries({ queryKey: ["trips"] });',
    '    },',
    '  });',
    '}',
    ''
  ].join('\n');

  queriesContent += '\n' + deleteTripHook;
  fs.writeFileSync(queriesPath, queriesContent, 'utf8');
  console.log('✅ Updated queries.ts with useDeleteTrip');
}

// 2. Update TripDetailScreen.tsx
const tripDetailPath = path.join(__dirname, 'src/screens/main/TripDetailScreen.tsx');
const tripDetailCode = `import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Share, Pressable, StatusBar, Modal, Alert } from 'react-native';
import { Text, Button, ProgressBar, ActivityIndicator } from 'react-native-paper';
import { useSession, useTrip, useSharedFundBalance, useContributions, useExpenses, useTripMembers, useDeleteTrip } from '@/lib/queries';
import { useTripRealtime } from '@/lib/realtime';
import { formatINR } from '@/lib/financial';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export function TripDetailScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { data: session } = useSession();
  useTripRealtime(tripId);

  const { data: trip, isLoading } = useTrip(tripId);
  const { data: balance = 0 } = useSharedFundBalance(tripId);
  const { data: contributions = [] } = useContributions(tripId);
  const { data: expenses = [] } = useExpenses(tripId);
  const { data: members = [] } = useTripMembers(tripId);
  const deleteTripMutation = useDeleteTrip();

  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const myUserId = session?.user?.id;
  const myMemberInfo = members.find((m: any) => m.user_id === myUserId);
  const isOrganizer = myMemberInfo?.role === 'organizer';

  const totalIn = contributions.reduce((s: number, c: any) => s + (c.amount_paise || 0), 0);
  const totalOut = expenses.reduce((s: number, e: any) => s + (e.amount_paise || 0), 0);
  const usage = totalIn > 0 ? Math.min(totalOut / totalIn, 1) : 0;

  const myTotalContributed = contributions
    .filter((c: any) => c.user_id === myUserId)
    .reduce((s: number, c: any) => s + c.amount_paise, 0);
    
  const myExpenseShares = expenses
    .flatMap((e: any) => e.expense_splits || [])
    .filter((s: any) => s.user_id === myUserId)
    .reduce((sum: number, s: any) => sum + s.amount_paise, 0);
    
  const myNetBalance = myTotalContributed - myExpenseShares;

  const openInvite = async () => {
    setInviteVisible(true);
    const { data: existing } = await supabase.from('invitations').select('code').eq('trip_id', tripId).eq('is_revoked', false).limit(1);
    if (existing && existing.length) setInviteCode(existing[0].code);
    else {
      const { data } = await supabase.rpc('create_invite_code', { p_trip_id: tripId });
      setInviteCode(data?.code || 'ERROR');
    }
  };

  const shareInvite = async () => {
    await Share.share({ message: 'Join "' + trip?.name + '" on TripSplit! Invite code: ' + inviteCode });
  };

  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip?',
      'Are you sure you want to delete this trip? All expenses, contributions, and records will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTripMutation.mutateAsync(tripId);
              navigation.replace('Dashboard');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete trip');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{trip?.name}</Text>
        <Text style={styles.heroDest}>📍 {trip?.destination}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.fundCard}>
          <Text style={styles.fundLabel}>Shared Group Fund</Text>
          <Text style={styles.fundValue}>{formatINR(balance)}</Text>
          <ProgressBar progress={usage} color={colors.primary} style={styles.progress} />
          <View style={styles.fundRow}>
            <Text style={styles.fundMeta}>Pooled: {formatINR(totalIn)}</Text>
            <Text style={styles.fundMeta}>Spent: {formatINR(totalOut)}</Text>
          </View>
        </View>

        <View style={[styles.fundCard, { marginTop: 12, backgroundColor: '#F8FAFC', elevation: 1 }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.fundLabel, { color: colors.black }]}>My Remaining Balance</Text>
            <Text style={[styles.fundValue, { fontSize: 24, color: myNetBalance >= 0 ? colors.success : colors.danger }]}>
              {formatINR(myNetBalance)}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            {myNetBalance >= 0 ? "You have money left in the pool." : "You owe money to the group."}
          </Text>
        </View>

        {isOrganizer && (
          <>
            <Text style={styles.section}>Organizer Actions</Text>
            <View style={styles.actions}>
              <Action icon="🧾" label="Add expense" color="#ECFDF5" onPress={() => navigation.navigate('AddExpense', { tripId })} />
              <Action icon="💵" label="Add money" color="#EFF6FF" onPress={() => navigation.navigate('AddContribution', { tripId })} />
              <Action icon="🔗" label="Invite" color="#FEF3C7" onPress={openInvite} />
              <Action icon="⚖️" label="Settle" color="#FCE7F3" onPress={() => navigation.navigate('Settlement', { tripId })} />
            </View>
          </>
        )}

        <Text style={styles.section}>Recent expenses</Text>
        {(expenses || []).slice(0, 10).map((e: any) => (
          <Pressable key={e.id} style={styles.expRow} onPress={() => navigation.navigate('ExpenseDetail', { tripId, expenseId: e.id })}>
            <View style={styles.expIcon}><Text>🧾</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.expTitle}>{e.title}</Text>
              <Text style={styles.expMeta}>{e.profiles?.full_name?.split(' ')[0] || 'Member'} paid</Text>
            </View>
            <Text style={styles.expAmt}>-{formatINR(e.amount_paise)}</Text>
          </Pressable>
        ))}
        {!expenses.length && <Text style={{ color: '#94A3B8', textAlign: 'center', marginTop: 10 }}>No expenses yet.</Text>}

        {isOrganizer && (
          <Button
            mode="outlined"
            icon="delete"
            onPress={handleDeleteTrip}
            loading={deleteTripMutation.isPending}
            disabled={deleteTripMutation.isPending}
            textColor={colors.danger}
            style={styles.deleteBtn}
            labelStyle={{ fontWeight: '800' }}
          >
            Delete Trip
          </Button>
        )}
      </ScrollView>

      <Modal visible={inviteVisible} transparent animationType="slide" onRequestClose={() => setInviteVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite code</Text>
            <View style={styles.codeBox}><Text style={styles.codeText}>{inviteCode}</Text></View>
            <Button mode="contained" onPress={shareInvite} buttonColor={colors.primary} style={styles.btn}>Share via WhatsApp</Button>
            <Button mode="text" onPress={() => setInviteVisible(false)} textColor="#64748B">Close</Button>
          </View>
        </View>
      </Modal>
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
  hero: { backgroundColor: colors.primary, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 28 },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  heroDest: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  scroll: { padding: 16, paddingBottom: 40 },
  fundCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginTop: -18, elevation: 3 },
  fundLabel: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  fundValue: { fontSize: 36, fontWeight: '800', color: colors.primary, marginVertical: 4 },
  progress: { height: 8, borderRadius: 8, marginTop: 8, backgroundColor: '#E2E8F0' },
  fundRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  fundMeta: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  section: { fontSize: 16, fontWeight: '800', color: colors.black, marginTop: 24, marginBottom: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { width: '47%', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  actionLabel: { marginTop: 6, fontWeight: '700', color: colors.black, fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8 },
  expIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  expTitle: { fontWeight: '700', color: colors.black },
  expMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  expAmt: { fontWeight: '800', color: colors.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.black, marginBottom: 16 },
  codeBox: { backgroundColor: colors.primarySoft, borderRadius: 16, paddingVertical: 20, alignItems: 'center', marginBottom: 16 },
  codeText: { fontSize: 32, fontWeight: '900', letterSpacing: 6, color: colors.primary },
  btn: { borderRadius: 14 },
  deleteBtn: { marginTop: 30, borderRadius: 14, borderColor: colors.danger, borderWidth: 1.5 },
});
`;

fs.writeFileSync(tripDetailPath, tripDetailCode.trim(), 'utf8');
console.log('✅ Updated TripDetailScreen with Delete Trip option!');