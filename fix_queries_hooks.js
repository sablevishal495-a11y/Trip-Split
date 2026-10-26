const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
let queries = fs.readFileSync(queriesPath, 'utf8');

// Ensure useTripDetails exists (alias to useTrip if needed)
if (!queries.includes('export function useTripDetails') && queries.includes('export function useTrip(')) {
  queries = queries.replace(
    'export function useTrip(',
    'export function useTripDetails(tripId: string) {\n  return useTrip(tripId);\n}\n\nexport function useTrip('
  );
} else if (!queries.includes('useTripDetails') && !queries.includes('useTrip')) {
  // Add useTripDetails directly
  const tripDetailsHook = `
export function useTripDetails(tripId: string) {
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
`;
  queries += '\n' + tripDetailsHook;
}

// Ensure useTripMembers is present
if (!queries.includes('export function useTripMembers')) {
  const membersHook = `
export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_members')
        .select('id, role, user_id, profiles:user_id (full_name, phone_number)')
        .eq('trip_id', tripId);
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}
`;
  queries += '\n' + membersHook;
}

// Ensure useMemberDetails is present
if (!queries.includes('export function useMemberDetails')) {
  const memberDetailsHook = `
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

      const expenseIds = (tripExpenses || []).map((e: any) => e.id);
      let splits: any[] = [];
      if (expenseIds.length > 0) {
        const { data: splitData, error: sErr } = await supabase
          .from('expense_splits')
          .select('id, expense_id, amount, is_settled')
          .eq('user_id', userId)
          .in('expense_id', expenseIds);
        if (sErr) throw sErr;

        const expMap = new Map((tripExpenses || []).map((e: any) => [e.id, e]));
        splits = (splitData || []).map((s: any) => ({
          ...s,
          expense: expMap.get(s.expense_id),
        }));
      }

      const totalContributed = (contributions || []).reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
      const totalExpenseShare = splits.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
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
`;
  queries += '\n' + memberDetailsHook;
}

fs.writeFileSync(queriesPath, queries, 'utf8');
console.log('✅ queries.ts hooks successfully updated!');