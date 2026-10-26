const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
const tripDetailPath = path.join(process.cwd(), 'src', 'screens', 'main', 'TripDetailScreen.tsx');

// 1. REWRITE QUERIES.TS TO MATCH EXACT SUPABASE SCHEMA
const cleanQueriesCode = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
  });
}

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, fullName }: { userId: string; fullName: string }) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
}

export function useMyTrips(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['my-trips', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('trip_members')
        .select('role, trip_id, trips(*)')
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      // 1. Fetch trip details
      const { data: trip, error: tErr } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      if (tErr) throw tErr;

      // 2. Fetch active invite code from invitations table
      const { data: inv } = await supabase
        .from('invitations')
        .select('code')
        .eq('trip_id', tripId)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...trip,
        title: trip.title || trip.name || 'Trip Overview',
        invite_code: inv?.code || trip.invite_code || trip.code || 'NO_CODE',
      };
    },
    enabled: !!tripId,
  });
}

export function useTripDetails(tripId: string) {
  return useTrip(tripId);
}

// Helper to convert paise to INR float
function paiseToInr(paise: any): number {
  if (paise == null) return 0;
  return Number(paise) / 100;
}

export function useSharedFundBalance(tripId: string) {
  return useQuery({
    queryKey: ['shared-fund-balance', tripId],
    queryFn: async () => {
      if (!tripId) return 0;

      // 1. Sum contributions amount_paise
      const { data: contribs } = await supabase
        .from('contributions')
        .select('amount_paise')
        .eq('trip_id', tripId);

      const totalContribPaise = (contribs || []).reduce(
        (sum, c) => sum + (Number(c.amount_paise) || 0),
        0
      );

      // 2. Sum expenses amount_paise for shared_fund
      const { data: exps } = await supabase
        .from('expenses')
        .select('amount_paise')
        .eq('trip_id', tripId)
        .eq('payment_source', 'shared_fund');

      const totalExpPaise = (exps || []).reduce(
        (sum, e) => sum + (Number(e.amount_paise) || 0),
        0
      );

      return paiseToInr(totalContribPaise - totalExpPaise);
    },
    enabled: !!tripId,
  });
}

export function useUserNetBalance(tripId: string, userId: string) {
  return useQuery({
    queryKey: ['user-net-balance', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return 0;

      // User contributions
      const { data: contribs } = await supabase
        .from('contributions')
        .select('amount_paise')
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      const totalContribPaise = (contribs || []).reduce(
        (sum, c) => sum + (Number(c.amount_paise) || 0),
        0
      );

      // User splits across trip expenses
      const { data: exps } = await supabase
        .from('expenses')
        .select('id')
        .eq('trip_id', tripId);

      const expIds = (exps || []).map((e) => e.id);
      let totalSplitsPaise = 0;

      if (expIds.length > 0) {
        const { data: splits } = await supabase
          .from('expense_splits')
          .select('amount_paise')
          .eq('user_id', userId)
          .in('expense_id', expIds);

        totalSplitsPaise = (splits || []).reduce(
          (sum, s) => sum + (Number(s.amount_paise) || 0),
          0
        );
      }

      return paiseToInr(totalContribPaise - totalSplitsPaise);
    },
    enabled: !!tripId && !!userId,
  });
}

export function useTripExpenses(tripId: string) {
  return useQuery({
    queryKey: ['trip-expenses', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((e) => ({
        ...e,
        amount: paiseToInr(e.amount_paise),
      }));
    },
    enabled: !!tripId,
  });
}

export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async () => {
      const { data: members, error: mErr } = await supabase
        .from('trip_members')
        .select('id, role, user_id')
        .eq('trip_id', tripId);

      if (mErr) throw mErr;
      if (!members || members.length === 0) return [];

      const userIds = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const pMap = new Map((profiles || []).map((p) => [p.id, p]));

      return members.map((m) => ({
        ...m,
        profiles: pMap.get(m.user_id) || { full_name: 'Member' },
      }));
    },
    enabled: !!tripId,
  });
}

