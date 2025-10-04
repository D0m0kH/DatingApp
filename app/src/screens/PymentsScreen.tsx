// app/src/screens/PaymentsScreen.tsx

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

import { AppStyles } from '../styles';
import CustomButton from '../components/CustomButton';
import { MOCK_PRICE_TIERS, createAndOpenCheckout } from '../services/payments';
import { useAuth } from '../hooks/useAuth';

// --- Price Tier Card Component (Advanced: Dynamic features/savings) ---
interface TierCardProps {
    name: string;
    description: string;
    price: number;
    type: 'SUBSCRIPTION' | 'BOOST' | 'CREDIT';
    onPurchase: () => void;
    features: string[];
    isBestValue?: boolean;
}

const TierCard: React.FC<TierCardProps> = ({ name, description, price, type, onPurchase, features, isBestValue = false }) => {
    return (
        <View style={[styles.card, type === 'SUBSCRIPTION' && styles.subscriptionCard, isBestValue && styles.bestValueCard]}>
            {isBestValue && <Text style={styles.badge}>BEST VALUE</Text>}
            <Text style={styles.cardTitle}>{name}</Text>
            <Text style={styles.cardPrice}>${price.toFixed(2)}</Text>
            
            <View style={styles.featureList}>
                {features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={AppStyles.colors.green} />
                        <Text style={styles.featureText}>{feature}</Text>
                    </View>
                ))}
            </View>

            <CustomButton
                title={type === 'SUBSCRIPTION' ? 'Subscribe Now' : 'Buy Now'}
                onPress={onPurchase}
                style={styles.purchaseButton}
                variant={type === 'SUBSCRIPTION' ? 'primary' : 'secondary'}
            />
        </View>
    );
};


// --- Main Component ---
const PaymentsScreen = () => {
    const navigation = useNavigation();
    const { user } = useAuth(); // Check user's current status

    const handlePurchase = useCallback(async (priceId: string, priceType: string) => {
        try {
            await createAndOpenCheckout(priceId, priceType);
            // After returning from browser, rely on deep link and server webhook
        } catch (e) {
            // Error handling is in createAndOpenCheckout service
        }
    }, []);

    // Advanced: Mock features list based on tier type
    const tiers = MOCK_PRICE_TIERS.map(tier => {
        let features = [];
        if (tier.type === 'SUBSCRIPTION') {
            features = ['Unlimited Swipes', '5 Super Likes/Day', 'Rewind Last Swipe', 'Advanced Location Privacy', 'See Who Likes You'];
        } else if (tier.type === 'BOOST') {
            features = ['1-Hour Profile Spotlight', '10x Visibility Boost'];
        }
        return { ...tier, features };
    });

    const subscriptions = tiers.filter(t => t.type === 'SUBSCRIPTION');
    const boosts = tiers.filter(t => t.type === 'BOOST');

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Premium & Boosts</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="close-circle-outline" size={30} color={AppStyles.colors.gray} />
                </TouchableOpacity>
            </View>
            
            {/* Advanced: Current Status */}
            {user?.isPremium && (
                <View style={styles.currentStatus}>
                    <Text style={styles.statusText}>
                        <Ionicons name="sparkles" size={16} color={AppStyles.colors.yellow} /> 
                        You are currently a Premium Member!
                    </Text>
                </View>
            )}

            {/* --- Subscription Tiers --- */}
            <Text style={styles.sectionTitle}>Unlock Premium Features</Text>
            {subscriptions.map(tier => (
                <TierCard
                    key={tier.id}
                    {...tier}
                    onPurchase={() => handlePurchase(tier.id, tier.type)}
                    isBestValue={tier.name.includes('Yearly')}
                />
            ))}

            {/* --- One-Time Boosts --- */}
            <Text style={styles.sectionTitle}>One-Time Boosts</Text>
            {boosts.map(tier => (
                <TierCard
                    key={tier.id}
                    {...tier}
                    onPurchase={() => handlePurchase(tier.id, tier.type)}
                    features={tier.features}
                />
            ))}

            <Text style={styles.footerText}>
                Your subscription will automatically renew unless canceled. Terms apply.
            </Text>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: AppStyles.colors.background },
    scrollContent: { paddingBottom: 40, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingTop: 50, marginBottom: 20 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: AppStyles.colors.text },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', color: AppStyles.colors.text, marginBottom: 15, marginTop: 20 },
    
    // Status
    currentStatus: { backgroundColor: AppStyles.colors.primaryLight, padding: 15, borderRadius: 10, marginBottom: 20 },
    statusText: { fontSize: 16, color: AppStyles.colors.primary, fontWeight: 'bold' },

    // Card Styles
    card: { backgroundColor: AppStyles.colors.white, borderRadius: 12, padding: 20, marginBottom: 15, shadowColor: AppStyles.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, position: 'relative' },
    subscriptionCard: { borderWidth: 2, borderColor: AppStyles.colors.lightGray },
    bestValueCard: { borderColor: AppStyles.colors.primary, borderWidth: 2 },
    badge: { position: 'absolute', top: -10, right: 10, backgroundColor: AppStyles.colors.yellow, color: AppStyles.colors.black, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 15, fontSize: 12, fontWeight: 'bold' },
    cardTitle: { fontSize: 22, fontWeight: 'bold', color: AppStyles.colors.text },
    cardPrice: { fontSize: 36, fontWeight: 'bold', color: AppStyles.colors.primary, marginVertical: 10 },
    cardDescription: { fontSize: 16, color: AppStyles.colors.gray, marginBottom: 20, minHeight: 40 },
    featureList: { marginBottom: 20 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    featureText: { fontSize: 14, color: AppStyles.colors.text, marginLeft: 10 },
    purchaseButton: { marginTop: 10 },
    footerText: { fontSize: 12, color: AppStyles.colors.gray, textAlign: 'center', marginTop: 30 },
});

export default PaymentsScreen;