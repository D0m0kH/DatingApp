// app/src/screens/ChatScreen.tsx

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { get, post } from '../services/api';
import { Message } from '../types/shared';
import { MainTabParamList } from '../navigation';
import CustomButton from '../components/CustomButton';
import { AppStyles } from '../styles';
import ImageUploader from '../components/ImageUploader';
import IcebreakerGenerator from '../components/IcebreakerGenerator'; // Import Advanced Component

// --- Type Definitions ---
type ChatScreenRouteProp = RouteProp<MainTabParamList, 'Chat'>;

interface MessageHistory {
  messages: Message[];
  nextCursor: string | null;
}

// --- E2E Encryption Stub (Conceptual) ---
const E2E_CRYPTO = {
    // In a real app, this would use WebCrypto/React Native Crypto for X3DH/Signal Protocol
    myPublicKey: 'PK_MY_DEVICE_123',
    getMatchKey: (matchId: string, otherUserId: string) => {
        // Look up the shared symmetric key derived from both public keys
        return `SYM_KEY_${matchId}_${otherUserId}`; // STUB
    },
    encrypt: (text: string, key: string) => `[E2E]${text} (key:${key})`,
    decrypt: (encryptedText: string, key: string) => {
        if (encryptedText.startsWith('[E2E]')) return encryptedText.replace('[E2E]', '').split(' (key:')[0];
        return encryptedText; // Fallback for unencrypted status messages
    },
};

// --- API Hooks (useMessageHistory and useMarkRead remain similar) ---
const useMessageHistory = (matchId: string) => {
    // ... (implementation remains similar)
    return useInfiniteQuery<MessageHistory, Error>({
        queryKey: ['chat', matchId],
        queryFn: ({ pageParam = undefined }) =>
            get<MessageHistory>(`/message/${matchId}`, { cursor: pageParam, limit: 50 }),
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: undefined,
    });
};
const useMarkRead = (matchId: string) => {
    const queryClient = useQueryClient();
    return useCallback(async () => {
        await post(`/message/${matchId}/read`);
        queryClient.invalidateQueries({ queryKey: ['matches'] });
    }, [matchId, queryClient]);
};


// --- Component: Message Bubble (Advanced) ---
const MessageBubble: React.FC<{ message: Message; isSender: boolean; matchKey: string }> = ({ message, isSender, matchKey }) => {
  const bubbleStyle = isSender ? styles.senderBubble : styles.recipientBubble;
  const containerStyle = isSender ? styles.senderContainer : styles.recipientContainer;

  // Advanced: Decrypt message text
  const decryptedText = matchKey 
    ? E2E_CRYPTO.decrypt(message.text || '', matchKey) 
    : 'Message encrypted, key unavailable.';

  return (
    <View style={containerStyle}>
      <View style={[styles.bubble, bubbleStyle]}>
        <Text style={isSender ? styles.senderText : styles.recipientText}>{decryptedText}</Text>
        
        {/* Message Status (using MessageStatus enum) */}
        <View style={styles.statusContainer}>
          {isSender && (
            <>
              {message.messageStatus === 'READ' && <Ionicons name="checkmark-done-circle" size={12} color={AppStyles.colors.blue} style={styles.statusIcon} />}
              {message.messageStatus === 'DELIVERED' && <Ionicons name="checkmark-circle-outline" size={12} color={AppStyles.colors.gray} style={styles.statusIcon} />}
              {message.messageStatus === 'SENT' && <Ionicons name="time-outline" size={12} color={AppStyles.colors.gray} style={styles.statusIcon} />}
            </>
          )}
          <Text style={styles.timestamp}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    </View>
  );
};

