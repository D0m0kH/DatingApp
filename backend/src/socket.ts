// backend/src/socket.ts
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { verifyToken } from './utils/jwt';
import prisma from './lib/prisma';
import redis from './lib';

// ============================================================================
// Type Definitions
// ============================================================================

interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
}

interface MessageSendPayload {
  matchId: string;
  content: string;
  contentType?: 'text' | 'image' | 'gif';
}

interface MessageNewPayload {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  contentType: 'text' | 'image' | 'gif';
  createdAt: string;
  read: boolean;
}

interface TypingPayload {
  matchId: string;
}

interface PresencePayload {
  status: 'online' | 'offline' | 'away';
}

interface PresenceBroadcast {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: string;
}

interface MatchActionPayload {
  matchId: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

const PRESENCE_EXPIRY = 300; // 5 minutes in seconds
const MESSAGE_RATE_LIMIT = 5; // Max messages per second per socket
const MESSAGE_RATE_WINDOW = 1000; // 1 second in milliseconds

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Simple in-memory rate limiter for messages
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  /**
   * Check if a request should be allowed
   * @param key - Identifier (e.g., socket ID)
   * @param limit - Maximum requests allowed
   * @param window - Time window in milliseconds
   * @returns true if allowed, false if rate limit exceeded
   */
  check(key: string, limit: number, window: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter((time) => now - time < window);

    if (validRequests.length >= limit) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  /**
   * Clear rate limit data for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }
}

const messageRateLimiter = new RateLimiter();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify if a user is part of a match
 */
async function verifyMatchMembership(
  userId: string,
  matchId: string
): Promise<boolean> {
  try {
    const matchRecord = await prisma.match.findFirst({
      where: {
        id: matchId,
        OR: [{ userId1: userId }, { userId2: userId }],
        status: 'MATCHED',
      },
    });

    return !!matchRecord;
  } catch (error) {
    console.error('Error verifying match membership:', error);
    return false;
  }
}

/**
 * Get all match IDs for a user
 */
async function getUserMatches(userId: string): Promise<string[]> {
  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userId1: userId }, { userId2: userId }],
        status: 'MATCHED',
      },
      select: { id: true },
    });

    return matches.map((m) => m.id);
  } catch (error) {
    console.error('Error fetching user matches:', error);
    return [];
  }
}

/**
 * Set user presence in Redis
 */
async function setPresence(
  userId: string,
  status: 'online' | 'offline' | 'away'
): Promise<void> {
  try {
    const key = `presence:${userId}`;
    const data = JSON.stringify({
      status,
      lastSeen: new Date().toISOString(),
    });

    await redis.setex(key, PRESENCE_EXPIRY, data);
  } catch (error) {
    console.error('Error setting presence:', error);
  }
}

/**
 * Get user presence from Redis
 */
async function getPresence(userId: string): Promise<PresenceBroadcast | null> {
  try {
    const key = `presence:${userId}`;
    const data = await redis.get(key);

    if (!data) {
      return {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      };
    }

    const parsed = JSON.parse(data);
    return {
      userId,
      ...parsed,
    };
  } catch (error) {
    console.error('Error getting presence:', error);
    return null;
  }
}

/**
 * Broadcast presence to user's matches
 */
async function broadcastPresence(
  io: SocketIOServer,
  userId: string,
  matchIds: string[]
): Promise<void> {
  try {
    const presence = await getPresence(userId);
    if (!presence) return;

    // Emit to all match rooms
    matchIds.forEach((matchId) => {
      io.to(`match:${matchId}`).emit('presence:update', presence);
    });
  } catch (error) {
    console.error('Error broadcasting presence:', error);
  }
}

// ============================================================================
// Socket.IO Server Initialization
// ============================================================================

/**
 * Initializes Socket.IO server with the HTTP server
 * @param httpServer - HTTP server instance
 * @returns Socket.IO server instance
 */
