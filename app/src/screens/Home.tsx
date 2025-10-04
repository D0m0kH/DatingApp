// app/src/screens/Home.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as geofire from 'geofire-common';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { get, post } from '../services/api';
import { UserPublic } from '../types/shared';
import { AppStyles } from '../styles';
import SwipeDeck from '../components/SwipeDeck';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';

// --- Location & GeoHash Configuration ---
const GEOHASH_PRECISION = 6; // ~0.6km accuracy for contextual matching

// --- API Service Hook ---
const useRecommendations = (page: number, limit: number, filters: object, currentGeoHash?: string) => {
  return useQuery<UserPublic[], Error>({
    queryKey: ['recommendations', page, limit, filters, currentGeoHash],
    queryFn: () => get<UserPublic[]>('/match/recommendations', { 
        page, 
        limit, 
        filters: JSON.stringify(filters),
        currentGeoHash, // Send the current GeoHash for contextual matching
    }),
    staleTime: 5 * 60 * 1000, 
    enabled: !!currentGeoHash, // Only fetch if we have a location context
  });
};

// --- Home Screen Component ---
const HomeScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { onMatchFound } = useSocket(user?.id || null);

  const [currentPage, setCurrentPage] = useState(1);
  const [recommendations, setRecommendations] = useState<UserPublic[]>([]);
  const [filters, setFilters] = useState({});
  const [currentGeoHash, setCurrentGeoHash] = useState<string | undefined>(undefined);
  const [locationLoading, setLocationLoading] = useState(true);

  const { data, isLoading, isError, error, refetch } = useRecommendations(currentPage, 20, filters, currentGeoHash);

  // --- 1. Advanced Location Context Management ---
  const updateLocationContext = useCallback(async () => {
    setLocationLoading(true);
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('Location permission denied.');
            setLocationLoading(false);
            // Default to broad search if denied
            setCurrentGeoHash(undefined); 
            return;
        }

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        
        // Generate the GeoHash for the current, accurate location
        const geoHash = geofire.geohashForLocation(
            [location.coords.latitude, location.coords.longitude], 
            GEOHASH_PRECISION
        );
        
        setCurrentGeoHash(geoHash);
        
        // Also update the user's profile location on the backend (fire-and-forget)
        await post('/profile/me', { 
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracyMeters: location.coords.accuracy,
        });

    } catch (e) {
        console.error('Failed to get location or update profile:', e);
        setCurrentGeoHash(undefined); // Allow non-contextual matching
    } finally {
        setLocationLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      updateLocationContext();
      // Also subscribe to socket event listener here if necessary
    }, [updateLocationContext])
  );
  
  // --- Data Management ---
  useEffect(() => {
    if (data) {
      if (currentPage === 1) {
        setRecommendations(data);
      } else {
        setRecommendations(prev => [...prev, ...data.filter(d => !prev.some(p => p.id === d.id))]);
      }
      // Prefetch logic: load the next page if the current deck is running low
      if (data.length < 5) {
        setCurrentPage(prev => prev + 1);
      }
    }
  }, [data, currentPage]);


  // --- Swipe Actions (Advanced) ---
  const handleSwipe = useCallback(async (action: 'like' | 'dislike', profileId: string) => {
    const endpoint = action === 'like' ? `/match/like/${profileId}` : `/match/dislike/${profileId}`;
    try {
        // Advanced: Include the GeoHash as contextualId if available
        const contextualId = currentGeoHash ? `geo:${currentGeoHash}` : undefined;
        await post(endpoint, { contextualId });
    } catch (e: any) {
        Toast.show({ type: 'error', text1: `Failed to record ${action}.`, text2: e.message });
    }

    setRecommendations(prev => prev.filter(p => p.id !== profileId));
  }, [currentGeoHash]);

  const handleSuperLike = useCallback(async (profileId: string) => {
    try {
        await post(`/match/like/${profileId}`, { isSuperLike: true });
        Toast.show({ type: 'info', text1: 'Super Like Sent! ✨' });
    } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Failed Super Like', text2: e.message || 'Not enough Super Likes or premium required.' });
    }
    setRecommendations(prev => prev.filter(p => p.id !== profileId));
  }, []);

  const handleUndo = useCallback(async (profileId: string): Promise<boolean> => {
    try {
        // Backend handles Premium gate
        await post('/match/undo', { lastSwipedId: profileId }); 
        
        // Find the profile data (requires caching mechanism not explicitly built, using simplified current list)
        const undoneProfile = data?.find(p => p.id === profileId); 
        if (undoneProfile) {
             setRecommendations(prev => [undoneProfile, ...prev.filter(p => p.id !== profileId)]);
             return true;
        }
        return false;
    } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Undo Failed', text2: e.message });
        return false;
    }
  }, [data]);


  if (isLoading || locationLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AppStyles.colors.primary} />
        <Text style={styles.loadingText}>{locationLoading ? 'Getting your location context...' : 'Finding hyper-personalized matches...'}</Text>
      </View>
    );
  }

  // --- Render ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>For You {currentGeoHash ? `(${currentGeoHash.substring(0, 6)})` : ''}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('DiscoverFilters' as never)}>
          <Ionicons name="filter-circle-outline" size={30} color={AppStyles.colors.text} />
        </TouchableOpacity>
      </View>
      <SwipeDeck
        profiles={recommendations}
        onSwipeLeft={(id) => handleSwipe('dislike', id)}
        onSwipeRight={(id) => handleSwipe('like', id)}
        onSuperLike={handleSuperLike}
        onUndo={handleUndo}
        onEmptyDeck={() => setCurrentPage(prev => prev + 1)}
        isPremium={user?.isPremium || false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppStyles.colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: AppStyles.colors.gray, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, paddingTop: 40, backgroundColor: AppStyles.colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppStyles.colors.lightGray },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: AppStyles.colors.text },
});

export default HomeScreen;