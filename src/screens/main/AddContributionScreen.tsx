import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRecordContribution, useTripMembers, useSession } from '@/lib/queries';
import { inrToPaise } from '@/lib/financial';
import { colors } from '@/theme/colors';

export function AddContributionScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { data: session } = useSession();
  const { data: members = [] } = useTripMembers(tripId);
  const recordContribution = useRecordContribution();
  
  const [amount, setAmount] = useState('');
  const [selectedUser, setSelectedUser] = useState(session?.user?.id);

  const onSubmit = async () => {
    if (!amount || !selectedUser) return alert('Enter amount and select a member');
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return alert('Enter an amount greater than zero');
    }
    try {
      await recordContribution.mutateAsync({
        tripId, 
        userId: selectedUser, 
        amount: Number(amount),
      });
      navigation.goBack();
    } catch (e: any) { alert(e.message || 'Failed to add contribution'); }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Add money to pool</Text>
      
      <Text style={styles.label}>Who is contributing?</Text>
      <View style={styles.memberList}>
        {members.map((m: any) => (
          <Pressable 
            key={m.user_id} 
            onPress={() => setSelectedUser(m.user_id)}
            style={[styles.memberChip, selectedUser === m.user_id && styles.memberChipOn]}
          >
            <Text style={[styles.memberText, selectedUser === m.user_id && styles.memberTextOn]}>
              {m.profiles?.full_name || 'Member'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput 
        mode="outlined" value={amount} onChangeText={setAmount} 
        keyboardType="decimal-pad" style={styles.input} placeholder="e.g. 1000"
        outlineColor={colors.border} activeOutlineColor={colors.primary} 
        outlineStyle={{ borderRadius: 14 }} 
      />

      <Button mode="contained" onPress={onSubmit} loading={recordContribution.isPending} 
        buttonColor={colors.primary} style={styles.btn} labelStyle={{ fontWeight: '800' }}>
        Confirm Deposit
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.black, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#fff', marginBottom: 12 },
  btn: { marginTop: 24, paddingVertical: 6, borderRadius: 14 },
  memberList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  memberChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  memberText: { color: '#64748B', fontWeight: '600' },
  memberTextOn: { color: colors.primary, fontWeight: '800' },
});