// --- Component: Input Area (Advanced) ---
const ChatInput: React.FC<{ matchId: string; otherUserId: string; matchKey: string; }> = ({ matchId, otherUserId, matchKey }) => {
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { sendMessage, startTyping, stopTyping } = useSocket(useAuth().user?.id || null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const handleSend = () => {
    if (!matchKey) {
        return Toast.show({ type: 'error', text1: 'Key Missing', text2: 'Cannot send message until E2E key exchange is complete.' });
    }

    if (text.trim() || isUploading) {
      // Advanced: Encrypt the message before sending
      const encryptedText = E2E_CRYPTO.encrypt(text.trim(), matchKey);
      
      // Advanced: Simulate client-side NLP intent detection
      const nlpIntent = text.toLowerCase().includes('question') ? 'open_question' : 'standard_chat'; 
      
      sendMessage(matchId, encryptedText, [], nlpIntent);
      setText('');
      stopTyping(matchId);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    // ... (Typing logic remains similar) ...
  };

  // Handler for Icebreaker component selection
  const handleIcebreakerSelect = useCallback((message: string) => {
    setText(message);
    // User often wants to send immediately after selection
    // handleSend(); // Could auto-send or require user tap
  }, []);

  return (
    <View>
      {/* Advanced: Icebreaker Generator */}
      <IcebreakerGenerator matchId={matchId} profileId={otherUserId} onSelect={handleIcebreakerSelect} />

      <View style={styles.inputContainer}>
        {/* Attachment Uploader */}
        <ImageUploader onUploadComplete={() => {}} onStartUpload={() => setIsUploading(true)}>
          <TouchableOpacity style={styles.attachButton} disabled={isUploading}>
            <Ionicons name="image-outline" size={24} color={AppStyles.colors.primary} />
          </TouchableOpacity>
        </ImageUploader>

        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={handleTextChange}
          placeholder={matchKey ? "Type E2E message..." : "Waiting for E2E Key..."}
          multiline
          accessibilityLabel="Message input field"
        />
        <CustomButton
          title={isUploading ? '...' : 'Send'}
          onPress={handleSend}
          disabled={(!text.trim() && !isUploading) || isUploading || !matchKey}
          style={styles.sendButton}
        />
      </View>
    </View>
  );
};

// --- Main Chat Screen Component (Advanced) ---
const ChatScreen = () => {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList<Message>>(null);
  const { user } = useAuth();
  const { isConnected, onMessage, onTyping, onKeyUpdate } = useSocket(user?.id || null);

  const { matchId } = route.params;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMessageHistory(matchId);
  const markMessagesAsRead = useMarkRead(matchId);

  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isKeyExchanged, setIsKeyExchanged] = useState(false); // New: E2E Key Status
  const [matchKey, setMatchKey] = useState<string | null>(null); // New: The derived symmetric key

  const remoteMessages = useMemo(() => data?.pages.flatMap(page => page.messages) || [], [data]);

  const allMessages = useMemo(() => {
    const combined = [...remoteMessages, ...localMessages].filter((msg, index, self) =>
        index === self.findIndex((t) => (t.id === msg.id))
    );
    combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return combined;
  }, [remoteMessages, localMessages]);


  // --- Advanced E2E Key Exchange Logic ---
  const otherUserId = allMessages.find(m => m.senderId !== user?.id)?.senderId || 'unknown'; // Simple way to find partner

  useEffect(() => {
    // 1. Simulate key generation and initial POST to backend
    const initializeKey = async () => {
        if (!user || !matchId) return;
        
        // Find match partner ID (requires knowing who the other person is)
        if (otherUserId === 'unknown') return; 

        // 2. Post my public key
        await post(`/message/${matchId}/key-exchange`, { publicKey: E2E_CRYPTO.myPublicKey });
        
        // 3. Derive symmetric key (assuming the partner's key is cached/retrievable)
        setMatchKey(E2E_CRYPTO.getMatchKey(matchId, otherUserId));
        setIsKeyExchanged(true); // Assuming the act of posting my key is enough for initial status

        // 4. Listen for partner's public key update
        return onKeyUpdate((payload) => {
            if (payload.matchId === matchId && payload.senderId === otherUserId) {
                // Partner's key received. Now we can fully derive the symmetric key.
                setMatchKey(E2E_CRYPTO.getMatchKey(matchId, otherUserId));
                setIsKeyExchanged(true);
                Toast.show({ type: 'info', text1: 'E2E Key Exchanged', text2: 'Your chat is now fully encrypted!' });
            }
        });
    };
    initializeKey();
  }, [user, matchId, otherUserId, onKeyUpdate]);


  // --- Real-time Message Handler ---
  useEffect(() => {
    // 1. Listen for new messages
    const unsubscribeNewMessage = onMessage((newMessage) => {
      if (newMessage.senderId === user?.id) return;
      setLocalMessages(prev => {
        if (prev.some(m => m.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      setTimeout(markMessagesAsRead, 500);
    });

    // 2. Listen for typing indicators
    const unsubscribeTyping = onTyping((payload) => {
        if (payload.matchId !== matchId || payload.userId === user?.id) return;

        setTypingUsers(prev => {
            if (payload.event === 'typing:start' && !prev.includes(payload.userId)) {
                return [...prev, payload.userId];
            }
            if (payload.event === 'typing:stop') {
                return prev.filter(id => id !== payload.userId);
            }
            return prev;
        });
    });

    markMessagesAsRead();

    return () => {
      unsubscribeNewMessage();
      unsubscribeTyping();
    };
  }, [onMessage, onTyping, markMessagesAsRead, matchId, user?.id]);


  // --- Render Functions ---
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    return (
      <MessageBubble
        message={item}
        isSender={item.senderId === user?.id}
        matchKey={matchKey || ''}
      />
    );
  }, [user?.id, matchKey]);

  // ... (Other render functions remain similar) ...

  return (
    <KeyboardAvoidingView
      style={styles.screenContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Custom Header with Match Name */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={AppStyles.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{route.params.matchName}</Text>
        <Ionicons name={isConnected ? 'lock-closed' : 'lock-open'} size={18} color={isConnected ? AppStyles.colors.green : AppStyles.colors.red} style={styles.statusIcon} />
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={allMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        inverted // Display newest messages at the bottom
        // ... (ListFooterComponent/HeaderComponent remain similar) ...
        style={{ transform: [{ scaleY: -1 }] }}
      />

      {/* Input Area (Advanced) */}
      <ChatInput matchId={matchId} otherUserId={otherUserId} matchKey={matchKey || ''} />

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: AppStyles.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, paddingTop: Platform.OS === 'ios' ? 50 : 10, backgroundColor: AppStyles.colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: AppStyles.colors.lightGray },
  backButton: { position: 'absolute', left: 10, top: Platform.OS === 'ios' ? 50 : 10, zIndex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: AppStyles.colors.text },
  statusIcon: { position: 'absolute', right: 10, top: Platform.OS === 'ios' ? 50 : 10, zIndex: 1 },
  messageList: { paddingHorizontal: 10, paddingVertical: 10 },
  // Message Bubbles
  bubble: { padding: 10, borderRadius: 15, maxWidth: '80%', marginBottom: 5, transform: [{ scaleY: -1 }] },
  senderContainer: { flexDirection: 'row', justifyContent: 'flex-end' },
  recipientContainer: { flexDirection: 'row', justifyContent: 'flex-start' },
  senderBubble: { backgroundColor: AppStyles.colors.primary },
  recipientBubble: { backgroundColor: AppStyles.colors.lightGray },
  senderText: { color: AppStyles.colors.white },
  recipientText: { color: AppStyles.colors.text },
  // Attachment/Status
  statusContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 3 },
  timestamp: { fontSize: 10, color: AppStyles.colors.gray, marginLeft: 5 },
  statusIcon: { marginLeft: 5 },
  // Input Area
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AppStyles.colors.lightGray, backgroundColor: AppStyles.colors.white },
  attachButton: { padding: 8, marginRight: 5, marginBottom: 5 },
  textInput: { flex: 1, maxHeight: 100, minHeight: 40, backgroundColor: AppStyles.colors.lightGray, borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, marginRight: 5 },
  sendButton: { width: 60, height: 40, marginBottom: 5 },
  typingIndicator: { transform: [{ scaleY: -1 }], paddingHorizontal: 10, paddingBottom: 5, fontSize: 12, color: AppStyles.colors.gray },
});

export default ChatScreen;