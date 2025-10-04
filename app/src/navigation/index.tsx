// app/src/navigation/index.tsx

import React from 'react';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';

// --- Screen Imports ---
import LoginScreen from '../screens/loginScreen.ts';
import RegisterScreen from '../screens/RegisterScreen';
import OnboardingQuiz from '../screens/OnboardingQuiz';
import VerificationGateScreen from '../screens/VerificationGateScreen'; // NEW
import HomeStack from './HomeStack'; // NEW: Stack for Home/Discover/Contextual Match Details
import MatchesScreen from '../screens/MatchesScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import { AppStyles } from '../styles';


// --- Type Definitions ---
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OnboardingQuiz: undefined;
  VerificationGate: undefined; // New Gate Screen
};

export type MainTabParamList = {
  HomeStack: undefined; // Contains Home/Discover
  Matches: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type RootStackParamList = AuthStackParamList & MainTabParamList & {
  Chat: { matchId: string; matchName: string };
  Payments: undefined;
};

// --- Navigators ---
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createStackNavigator<RootStackParamList>();

// --- Deep Linking Configuration ---
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['yourapp://', 'https://yourapp.com'],
  config: {
    screens: {
      // Map main authenticated screens
      HomeStack: 'home',
      Profile: 'profile',
      
      // Deep link config for chat/match
      Chat: {
        path: 'chat/:matchId',
        parse: { matchId: (matchId: string) => matchId },
      },

      // Deep link for payments
      Payments: 'upgrade',

      // Map auth flow screens
      Login: 'login',
      Register: 'register',
    } as any, // Cast necessary due to dynamic route mixing
  },
};

// --- Auth Stack ---
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="OnboardingQuiz" component={OnboardingQuiz} />
      <AuthStack.Screen name="VerificationGate" component={VerificationGateScreen} />
    </AuthStack.Navigator>
  );
};

// --- Main Tab Navigator ---
const MainTabNavigator = () => {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: AppStyles.colors.primary, 
        tabBarInactiveTintColor: AppStyles.colors.gray,
        tabBarStyle: { height: 60, paddingBottom: 5 },
      }}
    >
      <MainTab.Screen
        name="HomeStack"
        component={HomeStack} // Consolidated Home and Discover into a stack
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" color={color} size={size} />
          ),
        }}
      />
      <MainTab.Screen
        name="Matches"
        component={MatchesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <MainTab.Screen
        name="Messages"
        component={ChatScreen} // This tab should route to the full chat list/recent view
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />
    </MainTab.Navigator>
  );
};

// --- Root Component (Conditional Rendering) ---
export default function Navigation() {
  const { isLoggedIn, loading, user } = useAuth();

  if (loading) {
    return null; // Let App.tsx handle splash screen until isReady/loading is false
  }

  // Conditional Flow Logic:
  let initialRouteName: keyof RootStackParamList = isLoggedIn ? 'HomeStack' : 'Login';

  if (isLoggedIn) {
      // 1. Check Onboarding Completion (Conceptual: if traits or bio are missing)
      if (user?.topInterests.length === 0) { 
          initialRouteName = 'OnboardingQuiz';
      }
      // 2. Check Identity Verification (Crucial for advanced app safety/features)
      else if (!user?.isIdentityVerified) {
          initialRouteName = 'VerificationGate';
      }
      // 3. Default to main app
      else {
          initialRouteName = 'HomeStack';
      }
  }


  return (
    <NavigationContainer linking={linking}>
      <RootStack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }} initialRouteName={initialRouteName}>
        {isLoggedIn ? (
          <>
            <RootStack.Screen name="Main" component={MainTabNavigator} />
            <RootStack.Screen name="Chat" component={ChatScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="Payments" component={PaymentsScreen} options={{ presentation: 'modal' }} />
            {/* Auth screens are included here to allow navigation back into auth flow (e.g., VerificationGate) */}
            <RootStack.Screen name="OnboardingQuiz" component={OnboardingQuiz} />
            <RootStack.Screen name="VerificationGate" component={VerificationGateScreen} />
          </>
        ) : (
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
            <RootStack.Screen name="OnboardingQuiz" component={OnboardingQuiz} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// --- NEW: HomeStack Navigator (For Home/Discover/Contextual Match Screen) ---
// This is a simple stack within the tab to allow header/navigation between swipe/filters
const HomeStackNavigator = createStackNavigator<any>(); 
const HomeStack = () => (
    <HomeStackNavigator.Navigator screenOptions={{ headerShown: false }}>
        <HomeStackNavigator.Screen name="SwipeHome" component={HomeScreen} />
        <HomeStackNavigator.Screen name="DiscoverFilters" component={DiscoverScreen} />
    </HomeStackNavigator.Navigator>
);