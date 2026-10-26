const fs = require('fs');
const path = require('path');

// 1. Update queries.ts to include useTripMembers
const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
let queriesContent = fs.readFileSync(queriesPath, 'utf8');

if (!queriesContent.includes('useTripMembers')) {
  const membersHook = `
export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: ['trip-members', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_members')
        .select(\`
          id,
          role,
          user_id,
          profiles:user_id (
            full_name,
            phone_number
          )
        \`)
        .eq('trip_id', tripId);

      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });
}
`;
  queriesContent += membersHook;
  fs.writeFileSync(queriesPath, queriesContent);
  console.log('✅ Added useTripMembers hook to queries.ts');
}

// 2. Update TripDetailScreen.tsx to show the members
const tripDetailPath = path.join(process.cwd(), 'src', 'screens', 'main', 'TripDetailScreen.tsx');
let detailContent = fs.readFileSync(tripDetailPath, 'utf8');

// Add the import if not there
if (!detailContent.includes('useTripMembers')) {
    detailContent = detailContent.replace(
        "useTripBalance,",
        "useTripBalance, useTripMembers,"
    );
}

// Add the Members Section UI
const membersSection = `
      {/* Members Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trip Members</Text>
        <Text style={styles.memberCount}>{\`(\${members?.length || 0})\`}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersList}>
        {members?.map((m: any) => (
          <View key={m.id} style={styles.memberChip}>
            <View style={[styles.avatar, { backgroundColor: m.role === 'organizer' ? '#0F766E' : '#94A3B8' }]}>
              <Text style={styles.avatarText}>
                {m.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.memberName} numberOfLines={1}>
              {m.profiles?.full_name?.split(' ')[0]}
            </Text>
            {m.role === 'organizer' && <Text style={styles.roleTag}>Host</Text>}
          </View>
        ))}
      </ScrollView>
`;

// Insert the logic to call the hook
if (!detailContent.includes('const { data: members } = useTripMembers(tripId);')) {
    detailContent = detailContent.replace(
        "const { data: balance } = useTripBalance(tripId);",
        "const { data: balance } = useTripBalance(tripId);\n  const { data: members } = useTripMembers(tripId);"
    );
}

// Insert the UI before "Recent Expenses"
if (!detailContent.includes('Trip Members')) {
    detailContent = detailContent.replace(
        '<Text style={styles.sectionTitle}>Recent Expenses</Text>',
        membersSection + '\n      <Text style={styles.sectionTitle}>Recent Expenses</Text>'
    );
}

// Add Styles for members
const newStyles = `
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  memberCount: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 8,
  },
  membersList: {
    paddingLeft: 20,
    marginBottom: 20,
  },
  memberChip: {
    alignItems: 'center',
    marginRight: 15,
    width: 60,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  memberName: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
  roleTag: {
    fontSize: 9,
    color: '#0F766E',
    fontWeight: 'bold',
    marginTop: 2,
  },
`;

detailContent = detailContent.replace("sectionTitle: {", newStyles + "  sectionTitle: {");

fs.writeFileSync(tripDetailPath, detailContent);
console.log('✅ Updated TripDetailScreen.tsx with Members UI');