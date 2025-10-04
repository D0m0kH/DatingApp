// backend/jest.config.js

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/', '<rootDir>/tests/'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Advanced: Setup script to ensure env vars are loaded for JWT/Prisma mocks
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'], 
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/index.ts',
    '!src/utils/prisma.ts',
    '!src/utils/redis.ts',
    '!src/jobs/worker.ts', // Exclude worker entry point
  ],
  coverageDirectory: 'coverage',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
};