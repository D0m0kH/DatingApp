// app/src/components/SwipeDeck.tsx

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity, Alert } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedGestureHandler, withSpring, interpolate, runOnJS, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import Toast from 'react-native-toast-message';

import { UserPublic } from '../types/shared';
import { AppStyles } from '../styles';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const CARD_HEIGHT = Dimensions.get('window').height * 0.7;

// --- Interface remains similar, now based on advanced UserPublic ---
interface SwipeDeckProps {
  profiles: UserPublic[];
  onSwipeLeft: (profileId: string) => void;
  onSwipeRight: (profileId: string) => void;
  onSuperLike: (profileId: string) => void;
  onUndo: (profileId: string) => Promise<boolean>;
  onEmptyDeck: () => void;
  isPremium: boolean;
}

// --- Card Component (Advanced) ---
interface CardProps {
  profile: UserPublic;
  index: number;
  translateX: Animated.SharedValue<number>;
  rotate: Animated.SharedValue<string>;
  scale: Animated.SharedValue<number>;
  panHandlers: any;
  isTopCard: boolean;
  activeCardIndex: number;
}

const SwipeCard: React.FC<CardProps> = ({
  profile, index, translateX, rotate, scale, panHandlers, isTopCard, activeCardIndex,
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Animated Styles (Simplified for brevity, assuming implementation is correct from previous step)
  const cardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: rotate.value },
        { scale: isTopCard ? 1 : withSpring(scale.value, { damping: 12 }) },
      ],
      zIndex: -index,
      opacity: isTopCard ? 1 : withTiming(interpolate(activeCardIndex, [index, index + 1], [1, 0], 'clamp'), { duration: 200 }),
    };
  });
  
  // ... (likeStyle, nopeStyle animations remain similar) ...

  const photoUrls = profile.photos.filter(p => p.status === 'APPROVED').map(p => p.url);
  const currentPhoto = photoUrls[currentPhotoIndex] || 'https://via.placeholder.com/400?text=No+Photo';

  const goToNextPhoto = () => setCurrentPhotoIndex(i => (i + 1) % photoUrls.length);
  const goToPrevPhoto = () => setCurrentPhotoIndex(i => (i - 1 + photoUrls.length) % photoUrls.length);

  // Advanced: Multi-Vector Score Display
  const coreScore = profile.scoreVector[0] ? (profile.scoreVector[0] * 100).toFixed(0) : 'N/A';
  const chatScore = profile.scoreVector[1] ? (profile.scoreVector[1] * 100).toFixed(0) : 'N/A';
  const reasonText = profile.reason;

  return (
    <Animated.View style={[styles.cardContainer, cardStyle, { height: CARD_HEIGHT }]} pointerEvents={isTopCard ? 'auto' : 'none'}>
      {isTopCard && <PanGestureHandler onGestureEvent={panHandlers}>
        <Animated.View style={{ flex: 1 }}>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: currentPhoto }} style={styles.image} resizeMode="cover" />

            {/* Image Carousel Controls/Pagination remain similar */}

            {/* OVERLAYS remain similar */}

            {/* Profile Info (Advanced) */}
            <View style={styles.infoContainer}>
              <View style={styles.headerRow}>
                <Text style={styles.nameText}>{profile.firstName}, {profile.age}</Text>
                {profile.isPremium && <Ionicons name="sparkles" size={24} color={AppStyles.colors.yellow} style={styles.badge} />}
                {/* Identity Verification Badge */}
                {profile.isIdentityVerified && <Ionicons name="shield-checkmark" size={20} color={AppStyles.colors.green} style={styles.badge} />} 
              </View>
              
              {/* AI Score & Reason */}
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreText}>Core Match: {coreScore}% | Chat Vibe: {chatScore}%</Text>
                <Text style={styles.reasonText} numberOfLines={1}>
                    <Ionicons name="analytics" size={14} color={AppStyles.colors.white} /> {reasonText}
                </Text>
              </View>

              <Text style={styles.bioText} numberOfLines={2}>{profile.bio}</Text>
              <View style={styles.tagsContainer}>
                {profile.topInterests.map(interest => (
                  <Text key={interest} style={styles.tagText}>{interest}</Text>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </PanGestureHandler>}
    </Animated.View>
  );
};


