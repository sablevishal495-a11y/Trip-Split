import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '@/lib/supabase';

import { LoginScreen } from '@/screens/auth/LoginScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { OnboardingScreen } from '@/screens/auth/OnboardingScreen';

import { DashboardScreen } from '@/screens/main/DashboardScreen';
import { CreateTripScreen } from '@/screens/main/CreateTripScreen';
import { TripDetailScreen } from '@/screens/main/TripDetailScreen';
import { AddExpenseScreen } from '@/screens/main/AddExpenseScreen';
import { AddContributionScreen } from '@/screens/main/AddContributionScreen';
import { MembersScreen } from '@/screens/main/MembersScreen';
import { SettlementScreen } from '@/screens/main/SettlementScreen';
import { NotificationsScreen } from '@/screens/main/NotificationsScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { JoinTripScreen } from '@/screens/main/JoinTripScreen';
import { ContributionRequestsScreen } from '@/screens/main/ContributionRequestsScreen';
import { RequestMoneyScreen } from '@/screens/main/RequestMoneyScreen';
import { MemberBalanceScreen } from '@/screens/main/MemberBalanceScreen';
import { ExpenseDetailScreen } from '@/screens/main/ExpenseDetailScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#FFF' }, headerTintColor: '#1A1A2E' }}>
      <MainStack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'My Trips' }} />
      <MainStack.Screen name="CreateTrip" component={CreateTripScreen} options={{ title: 'Create Trip' }} />
      <MainStack.Screen name="JoinTrip" component={JoinTripScreen} options={{ title: 'Join Trip' }} />
      <MainStack.Screen name="TripDetail" component={TripDetailScreen} options={{ title: 'Trip Overview' }} />
      <MainStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <MainStack.Screen name="AddContribution" component={AddContributionScreen} options={{ title: 'Add Contribution' }} />
      <MainStack.Screen name="Members" component={MembersScreen} options={{ title: 'Members' }} />
      <MainStack.Screen name="ContributionRequests" component={ContributionRequestsScreen} options={{ title: 'Money Requests' }} />
      <MainStack.Screen name="RequestMoney" component={RequestMoneyScreen} options={{ title: 'Request Money' }} />
      <MainStack.Screen name="MemberBalance" component={MemberBalanceScreen} options={{ title: 'Member Balance' }} />
      <MainStack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Expense Detail' }} />
      <MainStack.Screen name="Settlement" component={SettlementScreen} options={{ title: 'Trip Settlement' }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <MainStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
    </MainStack.Navigator>
  );
}

export function AppNavigator() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' }}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}