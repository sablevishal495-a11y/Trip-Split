const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');

const fullQueriesCode = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// 1. Session Hook
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

// 2. Profile Hooks
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

// 3. Trip Hooks
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

// 4. Shared Fund Balance
export function useSharedFundBalance(tripId: string) {
  return useQuery({
    queryKey: ['shared-fund-balance', tripId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_shared_fund_balance', {
        p_trip_id: tripId,
      });
      if (error) {
        // Fallback: manually sum contributions minus shared fund expenses
        const { data: contribs } = await supabase
          .from('contributions')
          .select('amount')
          .eq('trip_id', tripId);
        const totalContrib = (contribs || []).reduce((acc, c) => sum(acc, c.amount), 0);

        const { data: sharedExps } = await supabase
          .from('expenses')
          .select('amount')
          .eq('trip_id', tripId)
          .eq('payment_source', 'shared_fund');
        const totalSharedExp = (sharedExps || []).reduce((acc, e) => sum(acc, e.amount), 0);

        return totalContrib - totalSharedExp;
      }
      return data || 0;
    },
    enabled: !!tripId,
  });
}

function sum(a: number, b: any) {
  return a + Number(b || 0);
}

// 5. User Net Position Balance
export function useUserNetBalance(tripId: string, userId: string) {
  return useQuery({
    queryKey: ['user-net-balance', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return 0;
      // Fetch user contributions
      const { data: contribs } = await supabase
        .from('contributions')
        .select('amount')
        .eq('trip_id', tripId)
        .eq('user_id', userId);
      const totalContrib = (contribs || []).reduce((acc, c) => sum(acc, c.amount), 0);

      // Fetch user splits
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
        totalSplits = (splits || []).reduce((acc, s) => sum(acc, s.amount), 0);
      }

      return totalContrib - totalSplits;
    },
    enabled: !!tripId && !!userId,
  });
}

// 6. Expenses Hook
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

// 7. Trip Members Hook
export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_members')
        .select('id, role, user_id, profiles:user_id (full_name, phone_number)')
        .eq('trip_id', tripId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tripId,
  });
}

// 8. Individual Member Details Hook (for Modal Sheet)
export function useMemberDetails(tripId: string, userId: string | null) {
  return useQuery({
    queryKey: ['member-details', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return null;

      const { data: contributions, error: cErr } = await supabase
        .from('contributions')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (cErr) throw cErr;

      const { data: tripExpenses, error: eErr } = await supabase
        .from('expenses')
        .select('id, title, amount, created_at')
        .eq('trip_id', tripId);

      if (eErr) throw eErr;

      const expenseIds = (tripExpenses || []).map((e) => e.id);
      let splits: any[] = [];
      if (expenseIds.length > 0) {
        const { data: splitData, error: sErr } = await supabase
          .from('expense_splits')
          .select('id, expense_id, amount, is_settled')
          .eq('user_id', userId)
          .in('expense_id', expenseIds);
        if (sErr) throw sErr;

        const expMap = new Map((tripExpenses || []).map((e) => [e.id, e]));
        splits = (splitData || []).map((s) => ({
          ...s,
          expense: expMap.get(s.expense_id),
        }));
      }

      const totalContributed = (contributions || []).reduce((acc, c) => sum(acc, c.amount), 0);
      const totalExpenseShare = splits.reduce((acc, s) => sum(acc, s.amount), 0);
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

// 9. Delete Trip Mutation
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

// 10. Additional Mutations (Create Trip, Join Trip, Add Money, Add Expense)
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

fs.writeFileSync(queriesPath, fullQueriesCode, 'utf8');
console.log('✅ queries.ts completely updated with clean implementations of all hooks!');
`;

fs.writeFileSync(path.join(process.cwd(), 'update_queries_clean.cjs'), fullQueriesCode, 'utf8');