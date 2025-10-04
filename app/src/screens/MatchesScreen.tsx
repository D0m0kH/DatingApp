// app/src/screens/MatchesScreen.tsx

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { get } from '../services/api';
import { Match, UserPublic } from '.';
import { AppStyles } from '';
import { MainTabParamList } from '../navigation';

// --- API Service Hook remains similar ---
const useMatches = () => {
  return useQuery<Match[], Error>({
    queryKey: ['matches'],
    queryFn: () => get<Match[]>('/match/matches'),
    staleTime: 5 * 1000,
  });
};

// --- Match Item Component (Advanced: E2E Key Status) ---
interface MatchItemProps {
  match: Match & { otherUser: Partial<UserPublic> & { isE2EKeyExchanged: boolean } };
  onPress: () => void;
}

const MatchListItem: React.FC<MatchItemProps> = React.memo(({ match, onPress }) => {
  const { otherUser, lastMessage, unreadCount } = match;
  const isUnread = unreadCount > 0;
  const isKeyExchanged = otherUser.isE2EKeyExchanged; // Advanced: Check E2E status

  return (
    <TouchableOpacity style={styles.matchItem} onPress={onPress}>
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: otherUser.primaryPhotoUrl || 'https://via.placeholder.com/100?text=Match' }}
          style={styles.avatar}
        />
        {/* E2E Status Indicator */}
        <View style={[styles.statusDot, { backgroundColor: isKeyExchanged ? AppStyles.colors.green : AppStyles.colors.yellow }]} />
        
        {isUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.matchName}>{otherUser.firstName} ({match.coreCompatibility.toFixed(2)})</Text>
        <Text style={[styles.lastMessage, isUnread && styles.lastMessageUnread]} numberOfLines={1}>
          {lastMessage || 'Say hello!'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// --- Main Component remains similar ---
const MatchesScreen = () => {
  const navigation = useNavigation();
  const { data: matches, isLoading, isError, refetch } = useMatches();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const renderItem = useCallback(({ item }: { item: Match }) => {
    const matchWithUser = item as Match & { otherUser: Partial<UserPublic> & { isE2EKeyExchanged: boolean } };

    const navigateToChat = () => {
      navigation.navigate('Chat' as never, {
        matchId: item.id,
        matchName: matchWithUser.otherUser.firstName || 'Match',
      } as any);
    };

    return <MatchListItem match={matchWithUser} onPress={navigateToChat} />;
  }, [navigation]);

  if (isLoading) { return (<View style={styles.centerContainer}><ActivityIndicator size="large" color={AppStyles.colors.primary} /></View>); }
  if (isError || !matches || matches.length === 0) { return (<View style={styles.centerContainer}><Text style={styles.emptyText}>No Matches Yet</Text></View>); }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Your Matches ({matches.length})</Text>
      <FlatList
        data={matches}
        keyExtractor={useCallback((item: Match) => item.id, [])}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppStyles.colors.background },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: AppStyles.colors.text, padding: 20, paddingTop: 40, backgroundColor: AppStyles.colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppStyles.colors.lightGray },
  listContent: { paddingHorizontal: 10, paddingTop: 10 },
  matchItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, backgroundColor: AppStyles.colors.white },
  avatarContainer: { position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
  
  // New Status Dot
  statusDot: { position: 'absolute', bottom: 0, right: 15, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: AppStyles.colors.white, zIndex: 10 },

  unreadBadge: { position: 'absolute', top: -4, right: 10, backgroundColor: AppStyles.colors.red, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, zIndex: 10 },
  unreadText: { color: AppStyles.colors.white, fontSize: 12, fontWeight: 'bold' },
  info: { flex: 1, justifyContent: 'center' },
  matchName: { fontSize: 18, fontWeight: 'bold', color: AppStyles.colors.text },
  lastMessage: { fontSize: 14, color: AppStyles.colors.gray, marginTop: 2 },
  lastMessageUnread: { fontWeight: 'bold', color: AppStyles.colors.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: AppStyles.colors.lightGray, marginLeft: 85 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: AppStyles.colors.gray, marginTop: 20 },
});

export default MatchesScreen;