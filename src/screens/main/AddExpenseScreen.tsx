import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useRecordExpense, useTripMembers, useSession } from '@/lib/queries';
import { inrToPaise, calculateSplit, formatINR } from '@/lib/financial';
import { colors } from '@/theme/colors';

const CATS = [
  { id: 'food', label: 'Food', icon: '🍽️' },
  { id: 'hotel', label: 'Hotel', icon: '🏨' },
  { id: 'petrol', label: 'Travel', icon: '⛽' },
  { id: 'shopping', label: 'Shop', icon: '🛍️' },
  { id: 'tickets', label: 'Tickets', icon: '🎫' },
  { id: 'misc', label: 'Misc', icon: '📦' },
];

export function AddExpenseScreen({ route, navigation }: any) {
  const { tripId } = route.params;
  const { data: session } = useSession();
  const { data: members = [] } = useTripMembers(tripId);
  const recordExpense = useRecordExpense();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [source, setSource] = useState<'shared_fund' | 'personal'>('shared_fund');

  const onSubmit = async () => {
    const amountPaise = inrToPaise(parseFloat(amount) || 0);
    if (!title.trim() || amountPaise <= 0) return alert('Enter title and amount');
    const participantIds = members.map((m: any) => m.user_id);
    if (!participantIds.length) return alert('No members to split with');
    const split = calculateSplit({ participantIds, totalAmountPaise: amountPaise, method: 'equal' });
    const splitAmounts = participantIds.map((id) => split.allocations[id] || 0);

    try {
      await recordExpense.mutateAsync({
        tripId, title: title.trim(), amountPaise, category,
        expenseDate: new Date().toISOString(),
        paidBy: session?.user?.id,
        paymentSource: source,
        splitMethod: 'equal',
        participants: participantIds,
        splitAmounts,
      });
      navigation.goBack();
    } catch (e: any) {
      alert(e.message || 'Failed');
    }
  };

  const preview = (() => {
    const a = inrToPaise(parseFloat(amount) || 0);
    if (!a || !members.length) return null;
    const each = Math.floor(a / members.length);
    return formatINR(each);
  })();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>New expense</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput mode="outlined" value={title} onChangeText={setTitle} placeholder="Dinner at cafe"
        style={styles.input} outlineColor={colors.border} activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />

      <Text style={styles.label}>Amount (₹)</Text>
      <TextInput mode="outlined" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00"
        style={styles.input} outlineColor={colors.border} activeOutlineColor={colors.primary} outlineStyle={{ borderRadius: 14 }} />

      <Text style={styles.label}>Category</Text>
      <View style={styles.cats}>
        {CATS.map((c) => (
          <Pressable key={c.id} onPress={() => setCategory(c.id)}
            style={[styles.cat, category === c.id && styles.catOn]}>
            <Text style={{ fontSize: 18 }}>{c.icon}</Text>
            <Text style={[styles.catText, category === c.id && { color: colors.primary }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Paid from</Text>
      <View style={styles.seg}>
        <Pressable onPress={() => setSource('shared_fund')} style={[styles.segBtn, source === 'shared_fund' && styles.segOn]}>
          <Text style={[styles.segText, source === 'shared_fund' && styles.segTextOn]}>Shared fund</Text>
        </Pressable>
        <Pressable onPress={() => setSource('personal')} style={[styles.segBtn, source === 'personal' && styles.segOn]}>
          <Text style={[styles.segText, source === 'personal' && styles.segTextOn]}>Personal</Text>
        </Pressable>
      </View>

      {preview && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Equal split preview</Text>
          <Text style={styles.previewVal}>{preview} each · {members.length} people</Text>
        </View>
      )}

      <Button mode="contained" onPress={onSubmit} loading={recordExpense.isPending}
        buttonColor={colors.primary} style={styles.btn} labelStyle={{ fontWeight: '800', fontSize: 16 }}
        contentStyle={{ paddingVertical: 6 }}>
        Save expense
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.black, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#fff', marginBottom: 4 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: { width: '30%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
  catOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 4 },
  seg: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  segOn: { backgroundColor: '#fff', elevation: 1 },
  segText: { fontWeight: '700', color: '#64748B' },
  segTextOn: { color: colors.primary },
  preview: { marginTop: 16, backgroundColor: colors.primarySoft, padding: 14, borderRadius: 14 },
  previewTitle: { fontWeight: '700', color: colors.primary, fontSize: 12 },
  previewVal: { fontWeight: '800', color: colors.black, fontSize: 16, marginTop: 4 },
  btn: { marginTop: 20, borderRadius: 16, elevation: 0 },
});