// app/src/App.tsx

import React, { useEffect } from 'react';
import { LogBox, Platform, StatusBar, SafeAreaView, View, Text, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Network from 'expo-network';
import Toast from 'react-native-toast-message';

import Navigation from './navigation';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications'; // Import advanced notification hook
import ErrorBoundary from './components/ErrorBoundary';
// Assuming AppStyles, CustomInput, CustomButton, etc., are implemented
import { AppStyles } from './styles'; 

// 1. Initialize Query Client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: true,
        },
    },
});

// Keep the splash screen visible
SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Setting a timer']); 

// --- Offline Banner Component ---
const OfflineBanner = () => {
  const [isOffline, setOffline] = React.useState(false);

  useEffect(() => {
    // Advanced: Use Expo Network listener for better performance than polling
    const subscription = Network.addNetworkStateListener(state => {
        setOffline(state.isInternetReachable === false);
    });
    // Initial check
    Network.getNetworkStateAsync().then(state => setOffline(state.isInternetReachable === false));
    
    return () => subscription.remove();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.offlineContainer}>
      <Text style={styles.offlineText}>Offline Mode: Check your connection 😔</Text>
    </View>
  );
};

// --- Root Component with Providers and Initial Loading ---
function RootApp() {
  // 2. Load Fonts & Assets
  const [fontsLoaded] = useFonts({
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'), 
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  });

  const { isReady, user } = useAuth(); // `isReady` indicates FASE session restore completion

  // 3. Initialize Notifications
  // The notification hook handles token registration and deep link listeners
  useNotifications(user?.id || null); 

  // Effect to hide splash screen once resources and auth are ready
  useEffect(() => {
    async function prepare() {
      if (fontsLoaded && isReady) {
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, [fontsLoaded, isReady]);

  if (!fontsLoaded || !isReady) {
    return null;
  }

  // 4. Main Navigation
  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <Navigation />
        <OfflineBanner />
      </SafeAreaView>
      <Toast />
    </ErrorBoundary>
  );
}

// --- Main App Wrapper ---
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppStyles.colors.white,
  },
  offlineContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppStyles.colors.red,
    padding: 8,
    alignItems: 'center',
    zIndex: 100,
  },
  offlineText: {
    color: AppStyles.colors.white,
    fontSize: 14,
    // fontFamily: 'Inter-Regular',
  },
});