const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');

const fixedQueriesCode = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
      if (error) throw error;

      if (!data.invite_code && !data.code) {
        const generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        await supabase.from('trips').update({ invite_code: generatedCode }).eq('id', tripId);
        data.invite_code = generatedCode;
      }
      return data;
    },
    enabled: !!tripId,
  });
}

export function useTripDetails(tripId: string) {
  return useTrip(tripId);
}

// Function to convert paise/rupees safely
function getVal(row: any) {
  if (!row) return 0;
  if (row.amount_paise != null) return parseFloat(row.amount_paise) / 100;
  if (row.amount != null) return parseFloat(row.amount);
  return 0;
}

export function useSharedFundBalance(tripId: string) {
  return useQuery({
    queryKey: ['shared-fund-balance', tripId],
    queryFn: async () => {
      if (!tripId) return 0;

      const { data: contribs } = await supabase
        .from('contributions')
        .select('*')
        .eq('trip_id', tripId);
      const totalContrib = (contribs || []).reduce((sum, c) => sum + getVal(c), 0);

      const { data: exps } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .eq('payment_source', 'shared_fund');
      const totalSharedExp = (exps || []).reduce((sum, e) => sum + getVal(e), 0);

      return totalContrib - totalSharedExp;
    },
    enabled: !!tripId,
  });
}

export function useUserNetBalance(tripId: string, userId: string) {
  return useQuery({
    queryKey: ['user-net-balance', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return 0;

      const { data: contribs } = await supabase
        .from('contributions')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId);
      const totalContrib = (contribs || []).reduce((sum, c) => sum + getVal(c), 0);

      const { data: exps } = await supabase
        .from('expenses')
        .select('id')
        .eq('trip_id', tripId);
      const expIds = (exps || []).map((e) => e.id);

      let totalSplits = 0;
      if (expIds.length > 0) {
        const { data: splits } = await supabase
          .from('expense_splits')
          .select('*')
          .eq('user_id', userId)
          .in('expense_id', expIds);
        totalSplits = (splits || []).reduce((sum, s) => sum + getVal(s), 0);
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
      return (data || []).map(e => ({
        ...e,
        amount: getVal(e),
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
        splits = (splitData || []).map((s) => ({ ...s, expense: expMap.get(s.expense_id) }));
      }

      const totalContributed = (contributions || []).reduce((sum, c) => sum + getVal(c), 0);
      const totalExpenseShare = splits.reduce((sum, s) => sum + getVal(s), 0);
      const netBalance = totalContributed - totalExpenseShare;

      return {
        totalContributed,
        totalExpenseShare,
        netBalance,
        contributions: (contributions || []).map(c => ({ ...c, amount: getVal(c) })),
        splits: splits.map(s => ({ ...s, amount: getVal(s) })),
      };
    },
    enabled: !!tripId && !!userId,
  });
}

// Universal Contribution / Expense Mutation supporting BOTH amount and amount_paise columns!
export function useRecordContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const p = payload || {};
      const tripId = p.tripId || p.trip_id;
      const userId = p.userId || p.user_id || p.paid_by;

      // Extract raw amount in Rupees
      let rawRupees = 0;
      if (p.amountPaise != null) rawRupees = parseFloat(p.amountPaise) / 100;
      else if (p.amount != null) rawRupees = parseFloat(p.amount);
      else if (p.expense?.amount != null) rawRupees = parseFloat(p.expense.amount);
      else if (p.contribution?.amount != null) rawRupees = parseFloat(p.contribution.amount);

      const paiseVal = Math.round(rawRupees * 100);

      // A. Recording an Expense
      if (p.expense || p.title || (p.amount != null && p.payment_source != null)) {
        const title = p.expense?.title || p.title || 'Expense';
        const paymentSource = p.expense?.payment_source || p.payment_source || 'shared_fund';
        const category = p.category || 'General';

        // Try inserting into amount_paise first, fallback to amount
        let expObj: any = {
          trip_id: tripId,
          title: title,
          paid_by: userId,
          payment_source: paymentSource,
          category: category,
          amount_paise: paiseVal,
        };

        let { data: exp, error: eErr } = await supabase
          .from('expenses')
          .insert(expObj)
          .select()
          .single();

        if (eErr && eErr.message?.includes('amount_paise')) {
          delete expObj.amount_paise;
          expObj.amount = rawRupees;
          const { data: retryExp, error: rErr } = await supabase
            .from('expenses')
            .insert(expObj)
            .select()
            .single();
          if (rErr) throw rErr;
          exp = retryExp;
        } else if (eErr) {
          delete expObj.amount_paise;
          expObj.amount = rawRupees;
          const { data: retryExp, error: rErr } = await supabase
            .from('expenses')
            .insert(expObj)
            .select()
            .single();
          if (rErr) throw rErr;
          exp = retryExp;
        }

        // Handle splits insertion
        const { data: members } = await supabase
          .from('trip_members')
          .select('user_id')
          .eq('trip_id', tripId);

        if (members && members.length > 0) {
          const splitPaise = Math.round(paiseVal / members.length);
          const splitRupees = rawRupees / members.length;

          const rowsPaise = members.map((m) => ({
            expense_id: exp.id,
            user_id: m.user_id,
            amount_paise: splitPaise,
            is_settled: false,
          }));

          const { error: sErr } = await supabase.from('expense_splits').insert(rowsPaise);
          if (sErr) {
            const rowsAmount = members.map((m) => ({
              expense_id: exp.id,
              user_id: m.user_id,
              amount: splitRupees,
              is_settled: false,
            }));
            await supabase.from('expense_splits').insert(rowsAmount);
          }
        }
      } else {
        // B. Adding Funds / Contribution
        let contribObj: any = {
          trip_id: tripId,
          user_id: userId,
          amount_paise: paiseVal,
          notes: p.notes || 'Fund contribution',
        };

        let { error: cErr } = await supabase.from('contributions').insert(contribObj);
        if (cErr) {
          delete contribObj.amount_paise;
          contribObj.amount = rawRupees;
          await supabase.from('contributions').insert(contribObj);
        }
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

fs.writeFileSync(queriesPath, fixedQueriesCode, 'utf8');
console.log('✅ src/lib/queries.ts updated with schema-adaptive fallback (amount_paise / amount)!');