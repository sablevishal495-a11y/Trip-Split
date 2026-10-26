import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '@/lib/supabase';

export function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onReset = async () => {
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email);
    setSent(true);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Reset Password</Text>
      {sent ? (
        <Text variant="bodyLarge" style={{ color: '#2E7D32', marginBottom: 16 }}>Password reset email sent!</Text>
      ) : (
        <>
          <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" keyboardType="email-address" style={styles.input} />
          <Button mode="contained" onPress={onReset} loading={loading} buttonColor="#2E7D32" style={styles.button}>Send Reset Link</Button>
        </>
      )}
      <Button mode="text" onPress={() => navigation.goBack()} textColor="#1565C0">Back to Login</Button>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F8F9FA' },
  title: { fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: '#FFF' },
  button: { paddingVertical: 6, marginBottom: 12 },
});