// backend/tests/jest.setup.ts

// Set necessary environment variables for JWT and Prisma mocks
process.env.JWT_SECRET = 'TEST_SECRET_KEY_FOR_JWT_V3RY_L0NG_AND_SECURE';
process.env.JWT_ALGORITHM = 'HS512';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.REDIS_HOST = 'localhost';
process.env.S3_BUCKET = 'test-s3-bucket';

// Mock the entire node-jsonwebtoken library to control token signing/verification
jest.mock('jsonwebtoken', () => {
    const actualJwt = jest.requireActual('jsonwebtoken');
    const mockPayload: jwtUtils.JwtPayload = {
        userId: 'user-test-1',
        email: 'test@example.com',
        fingerprintId: 'fp-mock-session',
        iat: Date.now() / 1000,
        exp: (Date.now() / 1000) + (15 * 60)
    };

    return {
        ...actualJwt,
        // Mock signJwt to always return the same token
        sign: jest.fn(() => 'mock-access-token-faase'),
        // Mock verify to return a controlled payload or throw
        verify: jest.fn((token: string) => {
            if (token === 'mock-expired-token') {
                throw new actualJwt.TokenExpiredError('Token expired.', new Date());
            }
            if (token === 'mock-invalid-token') {
                throw new actualJwt.JsonWebTokenError('Invalid signature.');
            }
            return mockPayload;
        }),
        decode: actualJwt.decode, // Use actual decode for non-sensitive operations
        TokenExpiredError: actualJwt.TokenExpiredError,
        JsonWebTokenError: actualJwt.JsonWebTokenError,
    };
});

// Mock the Redis client for all rate limiting/caching logic
jest.mock('../src/utils/redis', () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        incr: jest.fn().mockResolvedValue(1), // Default: always allow rate limit
        expire: jest.fn(),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn(),
    }
}));