const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
let content = fs.readFileSync(queriesPath, 'utf8');

// FIX 1: Remove phone_number from all profile selects
content = content.replace(/full_name,\s*phone_number/g, 'full_name');
content = content.replace(/phone_number,\s*full_name/g, 'full_name');
content = content.replace(/phone_number/g, '');

// Clean up any double commas or empty select fields that might result
content = content.replace(/,\s*\)/g, ')');
content = content.replace(/\(\s*\)/g, '(*)');

// FIX 2 & 3: Add useRecordContribution if missing
if (!content.includes('useRecordContribution')) {
  const recordContributionHook = `

export function useRecordContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tripId, userId, amount, notes }: { tripId: string; userId: string; amount: number; notes?: string }) => {
      const { data, error } = await supabase
        .from('contributions')
        .insert({ trip_id: tripId, user_id: userId, amount: amount, notes: notes || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-fund-balance'] });
      queryClient.invalidateQueries({ queryKey: ['user-net-balance'] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
    },
  });
}
`;
  content += recordContributionHook;
  console.log('✅ Added useRecordContribution hook');
} else {
  console.log('ℹ️ useRecordContribution already exists');
}

fs.writeFileSync(queriesPath, content, 'utf8');
console.log('✅ Fixed phone_number references and useRecordContribution!');