export function useMemberDetails(tripId: string, userId: string | null) {
  return useQuery({
    queryKey: ['member-details', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return null;

      const { data: contributions } = await supabase
        .from('contributions')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data: tripExpenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId);

      const expenseIds = (tripExpenses || []).map((e) => e.id);
      let splits: any[] = [];

      if (expenseIds.length > 0) {
        const { data: splitData } = await supabase
          .from('expense_splits')
          .select('*')
          .eq('user_id', userId)
          .in('expense_id', expenseIds);

        const expMap = new Map((tripExpenses || []).map((e) => [e.id, e]));
        splits = (splitData || []).map((s) => ({
          ...s,
          expense: expMap.get(s.expense_id),
        }));
      }

      const totalContribPaise = (contributions || []).reduce(
        (sum, c) => sum + (Number(c.amount_paise) || 0),
        0
      );
      const totalSplitsPaise = splits.reduce(
        (sum, s) => sum + (Number(s.amount_paise) || 0),
        0
      );

      return {
        totalContributed: paiseToInr(totalContribPaise),
        totalExpenseShare: paiseToInr(totalSplitsPaise),
        netBalance: paiseToInr(totalContribPaise - totalSplitsPaise),
        contributions: (contributions || []).map((c) => ({
          ...c,
          amount: paiseToInr(c.amount_paise),
        })),
        splits: splits.map((s) => ({
          ...s,
          amount: paiseToInr(s.amount_paise),
        })),
      };
    },
    enabled: !!tripId && !!userId,
  });
}

export function useRecordContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const p = payload || {};
      const tripId = p.tripId || p.trip_id;
      const userId = p.userId || p.user_id || p.paid_by;

      let rawRupees = 0;
      if (p.amountPaise != null) rawRupees = Number(p.amountPaise) / 100;
      else if (p.amount != null) rawRupees = Number(p.amount);
      else if (p.expense?.amount != null) rawRupees = Number(p.expense.amount);
      else if (p.contribution?.amount != null) rawRupees = Number(p.contribution.amount);

      const paiseVal = Math.round(rawRupees * 100);

      // Record Expense
      if (p.expense || p.title || (p.amount != null && p.payment_source != null)) {
        const title = p.expense?.title || p.title || 'Expense';
        const category = p.category || p.expense?.category || 'food';
        const paymentSource = p.expense?.payment_source || p.payment_source || 'shared_fund';

        const { data: exp, error: eErr } = await supabase
          .from('expenses')
          .insert({
            trip_id: tripId,
            title: title,
            amount_paise: paiseVal,
            category: category,
            paid_by: userId,
            recorded_by: userId,
            payment_source: paymentSource,
            split_method: 'equal',
          })
          .select()
          .single();

        if (eErr) throw eErr;

        // Auto split equally among trip members
        const { data: members } = await supabase
          .from('trip_members')
          .select('user_id')
          .eq('trip_id', tripId);

        if (members && members.length > 0) {
          const splitPaise = Math.round(paiseVal / members.length);
          const rows = members.map((m) => ({
            expense_id: exp.id,
            user_id: m.user_id,
            amount_paise: splitPaise,
          }));

          const { error: sErr } = await supabase.from('expense_splits').insert(rows);
          if (sErr) console.warn('Splits insert warning:', sErr);
        }
      } else {
        // Record Contribution (Add Funds)
        const { error: cErr } = await supabase.from('contributions').insert({
          trip_id: tripId,
          user_id: userId,
          amount_paise: paiseVal,
          recorded_by: userId,
          status: 'confirmed',
          notes: p.notes || null,
        });

        if (cErr) throw cErr;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-fund-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-net-balance'] });
      queryClient.invalidateQueries({ queryKey: ['trip-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
      queryClient.invalidateQueries({ queryKey: ['trip'] });
    },
  });
}

