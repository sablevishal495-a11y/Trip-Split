const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
const detailPath = path.join(process.cwd(), 'src', 'screens', 'main', 'TripDetailScreen.tsx');

// 1. Refined Query Hook
const hookCode = `
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

let queries = fs.readFileSync(queriesPath, 'utf8');
if (!queries.includes('useTripMembers')) {
    queries += hookCode;
} else {
    // Replace existing if corrupted
    queries = queries.replace(/export function useTripMembers[\s\S]*?enabled: !!tripId,\n {2}\}\);?\n\}/, hookCode);
}
fs.writeFileSync(queriesPath, queries);

// 2. Refresh the Screen UI
let detail = fs.readFileSync(detailPath, 'utf8');

// Ensure imports and hook call exist
if (!detail.includes('useTripMembers')) {
    detail = detail.replace('useTripBalance,', 'useTripBalance, useTripMembers,');
}
if (!detail.includes('const { data: members } = useTripMembers(tripId);')) {
    detail = detail.replace(
        'const { data: balance } = useTripBalance(tripId);',
        'const { data: balance } = useTripBalance(tripId);\n  const { data: members } = useTripMembers(tripId);'
    );
}

// Check if UI is there, if not, force insert it
if (!detail.includes('Trip Members')) {
    const ui = `
      {/* Members List */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#115E59', marginBottom: 12 }}>Trip Members</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
          {members?.map((m: any) => (
            <View key={m.id} style={{ alignItems: 'center', marginRight: 15, width: 70 }}>
              <View style={{ 
                width: 50, height: 50, borderRadius: 25, 
                backgroundColor: m.role === 'organizer' ? '#0F766E' : '#94A3B8',
                justifyContent: 'center', alignItems: 'center'
              }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>
                  {m.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
                {m.profiles?.full_name || 'User'}
              </Text>
              {m.role === 'organizer' && (
                <Text style={{ fontSize: 10, color: '#0F766E', fontWeight: 'bold' }}>Host</Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    `;
    detail = detail.replace('<Text style={styles.sectionTitle}>Recent Expenses</Text>', ui + '\n      <Text style={styles.sectionTitle}>Recent Expenses</Text>');
}

fs.writeFileSync(detailPath, detail);
console.log('✅ Done! Files updated.');