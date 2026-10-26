const fs = require('fs');
const path = require('path');
function w(f, c) {
  const p = path.join(__dirname, f);
  fs.writeFileSync(p, c.trim(), 'utf8');
  console.log('Updated', f);
}

// 1. UPDATE TRIP DETAIL SCREEN (Hide buttons for members, show personal balance)
w('src/screens/main/TripDetailScreen.tsx', `
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Share, Pressable, StatusBar, Modal } from 'react-native';
import { Text, Button, ProgressBar, ActivityIndicator } from 'react-native-paper';
import { useSession, useTrip, useSharedFundBalance, useContributions, useExpenses, useTripMembers } from '@/lib/queries';
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

  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const myUserId = session?.user?.id;
  const myMemberInfo = members.find((m: any) => m.user_id === myUserId);
  const isOrganizer = myMemberInfo?.role === 'organizer';

  // Calculate shared fund usage
  const totalIn = contributions.reduce((s: number, c: any) => s + (c.amount_paise || 0), 0);
  const totalOut = expenses.reduce((s: number, e: any) => s + (e.amount_paise || 0), 0);
  const usage = totalIn > 0 ? Math.min(totalOut / totalIn, 1) : 0;

  // Calculate my personal balance
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{trip?.name}</Text>
        <Text style={styles.heroDest}>📍 {trip?.destination}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* SHARED FUND CARD (Everyone sees) */}
        <View style={styles.fundCard}>
          <Text style={styles.fundLabel}>Shared Group Fund</Text>
          <Text style={styles.fundValue}>{formatINR(balance)}</Text>
          <ProgressBar progress={usage} color={colors.primary} style={styles.progress} />
          <View style={styles.fundRow}>
            <Text style={styles.fundMeta}>Pooled: {formatINR(totalIn)}</Text>
            <Text style={styles.fundMeta}>Spent: {formatINR(totalOut)}</Text>
          </View>
        </View>

        {/* MY BALANCE CARD (Everyone sees their own) */}
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

        {/* ORGANIZER ACTIONS (Only Organizer sees) */}
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

      </ScrollView>

      {/* INVITE MODAL */}
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
});
`);

// 2. UPDATE ADD CONTRIBUTION SCREEN (Organizer can select which member)
w('src/screens/main/AddContributionScreen.tsx', `
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRecordContribution, useTripMembers, useSession } from '@/lib/queries';
import { inrToPaise } from '@/lib/financial';
import { colors } from '@/theme/colors';

export function AddContributionScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { data: session } = useSession();
  const { data: members = [] } = useTripMembers(tripId);
  const recordContribution = useRecordContribution();
  
  const [amount, setAmount] = useState('');
  const [selectedUser, setSelectedUser] = useState(session?.user?.id);

  const onSubmit = async () => {
    if (!amount || !selectedUser) return alert('Enter amount and select a member');
    try {
      await recordContribution.mutateAsync({
        tripId, 
        userId: selectedUser, 
        amountPaise: inrToPaise(parseFloat(amount) || 0), 
        isInitial: false
      });
      navigation.goBack();
    } catch (e: any) { alert(e.message || 'Failed to add contribution'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Add money to pool</Text>
      
      <Text style={styles.label}>Who is contributing?</Text>
      <View style={styles.memberList}>
        {members.map((m: any) => (
          <Pressable 
            key={m.user_id} 
            onPress={() => setSelectedUser(m.user_id)}
            style={[styles.memberChip, selectedUser === m.user_id && styles.memberChipOn]}
          >
            <Text style={[styles.memberText, selectedUser === m.user_id && styles.memberTextOn]}>
              {m.profiles?.full_name || 'Member'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput 
        mode="outlined" value={amount} onChangeText={setAmount} 
        keyboardType="decimal-pad" style={styles.input} placeholder="e.g. 1000"
        outlineColor={colors.border} activeOutlineColor={colors.primary} 
        outlineStyle={{ borderRadius: 14 }} 
      />

      <Button mode="contained" onPress={onSubmit} loading={recordContribution.isPending} 
        buttonColor={colors.primary} style={styles.btn} labelStyle={{ fontWeight: '800' }}>
        Confirm Deposit
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.black, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#fff', marginBottom: 12 },
  btn: { marginTop: 24, paddingVertical: 6, borderRadius: 14 },
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  memberChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  memberText: { color: '#64748B', fontWeight: '600' },
  memberTextOn: { color: colors.primary, fontWeight: '800' },
});
`);