import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, StatusBar, Alert } from 'react-native';
import { TextInput, Button, Text, ActivityIndicator } from 'react-native-paper';
import { useSession, useProfile } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { useQueryClient } from '@tanstack/react-query';

export function ProfileScreen({ navigation }: any) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: profile, isLoading } = useProfile(userId);
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [saving, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const phone = profile?.phone || (session?.user?.email || '').split('@')[0];

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      return Alert.alert('Error', 'Name cannot be empty');
    }

    setLoading(true);
    setSuccessMsg('');

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId);

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } else {
      setSuccessMsg('Profile updated successfully!');
      // Invalidate queries so name updates everywhere in the app
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['trip_members'] });
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <StatusBar barStyle="dark-content" />

      {/* Avatar Circle */}
      <View style={styles.avatar}>
        <Text style={styles.letter}>
          {(fullName.trim() || 'U')[0].toUpperCase()}
        </Text>
      </View>

      <Text style={styles.phoneText}>+91 {phone}</Text>

      {/* Success Banner */}
      {!!successMsg && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✅ {successMsg}</Text>
        </View>
      )}

      {/* Edit Name Form */}
      <View style={styles.card}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          mode="outlined"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          style={styles.input}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          outlineStyle={{ borderRadius: 14 }}
        />

        <Button
          mode="contained"
          onPress={handleSaveName}
          loading={saving}
          disabled={saving}
          buttonColor={colors.primary}
          style={styles.saveBtn}
          labelStyle={{ fontWeight: '800', fontSize: 15 }}
          contentStyle={{ paddingVertical: 4 }}
        >
          Save Name
        </Button>
      </View>

      {/* Sign Out */}
      <Button
        mode="outlined"
        onPress={handleSignOut}
        textColor={colors.danger}
        style={styles.signOutBtn}
        labelStyle={{ fontWeight: '800' }}
      >
        Sign Out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll: { padding: 20, alignItems: 'center' },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justify: 'center',
    marginTop: 10,
    marginBottom: 10,
    elevation: 2,
  },
  letter: { fontSize: 38, fontWeight: '800', color: '#fff' },
  phoneText: { fontSize: 16, fontWeight: '700', color: '#64748B', marginBottom: 20 },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginBottom: 8 },
  input: { backgroundColor: '#fff', marginBottom: 16 },
  saveBtn: { borderRadius: 14, elevation: 0 },
  signOutBtn: { width: '100%', borderRadius: 14, borderColor: colors.danger, borderWidth: 1.5, marginTop: 10 },
  successBox: {
    width: '100%',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  successText: { color: colors.success, fontWeight: '700', fontSize: 14 },
});