export const useRecordExpense = useRecordContribution;

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) throw error;
      return tripId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trips'] });
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, description, userId }: { title: string; description?: string; userId: string }) => {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data: trip, error: tErr } = await supabase
        .from('trips')
        .insert({
          name: title,
          description: description || '',
          created_by: userId,
          currency: 'INR',
          status: 'active',
        })
        .select()
        .single();

      if (tErr) throw tErr;

      // Insert trip member host
      await supabase
        .from('trip_members')
        .insert({ trip_id: trip.id, user_id: userId, role: 'organizer' });

      // Insert invitation code
      await supabase
        .from('invitations')
        .insert({ trip_id: trip.id, code: code, created_by: userId });

      return trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trips'] });
    },
  });
}

export function useJoinTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteCode }: { inviteCode: string }) => {
      const { data, error } = await supabase.rpc('join_trip_via_invitation', { p_code: inviteCode });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trips'] });
    },
  });
}
`;

fs.writeFileSync(queriesPath, cleanQueriesCode, 'utf8');
console.log('✅ queries.ts rewritten to match exact Supabase database schema!');

// 2. REWRITE TRIPDETAILSCREEN.TSX FOR ACCURATE FORMATTING
const cleanTripDetailCode = `import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Card, Title, Button } from 'react-native-paper';
import { colors } from '../../theme/colors';
import {
  useSession,
  useTripDetails,
  useSharedFundBalance,
  useUserNetBalance,
  useTripExpenses,
  useTripMembers,
  useMemberDetails,
  useDeleteTrip,
} from '../../lib/queries';
import { MainStackParamList } from '../../navigation/types';

type TripDetailRouteProp = RouteProp<MainStackParamList, 'TripDetail'>;