// --- Deck Component (Advanced) ---
const SwipeDeck: React.FC<SwipeDeckProps> = ({ profiles, onSwipeLeft, onSwipeRight, onSuperLike, onUndo, onEmptyDeck, isPremium = false }) => {
  const [cardIndex, setCardIndex] = useState(0);
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const matchAnimationRef = useRef<LottieView>(null);

  // Shared values for the top card
  const translateX = useSharedValue(0);

  // ... (onGestureEvent implementation remains similar) ...
  const onGestureEvent = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number }>({
    onStart: (event, ctx) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.startX + event.translationX;
    },
    onEnd: (event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, { velocity: event.velocityX, damping: 10 });
        runOnJS(handleSwipeAction)('right', profiles[cardIndex].id);
      }
      else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { velocity: event.velocityX, damping: 10 });
        runOnJS(handleSwipeAction)('left', profiles[cardIndex].id);
      }
      else {
        translateX.value = withSpring(0);
      }
    },
  });

  const handleSwipeAction = useCallback((direction: 'left' | 'right', profileId: string) => {
    if (direction === 'right') {
      onSwipeRight(profileId);
    } else {
      onSwipeLeft(profileId);
    }

    // Check for Match (STUB) - Assume match logic is handled by backend and a socket event will be received
    if (Math.random() < 0.1) { // 10% chance for a mock match
        setShowMatchAnimation(true);
        matchAnimationRef.current?.play(0);
    }

    // Move to the next card
    setTimeout(() => {
      setCardIndex(prev => prev + 1);
      translateX.value = 0; // Reset for the new top card
      if (cardIndex + 1 >= profiles.length) {
        onEmptyDeck();
      }
    }, 200); 
  }, [cardIndex, profiles, onSwipeRight, onSwipeLeft, translateX, onEmptyDeck]);

  const swipeBack = useCallback(async () => {
    // Premium Feature Gate for Undo
    if (!isPremium) {
        return Toast.show({ type: 'info', text1: 'Premium Required', text2: 'Undo is a premium feature. Upgrade to rewind!' });
    }
    
    if (cardIndex === 0) {
      return Toast.show({ type: 'info', text1: 'Nothing to undo.' });
    }

    const lastSwipedProfile = profiles[cardIndex - 1];
    const success = await onUndo(lastSwipedProfile.id);

    if (success) {
      setCardIndex(prev => prev - 1);
      // Animated reverse swipe (Fly back from left/right)
      translateX.value = withTiming(0, { duration: 500 });
      Toast.show({ type: 'success', text1: 'Undo successful!' });
    } else {
      Toast.show({ type: 'error', text1: 'Undo Failed', text2: 'Failed to rollback action on the server.' });
    }
  }, [cardIndex, profiles, onUndo, translateX, isPremium]);

  const currentProfile = profiles[cardIndex];
  const nextProfile = profiles[cardIndex + 1];


  if (!currentProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="time-outline" size={80} color={AppStyles.colors.gray} />
        <Text style={styles.emptyText}>That's all for now!</Text>
        <Text style={styles.emptyTextSub}>Check back later or adjust your filters.</Text>
      </View>
    );
  }

  return (
    <View style={styles.deck}>
      {/* Match Animation Overlay */}
      {showMatchAnimation && (
        <View style={styles.matchAnimationOverlay} pointerEvents="none">
          <LottieView
            ref={matchAnimationRef}
            source={require('../../assets/animations/match-celebration.json')}
            style={styles.lottie}
            loop={false}
            onAnimationFinish={() => setShowMatchAnimation(false)}
          />
        </View>
      )}

      {/* Render the next card first for proper stacking */}
      {nextProfile && (
        <SwipeCard
          profile={nextProfile}
          index={cardIndex + 1}
          translateX={useSharedValue(0)}
          rotate={useSharedValue('0deg')}
          scale={useSharedValue(0.9)} 
          panHandlers={{}}
          isTopCard={false}
          activeCardIndex={cardIndex}
        />
      )}

      {/* Render the top card */}
      <SwipeCard
        profile={currentProfile}
        index={cardIndex}
        translateX={translateX}
        rotate={useAnimatedStyle(() => ({
            transform: [{ rotateZ: `${interpolate(translateX.value, [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2], [-15, 0, 15], 'clamp')}deg` }],
        }))}
        scale={useSharedValue(1)}
        panHandlers={onGestureEvent}
        isTopCard={true}
        activeCardIndex={cardIndex}
      />

      {/* Action Buttons (Advanced) */}
      <View style={styles.actionButtons}>
        <ActionButton
          iconName="arrow-undo"
          color={isPremium ? AppStyles.colors.blue : AppStyles.colors.gray}
          onPress={swipeBack}
          size={24}
          disabled={cardIndex === 0 && !isPremium} // Disable if not premium AND no card to undo
          label="Undo"
        />
        <ActionButton
          iconName="close"
          color={AppStyles.colors.red}
          onPress={() => handleSwipeAction('left', currentProfile.id)}
          size={32}
          label="Nope"
        />
        <ActionButton
          iconName="star"
          color={AppStyles.colors.blue}
          onPress={() => onSuperLike(currentProfile.id)}
          size={24}
          label="Super"
        />
        <ActionButton
          iconName="heart"
          color={AppStyles.colors.green}
          onPress={() => handleSwipeAction('right', currentProfile.id)}
          size={32}
          label="Like"
        />
        <ActionButton
          iconName="flash"
          color={AppStyles.colors.yellow}
          onPress={() => navigation.navigate('Payments' as never)} // Navigate to payments screen
          size={24}
          label="Boost"
        />
      </View>
    </View>
  );
};

