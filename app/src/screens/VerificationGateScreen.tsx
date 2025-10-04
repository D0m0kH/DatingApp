// app/src/screens/VerificationGateScreen.tsx

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import { AppStyles } from '../styles';
import CustomButton from '../components/CustomButton';
import { post } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// --- Placeholder for ZKP/Biometric SDK ---
const ZKP_SDK = {
    // In a real app, this would be an SDK wrapper around a privacy-preserving verification service
    generateAgeProof: async (userId: string): Promise<string> => {
        // Simulate generating a ZKP proof that user is > 18 without revealing their DOB/ID
        await new Promise(resolve => setTimeout(resolve, 2500)); 
        return `zkp-proof-for-user-${userId}-${Date.now()}-A17B4C`;
    },
    VERIFIER_ID: 'zkp-age-verifier-v2',
};

const VerificationGateScreen = () => {
    const navigation = useNavigation();
    const { user, getCurrentUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleVerifyPress = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        try {
            // 1. Generate the ZKP proof locally (or via SDK)
            Toast.show({ type: 'info', text1: 'Generating Proof...', text2: 'Processing biometric data securely.' });
            const proof = await ZKP_SDK.generateAgeProof(user.id);

            // 2. Send the proof to the backend for verification
            await post('/auth/verify-identity', {
                proof: proof,
                verifierId: ZKP_SDK.VERIFIER_ID,
            });

            // 3. Update local user status
            const updatedUser = await getCurrentUser();
            
            if (updatedUser?.isIdentityVerified) {
                Toast.show({ type: 'success', text1: 'Identity Verified!', text2: 'Welcome to the trusted community.' });
                navigation.dispatch(StackActions.replace('Main'));
            } else {
                 throw new Error('Verification failed on server side.');
            }

        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Verification Failed', text2: error.message || 'Please ensure your device/ID meets requirements.' });
        } finally {
            setLoading(false);
        }
    }, [user, getCurrentUser, navigation]);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.card}>
                <Ionicons name="shield-checkmark-outline" size={80} color={AppStyles.colors.primary} />
                <Text style={styles.title}>Join the Verified Community</Text>
                <Text style={styles.description}>
                    For your safety and authenticity, certain features (like swiping and chatting) require 
                    Identity Verification. We use a **Zero-Knowledge Proof** system to confirm your age 
                    and liveness without storing your ID or photo.
                </Text>
                
                <View style={styles.benefitRow}>
                    <Ionicons name="lock-closed" size={20} color={AppStyles.colors.green} />
                    <Text style={styles.benefitText}>Protects against bots and scams.</Text>
                </View>
                <View style={styles.benefitRow}>
                    <Ionicons name="sparkles" size={20} color={AppStyles.colors.green} />
                    <Text style={styles.benefitText}>Unlocks the main matching feed.</Text>
                </View>

                <CustomButton
                    title={loading ? 'Processing Proof...' : 'Verify Identity Now'}
                    onPress={handleVerifyPress}
                    disabled={loading}
                    style={styles.verifyButton}
                />
            </View>

            <TouchableOpacity onPress={handleVerifyPress} disabled={loading} style={styles.laterButton}>
                <Text style={styles.laterText}>Do it Later (Limited Access)</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: AppStyles.colors.background,
    },
    card: {
        backgroundColor: AppStyles.colors.white,
        borderRadius: 15,
        padding: 30,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
        shadowColor: AppStyles.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: AppStyles.colors.text,
        marginTop: 20,
        marginBottom: 10,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: AppStyles.colors.gray,
        marginBottom: 30,
        textAlign: 'center',
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        width: '100%',
        paddingHorizontal: 20,
    },
    benefitText: {
        fontSize: 16,
        color: AppStyles.colors.text,
        marginLeft: 10,
        flex: 1,
    },
    verifyButton: {
        marginTop: 30,
        width: '100%',
    },
    laterButton: {
        marginTop: 20,
        padding: 10,
    },
    laterText: {
        color: AppStyles.colors.link,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default VerificationGateScreen;