export function initSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: CORS_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ============================================================================
  // Authentication Middleware
  // ============================================================================

  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = await verifyToken(token);

      if (!decoded || !decoded.id) {
        return next(new Error('Invalid authentication token'));
      }

      // Attach user info to socket
      (socket as AuthenticatedSocket).userId = decoded.id;
      (socket as AuthenticatedSocket).userEmail = decoded.email;

      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // ============================================================================
  // Connection Handler
  // ============================================================================

  io.on('connection', async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    console.log(`✓ Socket connected: ${socket.id} (User: ${userId})`);

    try {
      // Join user's personal room
      socket.join(`user:${userId}`);
      console.log(`  └─ Joined room: user:${userId}`);

      // Get and join all active match rooms
      const matchIds = await getUserMatches(userId);
      matchIds.forEach((matchId) => {
        socket.join(`match:${matchId}`);
        console.log(`  └─ Joined room: match:${matchId}`);
      });

      // Set user as online in Redis
      await setPresence(userId, 'online');

      // Broadcast online status to matches
      await broadcastPresence(io, userId, matchIds);
    } catch (error) {
      console.error('Error during socket connection setup:', error);
    }

    // ============================================================================
    // Event: message:send
    // ============================================================================

    socket.on('message:send', async (payload: MessageSendPayload, callback) => {
      try {
        // Rate limiting
        if (!messageRateLimiter.check(socket.id, MESSAGE_RATE_LIMIT, MESSAGE_RATE_WINDOW)) {
          return callback?.({
            success: false,
            error: 'Rate limit exceeded. Please slow down.',
          });
        }

        const { matchId, content, contentType = 'text' } = payload;

        // Validate payload
        if (!matchId || !content || content.trim().length === 0) {
          return callback?.({
            success: false,
            error: 'Invalid message payload',
          });
        }

        if (content.length > 5000) {
          return callback?.({
            success: false,
            error: 'Message too long (max 5000 characters)',
          });
        }

        // Verify user is part of the match
        const isMember = await verifyMatchMembership(userId, matchId);
        if (!isMember) {
          return callback?.({
            success: false,
            error: 'Unauthorized: You are not part of this match',
          });
        }

        // Store message in database
        const newMessage = await prisma.message.create({
          data: {
            matchId,
            senderId: userId,
            content: content.trim(),
            contentType,
            read: false,
          },
        });

        // Prepare message payload
        const messagePayload: MessageNewPayload = {
          id: newMessage.id,
          matchId: newMessage.matchId,
          senderId: newMessage.senderId,
          content: newMessage.content,
          contentType: newMessage.contentType as 'text' | 'image' | 'gif',
          createdAt: newMessage.createdAt.toISOString(),
          read: newMessage.read,
        };

        // Emit to match room (including sender)
        io.to(`match:${matchId}`).emit('message:new', messagePayload);

        // Send success callback
        callback?.({
          success: true,
          message: messagePayload,
        });

        console.log(`  └─ Message sent: ${newMessage.id} in match ${matchId}`);
      } catch (error) {
        console.error('Error sending message:', error);
        callback?.({
          success: false,
          error: 'Failed to send message',
        });
      }
    });

    // ============================================================================
    // Event: typing:start
    // ============================================================================

    socket.on('typing:start', async (payload: TypingPayload) => {
      try {
        const { matchId } = payload;

        if (!matchId) return;

        // Verify match membership
        const isMember = await verifyMatchMembership(userId, matchId);
        if (!isMember) return;

        // Broadcast to match room (excluding sender)
        socket.to(`match:${matchId}`).emit('typing:start', {
          userId,
          matchId,
        });
      } catch (error) {
        console.error('Error handling typing:start:', error);
      }
    });

    // ============================================================================
    // Event: typing:stop
    // ============================================================================

    socket.on('typing:stop', async (payload: TypingPayload) => {
      try {
        const { matchId } = payload;

        if (!matchId) return;

        // Verify match membership
        const isMember = await verifyMatchMembership(userId, matchId);
        if (!isMember) return;

        // Broadcast to match room (excluding sender)
        socket.to(`match:${matchId}`).emit('typing:stop', {
          userId,
          matchId,
        });
      } catch (error) {
        console.error('Error handling typing:stop:', error);
      }
    });

    // ============================================================================
    // Event: presence:set
    // ============================================================================

    socket.on('presence:set', async (payload: PresencePayload) => {
      try {
        const { status } = payload;

        if (!['online', 'offline', 'away'].includes(status)) {
          return;
        }

        // Update presence in Redis
        await setPresence(userId, status);

        // Get user's matches and broadcast
        const matchIds = await getUserMatches(userId);
        await broadcastPresence(io, userId, matchIds);

        console.log(`  └─ Presence updated: ${userId} is ${status}`);
      } catch (error) {
        console.error('Error handling presence:set:', error);
      }
    });

    // ============================================================================
    // Event: match:accept (Future feature)
    // ============================================================================

    socket.on('match:accept', async (payload: MatchActionPayload, callback) => {
      try {
        const { matchId } = payload;

        if (!matchId) {
          return callback?.({
            success: false,
            error: 'Match ID required',
          });
        }

        // Verify user is part of the match
        const isMember = await verifyMatchMembership(userId, matchId);
        if (!isMember) {
          return callback?.({
            success: false,
            error: 'Unauthorized: You are not part of this match',
          });
        }

        // TODO: Implement match acceptance logic
        // For now, just acknowledge
        callback?.({
          success: true,
          message: 'Match acceptance feature coming soon',
        });

        console.log(`  └─ Match accepted: ${matchId} by ${userId}`);
      } catch (error) {
        console.error('Error handling match:accept:', error);
        callback?.({
          success: false,
          error: 'Failed to accept match',
        });
      }
    });

    // ============================================================================
    // Event: match:decline (Future feature)
    // ============================================================================

    socket.on('match:decline', async (payload: MatchActionPayload, callback) => {
      try {
        const { matchId } = payload;

        if (!matchId) {
          return callback?.({
            success: false,
            error: 'Match ID required',
          });
        }

        // Verify user is part of the match
        const isMember = await verifyMatchMembership(userId, matchId);
        if (!isMember) {
          return callback?.({
            success: false,
            error: 'Unauthorized: You are not part of this match',
          });
        }

        // TODO: Implement match decline logic
        // For now, just acknowledge
        callback?.({
          success: true,
          message: 'Match decline feature coming soon',
        });

        console.log(`  └─ Match declined: ${matchId} by ${userId}`);
      } catch (error) {
        console.error('Error handling match:decline:', error);
        callback?.({
          success: false,
          error: 'Failed to decline match',
        });
      }
    });

    // ============================================================================
    // Event: disconnect
    // ============================================================================

    socket.on('disconnect', async (reason: string) => {
      console.log(`✗ Socket disconnected: ${socket.id} (User: ${userId}, Reason: ${reason})`);

      try {
        // Set user as offline
        await setPresence(userId, 'offline');

        // Clear rate limiter
        messageRateLimiter.clear(socket.id);

        // Get user's matches and broadcast offline status
        const matchIds = await getUserMatches(userId);
        await broadcastPresence(io, userId, matchIds);
      } catch (error) {
        console.error('Error during socket disconnect cleanup:', error);
      }
    });

    // ============================================================================
    // Event: error
    // ============================================================================

    socket.on('error', (error: Error) => {
      console.error(`❌ Socket error (${socket.id}, User: ${userId}):`, error);
    });
  });

  console.log('✓ Socket.IO server initialized');
  return io;
}

