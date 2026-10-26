const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');

const ts = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useProfile(userId) {
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
    mutationFn: async (vars) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: vars.fullName })
        .eq('id', vars.userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['profile', vars.userId] });
    },
  });
}

export function useMyTrips(userId) {
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

export function useTrip(tripId) {
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

export function useTripDetails(tripId) {
  return useTrip(tripId);
}

export function useSharedFundBalance(tripId) {
  return useQuery({
    queryKey: ['shared-fund-balance', tripId],
    queryFn: async () => {
      if (!tripId) return 0;
      const { data: contribs } = await supabase
        .from('contributions')
        .select('amount')
        .eq('trip_id', tripId);
      const totalContrib = (contribs || []).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

      const { data: exps } = await supabase
        .from('expenses')
        .select('amount')
        .eq('trip_id', tripId)
        .eq('payment_source', 'shared_fund');
      const totalSharedExp = (exps || []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

      return totalContrib - totalSharedExp;
    },
    enabled: !!tripId,
  });
}

export function useUserNetBalance(tripId, userId) {
  return useQuery({
    queryKey: ['user-net-balance', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return 0;
      const { data: contribs } = await supabase
        .from('contributions')
        .select('amount')
        .eq('trip_id', tripId)
        .eq('user_id', userId);
      const totalContrib = (contribs || []).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

      const { data: exps } = await supabase
        .from('expenses')
        .select('id')
        .eq('trip_id', tripId);
      const expIds = (exps || []).map((e) => e.id);

      let totalSplits = 0;
      if (expIds.length > 0) {
        const { data: splits } = await supabase
          .from('expense_splits')
          .select('amount')
          .eq('user_id', userId)
          .in('expense_id', expIds);
        totalSplits = (splits || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
      }
      return totalContrib - totalSplits;
    },
    enabled: !!tripId && !!userId,
  });
}

export function useTripExpenses(tripId) {
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

export function useTripMembers(tripId) {
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
        .select('id, full_name')
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

export function useMemberDetails(tripId, userId) {
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
        .select('id, title, amount')
        .eq('trip_id', tripId);

      const expenseIds = (tripExpenses || []).map((e) => e.id);
      let splits = [];
      if (expenseIds.length > 0) {
        const { data: splitData } = await supabase
          .from('expense_splits')
          .select('id, expense_id, amount')
          .eq('user_id', userId)
          .in('expense_id', expenseIds);
        const expMap = new Map((tripExpenses || []).map((e) => [e.id, e]));
        splits = (splitData || []).map((s) => ({ ...s, expense: expMap.get(s.expense_id) }));
      }

      const totalContributed = (contributions || []).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
      const totalExpenseShare = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
      const netBalance = totalContributed - totalExpenseShare;

      return { totalContributed, totalExpenseShare, netBalance, contributions: contributions || [], splits };
    },
    enabled: !!tripId && !!userId,
  });
}

export function useRecordContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const p = payload || {};
      const tripId = p.tripId;
      const userId = p.userId;
      let expenseId = null;

      if (p.expense && p.expense.amount != null) {
        const { data: exp, error: eErr } = await supabase
          .from('expenses')
          .insert({
            trip_id: tripId,
            title: p.expense.title || 'Expense',
            amount: Number(p.expense.amount),
            paid_by: p.expense.paid_by || userId,
            payment_source: p.expense.payment_source || 'shared_fund',
            notes: p.expense.notes || null,
          })
          .select()
          .single();
        if (eErr) throw eErr;
        expenseId = exp.id;

        if (Array.isArray(p.splits) && p.splits.length > 0) {
          const rows = p.splits.map((s) => ({
            expense_id: expenseId,
            user_id: s.user_id,
            amount: Number(s.amount),
            is_settled: false,
          }));
          const { error: sErr } = await supabase.from('expense_splits').insert(rows);
          if (sErr) throw sErr;
        }
      }

      if (p.contribution && Number(p.contribution.amount) > 0) {
        await supabase.from('contributions').insert({
          trip_id: tripId,
          user_id: userId,
          amount: Number(p.contribution.amount),
          notes: p.contribution.notes || p.notes || null,
        });
      } else if (p.amount != null && Number(p.amount) > 0 && !p.expense) {
        await supabase.from('contributions').insert({
          trip_id: tripId,
          user_id: userId,
          amount: Number(p.amount),
          notes: p.notes || null,
        });
      }

      return { expenseId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-fund-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-net-balance'] });
      queryClient.invalidateQueries({ queryKey: ['trip-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
    },
  });
}

export const useAddContribution = useRecordContribution;
export const useAddExpense = useRecordContribution;

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId) => {
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
    mutationFn: async (vars) => {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: trip, error: tErr } = await supabase
        .from('trips')
        .insert({ title: vars.title, description: vars.description, created_by: vars.userId, invite_code: code })
        .select()
        .single();
      if (tErr) throw tErr;
      const { error: mErr } = await supabase
        .from('trip_members')
        .insert({ trip_id: trip.id, user_id: vars.userId, role: 'organizer' });
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
    mutationFn: async (vars) => {
      const { data, error } = await supabase.rpc('join_trip_via_invitation', { p_code: vars.inviteCode });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trips'] });
    },
  });
}
`;

fs.writeFileSync(queriesPath, ts, 'utf8');
console.log('✅ queries.ts fully rewritten (clean, no phone_number, with useRecordContribution).');

// Now print the two screens so we can verify the hook call signature
const read = (rel) => {
  const p = path.join(process.cwd(), rel);
  if (fs.existsSync(p)) {
    console.log('\n========== ' + rel + ' ==========');
    console.log(fs.readFileSync(p, 'utf8'));
  } else {
    console.log('\n!! not found: ' + rel);
  }
};
read('src/screens/main/AddExpenseScreen.tsx');
read('src/screens/main/AddContributionScreen.tsx');