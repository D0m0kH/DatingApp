// app/src/components/ImageUploader.tsx

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { AppStyles } from '../styles';
import { Photo } from '../types/shared';
import { post, del, patch } from '../services/api';

// --- Type Definitions ---
interface ImageUploaderProps {
  photo?: Photo; // Existing photo data
  onDelete: (photoId: string) => void;
  onSetPrimary: (photoId: string) => void;
  onUploadComplete: (s3Key: string) => void; // Callback when the server has the Photo record
  onStartUpload: () => void;
}

// --- Component ---
const ImageUploader: React.FC<ImageUploaderProps> = ({ photo, onDelete, onSetPrimary, onUploadComplete, onStartUpload }) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // --- Core Logic ---
  
  /**
   * @description Picks, crops, and processes an image using Expo Image Manipulator.
   */
  const pickAndCropImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Need camera roll permissions to upload photos.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    });

    if (result.canceled || !result.assets || !result.assets[0].uri) {
      return;
    }

    const imageUri = result.assets[0].uri;

    try {
        const manipResult = await manipulateAsync(
            imageUri,
            [{ resize: { width: 1080 } }], 
            { compress: 0.9, format: SaveFormat.JPEG }
        );
        await uploadImage(manipResult.uri);
    } catch (e) {
        Alert.alert('Image Error', 'Failed to process or crop the image.');
        console.error('Image manipulation failed:', e);
    }
  };

  /**
   * @description Gets a presigned URL and uploads the file directly to S3.
   */
  const uploadImage = async (uri: string) => {
    onStartUpload();
    setLoading(true);

    try {
      // 1. Get presigned URL from backend
      const fileExtension = uri.split('.').pop() || 'jpg';
      const presignResponse = await post<{ photoId: string; s3Key: string; presignedUrl: string; url: string }>(
        '/profile/me/photos',
        { fileExtension }
      );

      const { photoId, s3Key, presignedUrl } = presignResponse;

      // 2. Upload to S3 using the presigned URL
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`,
        },
      });

      if (uploadResult.status !== 200) {
        throw new Error(`S3 upload failed with status ${uploadResult.status}`);
      }

      // 3. Notify backend that upload is complete (triggers AI analysis & moderation queue)
      await patch(`/profile/me/photos/${photoId}/upload-complete`, {});

      Toast.show({ type: 'success', text1: 'Photo uploaded!', text2: 'Awaiting AI analysis and review.' });
      onUploadComplete(s3Key);

    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: error.message || 'Could not upload to S3.' });
    } finally {
      setLoading(false);
      setUploadProgress(0); 
    }
  };

  const handleDelete = useCallback(() => {
    if (!photo) return;
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [{ text: 'Cancel', style: 'cancel' }, {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setLoading(true);
          try {
            await del(`/profile/me/photos/${photo.id}`);
            onDelete(photo.id); 
            Toast.show({ type: 'success', text1: 'Photo deleted.' });
          } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Delete Failed', text2: e.message });
          } finally { setLoading(false); }
        },
      }],
    );
  }, [photo, onDelete]);


  // --- Render ---
  if (photo) {
    // Render existing photo slot
    const isApproved = photo.status === 'APPROVED';
    const isPending = photo.status === 'PENDING' || photo.status === 'FLAGGED';
    const isRejected = photo.status === 'REJECTED';

    return (
      <View style={[styles.photoSlot, photo.isPrimary && styles.primarySlot]}>
        <Image source={{ uri: photo.url }} style={styles.image} />
        {loading && <ActivityIndicator size="large" style={styles.overlayActivity} color={AppStyles.colors.primary} />}

        {/* Advanced: Moderation Status Overlay */}
        {isPending && (
          <View style={[styles.moderationOverlay, styles.pendingOverlay]}>
            <Ionicons name="time-outline" size={24} color={AppStyles.colors.white} />
            <Text style={styles.moderationText}>{photo.status === 'FLAGGED' ? 'AI Flagged' : 'Pending Review'}</Text>
          </View>
        )}
        {isRejected && (
            <View style={[styles.moderationOverlay, styles.rejectedOverlay]}>
                <Ionicons name="close-circle-outline" size={24} color={AppStyles.colors.white} />
                <Text style={styles.moderationText}>Rejected</Text>
            </View>
        )}
        
        {/* Advanced: AI Tags Display */}
        {isApproved && photo.aiTags.length > 0 && (
            <View style={styles.tagContainer}>
                {photo.aiTags.slice(0, 3).map(tag => (
                    <Text key={tag} style={styles.tagText}>#{tag}</Text>
                ))}
            </View>
        )}

        {/* Actions (Primary/Delete) */}
        <View style={styles.photoActions}>
          <TouchableOpacity onPress={() => onSetPrimary(photo.id)} style={styles.actionButton}>
            <Ionicons name={photo.isPrimary ? 'star' : 'star-outline'} size={24} color={AppStyles.colors.yellow} />
            <Text style={styles.actionButtonText}>Primary</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={24} color={AppStyles.colors.red} />
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render empty upload slot
  return (
    <TouchableOpacity style={styles.uploadSlot} onPress={loading ? undefined : pickAndCropImage}>
      {loading ? (
        <View>
          <ActivityIndicator size="small" color={AppStyles.colors.primary} />
          <Text style={styles.uploadText}>Uploading... ({Math.round(uploadProgress * 100)}%)</Text>
        </View>
      ) : (
        <>
          <Ionicons name="add-circle-outline" size={40} color={AppStyles.colors.gray} />
          <Text style={styles.uploadText}>Add Photo</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // --- Photo Slot Styles ---
  photoSlot: { width: '100%', height: 250, borderRadius: 15, overflow: 'hidden', marginBottom: 15, backgroundColor: AppStyles.colors.lightGray, position: 'relative' },
  primarySlot: { borderColor: AppStyles.colors.primary, borderWidth: 2 },
  image: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  overlayActivity: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10 },
  // --- Empty Slot Styles ---
  uploadSlot: { width: '100%', height: 200, borderRadius: 15, borderWidth: 2, borderColor: AppStyles.colors.lightGray, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  uploadText: { color: AppStyles.colors.gray, marginTop: 10, fontWeight: '600' },
  // --- Moderation Status ---
  moderationOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  pendingOverlay: { backgroundColor: 'rgba(255, 165, 0, 0.7)' },
  rejectedOverlay: { backgroundColor: 'rgba(255, 0, 0, 0.7)' },
  moderationText: { color: AppStyles.colors.white, marginTop: 5, fontSize: 16, fontWeight: 'bold' },
  // --- AI Tags ---
  tagContainer: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', flexWrap: 'wrap', zIndex: 10 },
  tagText: { fontSize: 12, color: AppStyles.colors.white, backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, marginRight: 5, marginBottom: 5 },
  // --- Actions ---
  photoActions: { position: 'absolute', bottom: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(0, 0, 0, 0.6)', borderTopLeftRadius: 15, zIndex: 10 },
  actionButton: { padding: 10, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  actionButtonText: { color: AppStyles.colors.white, marginLeft: 5, fontWeight: '500' },
});

export default ImageUploader;