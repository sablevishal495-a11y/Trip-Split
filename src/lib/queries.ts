import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

// 1. Auth Session Hook
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
export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ['expenses', vars.tripId] }),
            qc.invalidateQueries({ queryKey: ['fund_balance', vars.tripId] }),
          ]);
        },
  });
}

// 3. Trip Hooks
export function useMyTrips(userId?: string) {
  return useQuery({
    queryKey: ['my-trips', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*, trip_members!inner(user_id, role)')
        .eq('trip_members.user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
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
  });
}

// 4. Financial Calculation Hooks ( INR display )
export function useSharedFundBalance(tripId: string) {
  return useQuery({
    queryKey: ['shared-fund', tripId],
    queryFn: async () => {
      const { data: contribs } = await supabase.from('contributions').select('amount_paise').eq('trip_id', tripId);
      const { data: expenses } = await supabase.from('expenses').select('amount_paise').eq('trip_id', tripId).eq('payment_source', 'pool');

      const totalIn = (contribs || []).reduce((sum, c) => sum + c.amount_paise, 0);
      const totalOut = (expenses || []).reduce((sum, e) => sum + e.amount_paise, 0);
      return (totalIn - totalOut) / 100;
    },
  });
}

export function useUserNetBalance(tripId: string, userId: string) {
  return useQuery({
    queryKey: ['user-net', tripId, userId],
    queryFn: async () => {
      const { data: contribs } = await supabase.from('contributions').select('amount_paise').eq('trip_id', tripId).eq('user_id', userId);

      // Filter splits that belong to this trip
      const { data: tripExps } = await supabase.from('expenses').select('id').eq('trip_id', tripId);
      const tripExpIds = (tripExps || []).map(e => e.id);

      const { data: allUserSplits } = await supabase.from('expense_splits').select('amount_paise, expense_id').eq('user_id', userId);
      const relevantSplits = (allUserSplits || []).filter(s => tripExpIds.includes(s.expense_id));

      const totalContributed = (contribs || []).reduce((sum, c) => sum + c.amount_paise, 0);
      const totalSpent = relevantSplits.reduce((sum, s) => sum + s.amount_paise, 0);

      return (totalContributed - totalSpent) / 100;
    },
  });
}

// 5. Member & Details Hooks
export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_members')
        .select('*, profiles(full_name, avatar_url, email)')
        .eq('trip_id', tripId);
      if (error) throw error;
      return data;
    },
  });
}

export function useMemberDetails(tripId: string, userId: string) {
  return useQuery({
    queryKey: ['member-details', tripId, userId],
    queryFn: async () => {
      const { data: contribs } = await supabase.from('contributions').select('*').eq('trip_id', tripId).eq('user_id', userId);
      const { data: tripExps } = await supabase.from('expenses').select('id, title, created_at').eq('trip_id', tripId);
      const expIds = (tripExps || []).map(e => e.id);
      const { data: splits } = await supabase.from('expense_splits').select('*, expenses(title)').eq('user_id', userId).in('expense_id', expIds);

      const totalPaid = (contribs || []).reduce((sum, c) => sum + c.amount_paise, 0);
      const totalShare = (splits || []).reduce((sum, s) => sum + s.amount_paise, 0);

      return {
        totalPaid: totalPaid / 100,
        totalShare: totalShare / 100,
        netBalance: (totalPaid - totalShare) / 100,
        contributions: (contribs || []).map(c => ({ ...c, amount: c.amount_paise / 100 })),
        expenses: (splits || []).map(s => ({ ...s, amount: s.amount_paise / 100 }))
      };
    }
  });
}

// 6. Expense & Contribution Mutation Hooks
export function useRecordContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, userId, amount, notes }: any) => {
      const { error } = await supabase.from('contributions').insert({
        trip_id: tripId,
        user_id: userId,
        amount_paise: Math.round(amount * 100),
        idempotency_key: 'ik_' + Date.now() + '_' + Math.random().toString(36).substring(7),
        status: 'completed',
        notes: notes || 'Contribution'
      });
      if (error) throw error;
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['shared-fund', tripId] });
      queryClient.invalidateQueries({ queryKey: ['user-net'] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
    }
  });
}

export function useRecordExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, title, amount, category, paidBy, paymentSource = 'pool' }: any) => {
      const { data: expense, error: expError } = await supabase.from('expenses').insert({
        trip_id: tripId,
        title,
        amount_paise: Math.round(amount * 100),
        idempotency_key: 'ik_' + Date.now() + '_' + Math.random().toString(36).substring(7),
        category,
        paid_by: paidBy,
        payment_source: paymentSource,
        split_method: 'equal'
      }).select().single();

      if (expError) throw expError;

      const { data: members } = await supabase.from('trip_members').select('user_id').eq('trip_id', tripId);
      if (members && members.length > 0) {
        const splitAmt = Math.round((amount * 100) / members.length);
        const splits = members.map(m => ({
          expense_id: expense.id,
          user_id: m.user_id,
          amount_paise: splitAmt
        }));
        const { error: splitError } = await supabase
          .from('expense_splits')
          .insert(splits);

        if (splitError) throw splitError;
      }
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['shared-fund', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['user-net'] });
    }
  });
}

export function useJoinTripByInviteCode() {
      const qc = useQueryClient();

      return useMutation({
        mutationFn: async (rawCode: string) => {
          const code = rawCode.trim().toUpperCase();
          if (!code) throw new Error('Enter an invite code');

          const { data, error } = await supabase.rpc(
            'join_trip_by_invite_code',
            { p_invite_code: code },
          );
          if (error) throw error;
          if (!data) throw new Error('The trip could not be joined');

          return data as string;
        },
        onSuccess: async (tripId) => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ['trips'] }),
            qc.invalidateQueries({ queryKey: ['trip', tripId] }),
            qc.invalidateQueries({ queryKey: ['trip_members', tripId] }),
          ]);
        },
      });
    }


// 7. Trip Management Hooks
export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not auth');

      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: trip, error } = await supabase.from('trips').insert({
        name,
        description: description || '',
        created_by: user.id,
        currency: 'INR'
      }).select().single();

      if (error) throw error;

      await supabase.from('trip_members').insert({ trip_id: trip.id, user_id: user.id, role: 'organizer' });
      await supabase.from('invitations').insert({ trip_id: trip.id, code, created_by: user.id });

      return trip;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-trips'] })
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase.from('trips').delete().eq('id', tripId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-trips'] })
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
      return (data || []).map(e => ({ ...e, amount: e.amount_paise / 100 }));
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-trips'] })
  });
}

export function useTripDetails(tripId: string) {
  return useQuery({
    queryKey: ['trip-details', tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useTripInviteCode(tripId: string) {
  return useQuery({
    queryKey: ['trip-invite', tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('code')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.code ?? null;
    },
  });
}

export function useLeaveTrip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tripId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { error } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, tripId) => {
      queryClient.invalidateQueries({ queryKey: ['my-trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip-members', tripId] });
    },
  });
}