// Simple reusable button component for the action row
const ActionButton = ({ iconName, color, onPress, size, disabled = false, label }: any) => (
  <TouchableOpacity
    style={[styles.actionButton, { opacity: disabled ? 0.5 : 1 }]}
    onPress={onPress}
    disabled={disabled}
  >
    <Ionicons name={iconName} size={size} color={color} />
    <Text style={[styles.actionLabel, { color }]}>{label}</Text>
  </TouchableOpacity>
);


const styles = StyleSheet.create({
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardContainer: { position: 'absolute', width: SCREEN_WIDTH * 0.9, borderRadius: 20, backgroundColor: AppStyles.colors.white, shadowColor: AppStyles.colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 8 },
  imageWrapper: { flex: 1, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  infoContainer: { padding: 20, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  nameText: { fontSize: 28, fontWeight: 'bold', color: AppStyles.colors.white, marginRight: 10 },
  badge: { marginLeft: 5 },

  // New Score Styles
  scoreContainer: { marginBottom: 10, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: 'rgba(75, 0, 130, 0.8)', borderRadius: 8, alignSelf: 'flex-start' }, // Violet background for AI info
  scoreText: { fontSize: 14, color: AppStyles.colors.white, fontWeight: 'bold' },
  reasonText: { fontSize: 12, color: AppStyles.colors.white, marginTop: 2 },
  
  bioText: { fontSize: 16, color: AppStyles.colors.white, marginBottom: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  tagText: { fontSize: 14, color: AppStyles.colors.white, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 15, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 6, fontWeight: '500' },
  
  // ... (Overlay and Empty Container styles remain similar) ...

  actionButtons: { flexDirection: 'row', position: 'absolute', bottom: 20, width: SCREEN_WIDTH * 0.9, justifyContent: 'space-around', paddingHorizontal: 10, zIndex: 10 },
  actionButton: { backgroundColor: AppStyles.colors.white, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: AppStyles.colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 3 },
  actionLabel: { fontSize: 10, marginTop: 2, fontWeight: 'bold' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 24, fontWeight: 'bold', color: AppStyles.colors.text, marginTop: 20 },
  emptyTextSub: { fontSize: 16, color: AppStyles.colors.gray, marginTop: 5 },
  matchAnimationOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  lottie: { width: '100%', height: '100%' },
  // ... (Carousel control styles remain similar)
});

export default SwipeDeck;