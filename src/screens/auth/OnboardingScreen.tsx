import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions, StatusBar } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { colors } from '@/theme/colors';

const { width } = Dimensions.get('window');

export function OnboardingScreen({ navigation }: any) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.hero}>
        <Animated.View style={[styles.orb, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.emoji}>✈️</Text>
        </Animated.View>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          <Text style={styles.brand}>TripSplit</Text>
          <Text style={styles.tagline}>Split trip money fairly.\nNo awkward UPI chases.</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.sheet, { opacity: fade }]}>
        <Feature icon="💰" title="Shared trip fund" desc="Pool money once, spend together" />
        <Feature icon="📊" title="Live balances" desc="Everyone sees who paid what, instantly" />
        <Feature icon="🔗" title="Invite friends" desc="Share a code — they join in seconds" />

        <Button mode="contained" onPress={() => navigation.navigate('SignUp')}
          buttonColor={colors.primary} textColor="#fff"
          style={styles.cta} labelStyle={styles.ctaLabel} contentStyle={{ paddingVertical: 6 }}>
          Create account
        </Button>
        <Button mode="outlined" onPress={() => navigation.navigate('Login')}
          textColor={colors.primary} style={styles.secondary}
          labelStyle={{ fontWeight: '700' }}>
          I already have an account
        </Button>
      </Animated.View>
    </View>
  );
}

function Feature({ icon, title, desc }: any) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  hero: { flex: 0.42, alignItems: 'center', justifyContent: 'center', paddingTop: 24 },
  orb: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emoji: { fontSize: 48 },
  brand: { fontSize: 40, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  tagline: { fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8, lineHeight: 24 },
  sheet: { flex: 0.58, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 28 },
  feature: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: colors.black },
  featureDesc: { fontSize: 13, color: '#64748B', marginTop: 2 },
  cta: { borderRadius: 16, marginTop: 12, elevation: 0 },
  ctaLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondary: { borderRadius: 16, marginTop: 10, borderColor: colors.border, borderWidth: 1.5 },
});