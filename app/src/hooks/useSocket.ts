// app/src/hooks/useSocket.ts

import { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './useAuth';

import { Message, Match } from '../types/shared';

const SOCKET_URL = Constants.expoConfig?.extra?.API_URL;
if (!SOCKET_URL) { console.error('SOCKET_URL is not configured in Expo constants.'); }

// --- Type Definitions ---
interface MessageSendPayload {
  matchId: string;
  text?: string; // Encrypted text
  attachments?: string[];
  nlpIntent?: string; // Client-side analysis of user's intent before encryption (for server filtering)
}

interface TypingPayload {
  matchId: string;
  userId: string;
}

interface MatchFoundPayload {
  matchId: string;
  otherUserName: string; 
  coreScore: number;
}

interface KeyUpdatePayload {
    matchId: string;
    senderId: string;
    publicKey: string;
}

// --- Hook Implementation ---
export const useSocket = (userId: string | null) => {
  const { logout } = useAuth(); // Use logout for critical failure
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // --- Connection Logic (FASE-Aware) ---
  useEffect(() => {
    if (!userId || !SOCKET_URL) {
      if (socket) socket.close();
      return;
    }

    const connect = async () => {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const fingerprintId = await SecureStore.getItemAsync('fingerprintId'); // FASE ID

      if (!accessToken || !fingerprintId) return;

      const newSocket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: {
          token: accessToken,
          fingerprintId: fingerprintId, // Send FASE ID for server middleware check
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // --- Event Listeners ---
      newSocket.on('connect', () => {
        setIsConnected(true);
        console.log('Socket Connected');
        // Advanced: Send granular location/accuracy on connect
        newSocket.emit('presence:set', { lat: 0, lng: 0, accuracyMeters: 100 });
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log('Socket Disconnected:', reason);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket Connection Error:', err.message);
        // Advanced: If 401 or FASE error, force logout
        if (err.message.includes('Authentication failed') || err.message.includes('SESSION_INVALID')) {
            console.error("Socket Auth Failed, forcing app logout.");
            newSocket.close();
            logout(); // Critical failure
        }
      });

      setSocket(newSocket);
    };

    connect();

    // --- Cleanup ---
    return () => {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    };
  }, [userId, logout]);


  // --- Event Emitters ---

  /**
   * @description Sends a chat message (text must be E2E encrypted before calling).
   */
  const sendMessage = useCallback((matchId: string, encryptedText: string, attachments: string[] = [], nlpIntent?: string) => {
    if (!socket || !isConnected) return;

    const payload: MessageSendPayload = { matchId, text: encryptedText, attachments, nlpIntent };

    // Send with an acknowledgement callback for optimistic UI update
    socket.emit('message:send', payload, (error, message) => {
      if (error) {
        console.error('Message failed to send (ACK):', error);
      } else {
        console.log('Message sent successfully:', message?.id);
      }
    });
  }, [socket, isConnected]);

  // Typing/Stop Typing remain the same

  // --- Advanced Event Listeners (API for component use) ---

  const onMessage = useCallback((callback: (message: Message) => void) => {
    if (!socket) return () => {};
    socket.on('message:new', callback);
    return () => { socket.off('message:new', callback); };
  }, [socket]);

  const onTyping = useCallback((callback: (payload: TypingPayload & { event: 'typing:start' | 'typing:stop' }) => void) => {
    if (!socket) return () => {};
    // ... (logic remains similar)
    const startHandler = (p: TypingPayload) => callback({ ...p, event: 'typing:start' });
    const stopHandler = (p: TypingPayload) => callback({ ...p, event: 'typing:stop' });
    socket.on('typing:start', startHandler);
    socket.on('typing:stop', stopHandler);
    return () => {
        socket.off('typing:start', startHandler);
        socket.off('typing:stop', stopHandler);
    };
  }, [socket]);

  const onMatchFound = useCallback((callback: (payload: MatchFoundPayload) => void) => {
    if (!socket) return () => {};
    socket.on('matchFound', callback);
    return () => { socket.off('matchFound', callback); };
  }, [socket]);
  
  /**
   * @description Advanced: Sets up a listener for E2E key updates from the other party.
   */
  const onKeyUpdate = useCallback((callback: (payload: KeyUpdatePayload) => void) => {
    if (!socket) return () => {};
    socket.on('e2e:key:update', callback);
    return () => { socket.off('e2e:key:update', callback); };
  }, [socket]);


  return {
    isConnected,
    socket,
    sendMessage,
    startTyping: (matchId: string) => socket?.emit('typing:start', { matchId }),
    stopTyping: (matchId: string) => socket?.emit('typing:stop', { matchId }),
    onMessage,
    onTyping,
    onMatchFound,
    onKeyUpdate, // New E2E listener
  };
};