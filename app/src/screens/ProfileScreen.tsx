// app/src/screens/ProfileScreen.tsx

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Location from 'expo-location';

import { get, put, patch } from '../services/api';
import { UserPublic, ProfileUpdateDto } from '../types/shared';
import { AppStyles } from '../styles';
import { useAuth } from '../hooks/useAuth';
import ImageUploader from '../components/ImageUploader';
import CustomButton from '../components/CustomButton';

// --- API Hooks (useMyProfile and useProfileUpdate remain similar) ---
const useMyProfile = (userId: string | undefined) => {
  return useQuery<UserPublic, Error>({
    queryKey: ['myProfile', userId],
    queryFn: () => get<UserPublic>('/profile/me'),
    enabled: !!userId,
  });
};

const useProfileUpdate = () => {
  const queryClient = useQueryClient();
  const { getCurrentUser } = useAuth();

  return useMutation<UserPublic, Error, ProfileUpdateDto>({
    mutationFn: (updateData) => put<UserPublic>('/profile/me', updateData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      getCurrentUser();
      Toast.show({ type: 'success', text1: 'Profile Updated!' });
    },
    onError: (error) => {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: error.message });
    },
  });
};

// --- Main Component ---
const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: profileData, isLoading, refetch } = useMyProfile(user?.id);
  const updateMutation = useProfileUpdate();
  const queryClient = useQueryClient();

  // Local state for editing fields
  const [bio, setBio] = useState(profileData?.bio || '');
  const [interests, setInterests] = useState(profileData?.topInterests.join(', ') || '');
  const [isEditing, setIsEditing] = useState(false);
  const [locationPrivacyLevel, setLocationPrivacyLevel] = useState(5000); // 5km default

  useFocusEffect(
    useCallback(() => {
        if (profileData) {
            setBio(profileData.bio || '');
            setInterests(profileData.topInterests.join(', ') || '');
        }
        refetch();
    }, [profileData, refetch])
  );

  const handleSave = async () => {
    if (!profileData) return;
    
    // 1. Get current location context
    let locationUpdate: { latitude?: number; longitude?: number; accuracyMeters?: number } = {};
    if (isEditing) {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                 const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Medium });
                 locationUpdate = { 
                     latitude: loc.coords.latitude, 
                     longitude: loc.coords.longitude,
                     accuracyMeters: loc.coords.accuracy || locationPrivacyLevel // Use selected privacy level if device accuracy is lower
                 };
            }
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Location Update Failed', text2: 'Could not fetch device location.' });
        }
    }

    // 2. Prepare Update DTO
    const updateData: ProfileUpdateDto = {
      bio: bio.trim(),
      interests: interests.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      // Advanced: Location & Privacy Preference
      ...locationUpdate, 
      preferences: {
          ...profileData.preferences, 
          locationPrivacyLevel,
      } as any,
    };
    
    updateMutation.mutate(updateData);
    setIsEditing(false);
  };

  const handleSetPrimary = useCallback(async (photoId: string) => {
    try {
        await patch(`/profile/me/photos/${photoId}/primary`, {}); 
        queryClient.invalidateQueries({ queryKey: ['myProfile'] });
        Toast.show({ type: 'success', text1: 'Primary photo set!' });
    } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Failed to set primary photo', text2: e.message });
    }
  }, [queryClient]);

  const handlePhotoDelete = useCallback((deletedId: string) => {
    queryClient.setQueryData<UserPublic>(['myProfile', user?.id], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, photos: oldData.photos.filter(p => p.id !== deletedId) };
    });
    queryClient.invalidateQueries({ queryKey: ['myProfile'] });
  }, [queryClient, user?.id]);

  const photos = profileData?.photos || [];
  const primaryPhoto = photos.find(p => p.isPrimary);

  if (isLoading || !profileData) {
    return (<View style={styles.centerContainer}><ActivityIndicator size="large" color={AppStyles.colors.primary} /></View>);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{profileData.firstName}'s Profile</Text>
        <TouchableOpacity onPress={() => setIsEditing(prev => !prev)}>
          <Ionicons name={isEditing ? 'close' : 'create-outline'} size={24} color={AppStyles.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* --- Verification Status --- */}
        <View style={styles.verificationBar}>
            <Ionicons name={profileData.isIdentityVerified ? 'shield-checkmark' : 'alert-circle'} size={20} color={profileData.isIdentityVerified ? AppStyles.colors.green : AppStyles.colors.red} />
            <Text style={styles.verificationText}>
                Status: {profileData.isIdentityVerified ? 'Identity Verified' : 'Verification Required'}
            </Text>
            {!profileData.isIdentityVerified && (
                <TouchableOpacity onPress={() => navigation.navigate('VerificationGate' as never)} style={styles.verifyLink}>
                    <Text style={styles.linkText}>Verify Now</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* --- Photo Section --- */}
        <Text style={styles.sectionTitle}>Photos ({photos.length}/6)</Text>
        <View style={styles.photosGrid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.photoGridItem}>
              <ImageUploader
                photo={photo}
                onSetPrimary={handleSetPrimary}
                onDelete={handlePhotoDelete}
                onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['myProfile'] })}
                onStartUpload={() => Toast.show({ type: 'info', text1: 'Requesting S3 URL...' })}
              />
            </View>
          ))}
          {photos.length < 6 && (
            <View key="uploader" style={styles.photoGridItem}>
              <ImageUploader
                onSetPrimary={() => {}} // Dummy function
                onDelete={() => {}} // Dummy function
                onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ['myProfile'] })}
                onStartUpload={() => Toast.show({ type: 'info', text1: 'Requesting S3 URL...' })}
              />
            </View>
          )}
        </View>

        {/* --- About Me Section --- */}
        <Text style={styles.sectionTitle}>About Me</Text>
        {isEditing ? (
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio} onChangeText={setBio} placeholder="Tell us about yourself (max 1000 chars)" multiline maxLength={1000} textAlignVertical="top"
          />
        ) : (
          <Text style={styles.bioText}>{profileData.bio || 'Add a short bio to stand out!'}</Text>
        )}

        {/* --- Interests/Tags Section --- */}
        <Text style={styles.sectionTitle}>Interests (AI/User Tags)</Text>
        {isEditing ? (
          <TextInput
            style={styles.input} value={interests} onChangeText={setInterests}
            placeholder="e.g., coding, hiking, jazz (comma separated)"
          />
        ) : (
          <View style={styles.tagsContainer}>
            {profileData.topInterests.map((tag, index) => (
              <Text key={index} style={styles.tag}>{tag}</Text>
            ))}
            {profileData.topInterests.length === 0 && <Text style={styles.grayText}>Add some interests!</Text>}
          </View>
        )}
        
        {/* --- Preferences & Location Privacy (Advanced) --- */}
        <Text style={styles.sectionTitle}>Privacy & Preferences</Text>
        
        <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Age Range:</Text>
            <Text style={styles.preferenceValue}>25 - 35</Text>
        </View>
        
        <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Location Sharing Accuracy:</Text>
            {isEditing ? (
                <TextInput style={styles.preferenceInput} value={`${locationPrivacyLevel}`} onChangeText={(val) => setLocationPrivacyLevel(Number(val))} keyboardType="numeric" placeholder="e.g., 5000" />
            ) : (
                 <Text style={styles.preferenceValue}>{profileData.preferences?.locationPrivacyLevel || 5000} meters</Text>
            )}
        </View>
        
        <Text style={styles.privacyHint}>
            {/* Advanced Premium Gate */}
            {user?.isPremium ? 'Set accuracy down to 100 meters for precise matching.' : 'Upgrade to Premium to share location with > 5km accuracy.'}
        </Text>

        {isEditing && (
          <CustomButton
            title={updateMutation.isPending ? 'Saving...' : 'Save Changes & Update Location'}
            onPress={handleSave}
            disabled={updateMutation.isPending}
            style={styles.saveButton}
          />
        )}

        <TouchableOpacity style={styles.previewButton} onPress={() => console.log('Show public profile preview')}>
          <Ionicons name="eye-outline" size={20} color={AppStyles.colors.link} />
          <Text style={styles.previewText}>View Public Profile Preview</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppStyles.colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: AppStyles.colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppStyles.colors.lightGray },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: AppStyles.colors.text },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: AppStyles.colors.text, marginTop: 20, marginBottom: 10 },
  
  // Verification Bar (New)
  verificationBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppStyles.colors.white, padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: AppStyles.colors.lightGray },
  verificationText: { fontSize: 16, color: AppStyles.colors.text, marginLeft: 10, flex: 1 },
  verifyLink: { marginLeft: 10, paddingVertical: 5 },
  linkText: { color: AppStyles.colors.link, fontWeight: '600' },

  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  photoGridItem: { width: '48%', marginBottom: 10 },
  bioText: { fontSize: 16, color: AppStyles.colors.text, lineHeight: 24, backgroundColor: AppStyles.colors.white, padding: 15, borderRadius: 8 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  tag: { fontSize: 14, color: AppStyles.colors.primary, backgroundColor: AppStyles.colors.primaryLight, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  grayText: { color: AppStyles.colors.gray },
  // Input Styles
  input: { backgroundColor: AppStyles.colors.white, padding: 15, borderRadius: 8, fontSize: 16, color: AppStyles.colors.text, marginBottom: 10, borderWidth: 1, borderColor: AppStyles.colors.lightGray },
  bioInput: { minHeight: 120 },
  // Preferences Styles
  preferenceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppStyles.colors.lightGray },
  preferenceLabel: { fontSize: 16, color: AppStyles.colors.text },
  preferenceValue: { fontSize: 16, fontWeight: '600', color: AppStyles.colors.primary },
  preferenceInput: { fontSize: 16, fontWeight: '600', color: AppStyles.colors.primary, borderWidth: 1, borderColor: AppStyles.colors.lightGray, paddingHorizontal: 5, borderRadius: 4, width: 80, textAlign: 'right' },
  privacyHint: { fontSize: 12, color: AppStyles.colors.gray, fontStyle: 'italic', marginTop: 5 },
  // Buttons
  saveButton: { marginTop: 30 },
  previewButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  previewText: { color: AppStyles.colors.link, marginLeft: 5, fontSize: 16 },
});

export default ProfileScreen;