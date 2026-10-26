const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
const tripDetailPath = path.join(process.cwd(), 'src', 'screens', 'main', 'TripDetailScreen.tsx');

// 1. Clean and bulletproof queries.ts
const cleanQueries = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    },
  });
}

export function useProfile(userId?: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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

export function useMyTrips(userId?: string | null) {
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
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}

export function useTripDetails(tripId: string) {
  return useTrip(tripId);
}

// Fixed Shared Fund Balance calculation
export function useSharedFundBalance(tripId: string) {
  return useQuery({
    queryKey: ['shared-fund-balance', tripId],
    queryFn: async () => {
      if (!tripId) return 0;
      
      // Sum contributions
      const { data: contribs, error: cErr } = await supabase
        .from('contributions')
        .select('amount')
        .eq('trip_id', tripId);
      
      if (cErr) console.warn('contrib error:', cErr);
      const totalContrib = (contribs || []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

      // Sum shared fund expenses
      const { data: exps, error: eErr } = await supabase
        .from('expenses')
        .select('amount, payment_source')
        .eq('trip_id', tripId)
        .eq('payment_source', 'shared_fund');

      if (eErr) console.warn('expenses error:', eErr);
      const totalSharedExp = (exps || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

      return totalContrib - totalSharedExp;
    },
    enabled: !!tripId,
  });
}

// Fixed User Net Balance
export function useUserNetBalance(tripId: string, userId: string) {
  return useQuery({
    queryKey: ['user-net-balance', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return 0;

      const { data: contribs } = await supabase
        .from('contributions')
        .select('amount')
        .eq('trip_id', tripId)
        .eq('user_id', userId);
      const totalContrib = (contribs || []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

      const { data: exps } = await supabase
        .from('expenses')
        .select('id')
        .eq('trip_id', tripId);
      const expIds = (exps || []).map(e => e.id);

      let totalSplits = 0;
      if (expIds.length > 0) {
        const { data: splits } = await supabase
          .from('expense_splits')
          .select('amount')
          .eq('user_id', userId)
          .in('expense_id', expIds);
        totalSplits = (splits || []).reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      }

      return totalContrib - totalSplits;
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
      return data || [];
    },
    enabled: !!tripId,
  });
}

// Fixed Trip Members query with fallback profile fetching
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

      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone_number')
        .in('id', userIds);

      if (pErr) console.warn('Profiles fetch warning:', pErr);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return members.map(m => ({
        ...m,
        profiles: profileMap.get(m.user_id) || { full_name: 'Member', phone_number: '' }
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
        .select('id, title, amount, created_at')
        .eq('trip_id', tripId);

      const expenseIds = (tripExpenses || []).map(e => e.id);
      let splits: any[] = [];
      if (expenseIds.length > 0) {
        const { data: splitData } = await supabase
          .from('expense_splits')
          .select('id, expense_id, amount, is_settled')
          .eq('user_id', userId)
          .in('expense_id', expenseIds);

        const expMap = new Map((tripExpenses || []).map(e => [e.id, e]));
        splits = (splitData || []).map(s => ({
          ...s,
          expense: expMap.get(s.expense_id),
        }));
      }

      const totalContributed = (contributions || []).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
      const totalExpenseShare = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      const netBalance = totalContributed - totalExpenseShare;

      return {
        totalContributed,
        totalExpenseShare,
        netBalance,
        contributions: contributions || [],
        splits,
      };
    },
    enabled: !!tripId && !!userId,
  });
}

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
        .insert({ title, description, created_by: userId, invite_code: code })
        .select()
        .single();
      if (tErr) throw tErr;

      const { error: mErr } = await supabase
        .from('trip_members')
        .insert({ trip_id: trip.id, user_id: userId, role: 'organizer' });
      if (mErr) throw mErr;

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

fs.writeFileSync(queriesPath, cleanQueries, 'utf8');
console.log('✅ src/lib/queries.ts repaired with robust calculations and fallbacks.');

// 2. Update TripDetailScreen.tsx for proper button layout & member display
const cleanTripDetail = `import React, { useState } from 'react';
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

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Title style={styles.title}>{trip?.title}</Title>
        {!!trip?.description && <Text style={styles.description}>{trip?.description}</Text>}
      </View>

      {/* Shared Fund Balance */}
      <Card style={styles.balanceCard}>
        <Card.Content>
          <Text style={styles.cardLabel}>Shared Pool Balance</Text>
          <Text style={[styles.balanceAmount, { color: (sharedFund || 0) < 0 ? '#DC2626' : colors.primary }]}>
            {(sharedFund || 0) < 0 ? \`- ₹\${Math.abs(sharedFund || 0)}\` : \`₹\${sharedFund || 0}\`}
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
              { color: (netBalance || 0) >= 0 ? '#16A34A' : '#DC2626' },
            ]}
          >
            {(netBalance || 0) >= 0 ? \`+ ₹\${netBalance || 0}\` : \`- ₹\${Math.abs(netBalance || 0)}\`}
          </Text>
          <Text style={styles.subtext}>
            {(netBalance || 0) >= 0 ? 'Surplus / You are owed' : 'Pending / You owe money'}
          </Text>
        </Card.Content>
      </Card>

      {/* Organizer Action Buttons with fixed non-truncated labels */}
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
                <Text style={styles.expenseAmount}>₹{item.amount}</Text>
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
              <Text style={modalStyles.phone}>{member.profiles?.phone_number || ''}</Text>
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
                  <Text style={[modalStyles.cardValue, { color: '#0F766E' }]}>₹{data?.totalContributed || 0}</Text>
                </View>

                <View style={[modalStyles.card, { backgroundColor: '#FFF7ED', borderColor: '#EA580C' }]}>
                  <Text style={modalStyles.cardLabel}>Expense Share</Text>
                  <Text style={[modalStyles.cardValue, { color: '#EA580C' }]}>₹{data?.totalExpenseShare || 0}</Text>
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
                    ? \`+ ₹\${data?.netBalance || 0} (Surplus / Owed Back)\`
                    : \`- ₹\${Math.abs(data?.netBalance || 0)} (Pending / Owes)\`}
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
                    <Text style={{ fontWeight: 'bold', color: '#0F766E' }}>+₹{c.amount}</Text>
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
                    <Text style={{ fontWeight: 'bold', color: '#EA580C' }}>-₹{s.amount}</Text>
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
    justify.content: 'center',
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
  phone: {
    fontSize: 13,
    color: '#64748B',
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
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
});
`;

// Fix typo in avatar style if present
const fixedTripDetail = cleanTripDetail.replace("justify.content: 'center'", "justifyContent: 'center'");

fs.writeFileSync(tripDetailPath, fixedTripDetail, 'utf8');
console.log('✅ TripDetailScreen.tsx updated with clean buttons and member list.');