// Currency Formatter
function formatINR(val: number): string {
  const abs = Math.abs(val || 0);
  return '₹' + abs.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function TripDetailScreen() {
  const route = useRoute<TripDetailRouteProp>();
  const navigation = useNavigation<any>();
  const { tripId } = route.params;

  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [selectedMember, setSelectedMember] = useState<any>(null);

  const { data: trip, isLoading: tripLoading } = useTripDetails(tripId);
  const { data: sharedFund, isLoading: fundLoading } = useSharedFundBalance(tripId);
  const { data: netBalance, isLoading: balanceLoading } = useUserNetBalance(tripId, userId || '');
  const { data: expenses, isLoading: expensesLoading } = useTripExpenses(tripId);
  const { data: members, isLoading: membersLoading } = useTripMembers(tripId);

  const deleteTripMutation = useDeleteTrip();

  const isOrganizer = trip?.created_by === userId;

  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTripMutation.mutateAsync(tripId);
              Alert.alert('Success', 'Trip deleted successfully');
              navigation.navigate('Dashboard');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete trip');
            }
          },
        },
      ]
    );
  };

  if (tripLoading || fundLoading || balanceLoading || expensesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const poolVal = sharedFund || 0;
  const netVal = netBalance || 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Title style={styles.title}>{trip?.title || trip?.name || 'Trip Overview'}</Title>
        {!!trip?.description && <Text style={styles.description}>{trip?.description}</Text>}
      </View>

      {/* Shared Fund Balance */}
      <Card style={styles.balanceCard}>
        <Card.Content>
          <Text style={styles.cardLabel}>Shared Pool Balance</Text>
          <Text style={[styles.balanceAmount, { color: poolVal < 0 ? '#DC2626' : colors.primary }]}>
            {poolVal < 0 ? \`- \${formatINR(poolVal)}\` : formatINR(poolVal)}
          </Text>
        </Card.Content>
      </Card>

      {/* Personal Net Balance */}
      <Card style={[styles.balanceCard, styles.personalCard]}>
        <Card.Content>
          <Text style={styles.cardLabel}>Your Net Position</Text>
          <Text
            style={[
              styles.balanceAmount,
              { color: netVal >= 0 ? '#16A34A' : '#DC2626' },
            ]}
          >
            {netVal >= 0 ? \`+ \${formatINR(netVal)}\` : \`- \${formatINR(netVal)}\`}
          </Text>
          <Text style={styles.subtext}>
            {netVal >= 0 ? 'Surplus / You are owed' : 'Pending / You owe money'}
          </Text>
        </Card.Content>
      </Card>

      {/* Organizer Action Buttons */}
      {isOrganizer && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.actionCardBtn}
            onPress={() => navigation.navigate('AddExpense', { tripId })}
          >
            <Text style={styles.actionBtnText}>+ Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCardBtn}
            onPress={() => navigation.navigate('AddContribution', { tripId })}
          >
            <Text style={styles.actionBtnText}>+ Money</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCardBtn, styles.inviteBtn]}
            onPress={() => Alert.alert('Invite Code', \`Share code: \${trip?.invite_code}\`)}
          >
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trip Members Section */}
      <View style={styles.membersSection}>
        <Text style={styles.sectionTitle}>Trip Members ({members?.length || 0})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersRow}>
          {members?.map((m: any) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setSelectedMember(m)}
              activeOpacity={0.7}
              style={styles.memberChip}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: m.role === 'organizer' ? colors.primary : '#64748B' },
                ]}
              >
                <Text style={styles.avatarText}>
                  {m.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.profiles?.full_name || 'Member'}
              </Text>
              {m.role === 'organizer' && <Text style={styles.roleTag}>Host</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recent Expenses List */}
      <Text style={[styles.sectionTitle, { marginHorizontal: 20 }]}>Recent Expenses</Text>
      <View style={styles.expenseList}>
        {expenses && expenses.length > 0 ? (
          expenses.map((item: any) => (
            <Card key={item.id} style={styles.expenseCard}>
              <Card.Content style={styles.expenseContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expenseTitle}>{item.title}</Text>
                  <Text style={styles.expenseSub}>
                    Paid via: {item.payment_source === 'shared_fund' ? 'Shared Fund' : 'Personal'}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>{formatINR(item.amount)}</Text>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Text style={styles.emptyText}>No expenses recorded yet.</Text>
        )}
      </View>

      {/* Organizer Delete Trip Button */}
      {isOrganizer && (
        <View style={styles.deleteContainer}>
          <Button
            mode="contained"
            buttonColor="#EF4444"
            textColor="#FFFFFF"
            style={styles.deleteButton}
            loading={deleteTripMutation.isPending}
            onPress={handleDeleteTrip}
          >
            Delete Trip
          </Button>
        </View>
      )}

      {/* Member Detail Sheet Modal */}
      <MemberDetailModal
        visible={!!selectedMember}
        member={selectedMember}
        tripId={tripId}
        onClose={() => setSelectedMember(null)}
      />
    </ScrollView>
  );
}

function MemberDetailModal({
  visible,
  member,
  tripId,
  onClose,
}: {
  visible: boolean;
  member: any;
  tripId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useMemberDetails(tripId, member?.user_id);

  if (!visible || !member) return null;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <View style={modalStyles.header}>
            <View
              style={[
                modalStyles.avatar,
                { backgroundColor: member.role === 'organizer' ? colors.primary : '#64748B' },
              ]}
            >
              <Text style={modalStyles.avatarText}>
                {member.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={modalStyles.name}>{member.profiles?.full_name || 'Member'}</Text>
              <Text style={modalStyles.role}>
                {member.role === 'organizer' ? 'Organizer (Host)' : 'Trip Member'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={{ fontSize: 20, color: '#64748B', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Summary Cards */}
              <View style={modalStyles.summaryRow}>
                <View style={[modalStyles.card, { backgroundColor: '#E6FFFA', borderColor: '#0F766E' }]}>
                  <Text style={modalStyles.cardLabel}>Contributed</Text>
                  <Text style={[modalStyles.cardValue, { color: '#0F766E' }]}>
                    {formatINR(data?.totalContributed || 0)}
                  </Text>
                </View>

                <View style={[modalStyles.card, { backgroundColor: '#FFF7ED', borderColor: '#EA580C' }]}>
                  <Text style={modalStyles.cardLabel}>Expense Share</Text>
                  <Text style={[modalStyles.cardValue, { color: '#EA580C' }]}>
                    {formatINR(data?.totalExpenseShare || 0)}
                  </Text>
                </View>
              </View>

              {/* Net Position */}
              <View
                style={[
                  modalStyles.netCard,
                  {
                    backgroundColor: (data?.netBalance || 0) >= 0 ? '#F0FDF4' : '#FEF2F2',
                    borderColor: (data?.netBalance || 0) >= 0 ? '#16A34A' : '#DC2626',
                  },
                ]}
              >
                <Text style={modalStyles.netLabel}>Net Balance Status</Text>
                <Text
                  style={[
                    modalStyles.netValue,
                    { color: (data?.netBalance || 0) >= 0 ? '#16A34A' : '#DC2626' },
                  ]}
                >
                  {(data?.netBalance || 0) >= 0
                    ? \`+ \${formatINR(data?.netBalance || 0)} (Surplus / Owed Back)\`
                    : \`- \${formatINR(data?.netBalance || 0)} (Pending / Owes)\`}
                </Text>
              </View>

              {/* Contributions Breakdown */}
              <Text style={modalStyles.sectionTitle}>Contributions ({data?.contributions?.length || 0})</Text>
              {data?.contributions?.length === 0 ? (
                <Text style={modalStyles.emptyText}>No contributions recorded.</Text>
              ) : (
                data?.contributions.map((c: any) => (
                  <View key={c.id} style={modalStyles.listItem}>
                    <Text style={{ fontWeight: '600', color: '#1E293B' }}>{c.notes || 'Fund Contribution'}</Text>
                    <Text style={{ fontWeight: 'bold', color: '#0F766E' }}>+{formatINR(c.amount)}</Text>
                  </View>
                ))
              )}

              {/* Splits Breakdown */}
              <Text style={[modalStyles.sectionTitle, { marginTop: 15 }]}>
                Expense Splits ({data?.splits?.length || 0})
              </Text>
              {data?.splits?.length === 0 ? (
                <Text style={modalStyles.emptyText}>No expense splits assigned.</Text>
              ) : (
                data?.splits.map((s: any) => (
                  <View key={s.id} style={modalStyles.listItem}>
                    <Text style={{ fontWeight: '600', color: '#1E293B' }}>{s.expense?.title || 'Expense'}</Text>
                    <Text style={{ fontWeight: 'bold', color: '#EA580C' }}>-{formatINR(s.amount)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default TripDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  balanceCard: {
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 12,
    elevation: 2,
    backgroundColor: '#FFFFFF',
  },
  personalCard: {
    backgroundColor: '#F1F5F9',
  },
  cardLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  subtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 15,
  },
  actionCardBtn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  membersSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#115E59',
    marginBottom: 12,
  },
  membersRow: {
    flexDirection: 'row',
  },
  memberChip: {
    alignItems: 'center',
    marginRight: 16,
    width: 65,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  memberName: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    color: '#334155',
    fontWeight: '500',
  },
  roleTag: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: 1,
  },
  expenseList: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  expenseCard: {
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  expenseContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  expenseSub: {
    fontSize: 12,
    color: '#64748B',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  emptyText: {
    color: '#94A3B8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  deleteContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  deleteButton: {
    borderRadius: 8,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  role: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    flex: 0.48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardLabel: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  netCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  netLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  netValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    justify.content: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
});
`;

fs.writeFileSync(tripDetailPath, cleanTripDetailCode.replace("justify.content: 'space-between'", "justifyContent: 'space-between'"), 'utf8');
console.log('✅ TripDetailScreen.tsx rewritten with exact schema calculations!');