const fs = require('fs');
const path = require('path');

// 1. Update queries.ts with useMemberDetails hook
const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
let queries = fs.readFileSync(queriesPath, 'utf8');

const memberDetailsHook = `
export function useMemberDetails(tripId: string, userId: string | null) {
  return useQuery({
    queryKey: ['member-details', tripId, userId],
    queryFn: async () => {
      if (!userId || !tripId) return null;

      // Fetch contributions
      const { data: contributions, error: cErr } = await supabase
        .from('contributions')
        .select('*')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (cErr) throw cErr;

      // Fetch expenses
      const { data: tripExpenses, error: eErr } = await supabase
        .from('expenses')
        .select('id, title, amount, created_at')
        .eq('trip_id', tripId);

      if (eErr) throw eErr;

      const expenseIds = (tripExpenses || []).map(e => e.id);
      let splits = [];
      if (expenseIds.length > 0) {
        const { data: splitData, error: sErr } = await supabase
          .from('expense_splits')
          .select('id, expense_id, amount, is_settled')
          .eq('user_id', userId)
          .in('expense_id', expenseIds);
        if (sErr) throw sErr;
        
        const expMap = new Map((tripExpenses || []).map(e => [e.id, e]));
        splits = (splitData || []).map(s => ({
          ...s,
          expense: expMap.get(s.expense_id)
        }));
      }

      const totalContributed = (contributions || []).reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const totalExpenseShare = splits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
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

if (!queries.includes('useMemberDetails')) {
  queries += '\n' + memberDetailsHook;
  fs.writeFileSync(queriesPath, queries);
  console.log('✅ Added useMemberDetails to queries.ts');
}

// 2. Update TripDetailScreen.tsx
const detailPath = path.join(process.cwd(), 'src', 'screens', 'main', 'TripDetailScreen.tsx');
let detail = fs.readFileSync(detailPath, 'utf8');

if (!detail.includes('Modal,')) {
  detail = detail.replace("import {", "import {\n  Modal,");
}
if (!detail.includes('TouchableOpacity,')) {
  detail = detail.replace("import {", "import {\n  TouchableOpacity,");
}

if (!detail.includes('useMemberDetails')) {
  detail = detail.replace(
    "useTripMembers,",
    "useTripMembers, useMemberDetails,"
  );
}

if (!detail.includes('selectedMember')) {
  detail = detail.replace(
    "const { data: members } = useTripMembers(tripId);",
    "const { data: members } = useTripMembers(tripId);\n  const [selectedMember, setSelectedMember] = useState<any>(null);"
  );
}

const newMembersUI = `
      {/* Members List */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#115E59', marginBottom: 12 }}>Trip Members</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
          {members?.map((m: any) => (
            <TouchableOpacity 
              key={m.id} 
              onPress={() => setSelectedMember(m)}
              activeOpacity={0.7}
              style={{ alignItems: 'center', marginRight: 15, width: 70 }}
            >
              <View style={{ 
                width: 50, height: 50, borderRadius: 25, 
                backgroundColor: m.role === 'organizer' ? '#0F766E' : '#94A3B8',
                justifyContent: 'center', alignItems: 'center',
                elevation: 3
              }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>
                  {m.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <Text style={{ fontSize: 12, marginTop: 4, textAlign: 'center', fontWeight: '500', color: '#334155' }} numberOfLines={1}>
                {m.profiles?.full_name || 'User'}
              </Text>
              {m.role === 'organizer' && (
                <Text style={{ fontSize: 10, color: '#0F766E', fontWeight: 'bold', marginTop: 1 }}>Host</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
`;

if (detail.includes('{/* Members List */}')) {
  detail = detail.replace(/\{\/\* Members List \*\/\}[\s\S]*?<\/ScrollView>\s*<\/View>/, newMembersUI.trim());
}

const modalComponentAndStyles = `
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
            <View style={[modalStyles.avatar, { backgroundColor: member.role === 'organizer' ? '#0F766E' : '#64748B' }]}>
              <Text style={modalStyles.avatarText}>{member.profiles?.full_name?.charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={modalStyles.name}>{member.profiles?.full_name || 'Member'}</Text>
              <Text style={modalStyles.phone}>{member.profiles?.phone_number || ''}</Text>
              <Text style={modalStyles.role}>{member.role === 'organizer' ? 'Organizer (Host)' : 'Trip Member'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Text style={{ fontSize: 20, color: '#64748B', fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#0F766E" style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Summary Cards */}
              <View style={modalStyles.summaryRow}>
                <View style={[modalStyles.card, { backgroundColor: '#E6FFFA', borderColor: '#0F766E' }]}>
                  <Text style={modalStyles.cardLabel}>Contributed</Text>
                  <Text style={[modalStyles.cardValue, { color: '#0F766E' }]}>₹{data?.totalContributed || 0}</Text>
                </View>

                <View style={[modalStyles.card, { backgroundColor: '#FFF7ED', borderColor: '#EA580C' }]}>
                  <Text style={modalStyles.cardLabel}>Share Expenses</Text>
                  <Text style={[modalStyles.cardValue, { color: '#EA580C' }]}>₹{data?.totalExpenseShare || 0}</Text>
                </View>
              </View>

              {/* Net Position Card */}
              <View style={[
                modalStyles.netCard,
                { backgroundColor: (data?.netBalance || 0) >= 0 ? '#F0FDF4' : '#FEF2F2',
                  borderColor: (data?.netBalance || 0) >= 0 ? '#16A34A' : '#DC2626' }
              ]}>
                <Text style={modalStyles.netLabel}>Net Balance Status</Text>
                <Text style={[
                  modalStyles.netValue,
                  { color: (data?.netBalance || 0) >= 0 ? '#16A34A' : '#DC2626' }
                ]}>
                  {(data?.netBalance || 0) >= 0
                    ? \`+ ₹\${data?.netBalance || 0} (Surplus / Owed Back)\`
                    : \`- ₹\${Math.abs(data?.netBalance || 0)} (Pending / Owes)\`}
                </Text>
              </View>

              {/* Breakdown lists */}
              <Text style={modalStyles.sectionTitle}>Contributions ({data?.contributions?.length || 0})</Text>
              {data?.contributions?.length === 0 ? (
                <Text style={modalStyles.emptyText}>No contributions recorded yet.</Text>
              ) : (
                data?.contributions.map((c: any) => (
                  <View key={c.id} style={modalStyles.listItem}>
                    <Text style={{ fontWeight: '600', color: '#1E293B' }}>{c.notes || 'Fund Contribution'}</Text>
                    <Text style={{ fontWeight: 'bold', color: '#0F766E' }}>+₹{c.amount}</Text>
                  </View>
                ))
              )}

              <Text style={[modalStyles.sectionTitle, { marginTop: 15 }]}>Expense Splits ({data?.splits?.length || 0})</Text>
              {data?.splits?.length === 0 ? (
                <Text style={modalStyles.emptyText}>No expense splits for this member.</Text>
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
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
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
    color: '#0F766E',
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

if (!detail.includes('MemberDetailModal')) {
  detail += '\n' + modalComponentAndStyles;
}

if (!detail.includes('<MemberDetailModal')) {
  detail = detail.replace(
    '</ScrollView>',
    '  <MemberDetailModal visible={!!selectedMember} member={selectedMember} tripId={tripId} onClose={() => setSelectedMember(null)} />\n    </ScrollView>'
  );
}

fs.writeFileSync(detailPath, detail);
console.log('✅ Updated TripDetailScreen.tsx with interactive Member Detail Modal!');