// ============================================================================
// Socket.IO Server Shutdown
// ============================================================================

/**
 * Gracefully closes all Socket.IO connections
 * @param io - Socket.IO server instance
 */
export async function closeSocket(
  io: SocketIOServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
): Promise<void> {
  return new Promise((resolve) => {
    // Disconnect all clients
    io.disconnectSockets(true);

    // Close the server
    io.close(() => {
      console.log('✓ All Socket.IO connections closed');
      resolve();
    });
  });
}

// ============================================================================
// Helper Functions for External Use
// ============================================================================

/**
 * Emit event to a specific user
 * @param io - Socket.IO server instance
 * @param userId - User ID to emit to
 * @param event - Event name
 * @param data - Event data
 */
export function emitToUser(
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
): void {
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit event to a match room
 * @param io - Socket.IO server instance
 * @param matchId - Match ID to emit to
 * @param event - Event name
 * @param data - Event data
 */
export function emitToMatch(
  io: SocketIOServer,
  matchId: string,
  event: string,
  data: any
): void {
  io.to(`match:${matchId}`).emit(event, data);
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  AuthenticatedSocket,
  MessageSendPayload,
  MessageNewPayload,
  TypingPayload,
  PresencePayload,
  PresenceBroadcast,
  MatchActionPayload,
};