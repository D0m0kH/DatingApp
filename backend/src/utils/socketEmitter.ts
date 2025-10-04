// backend/src/utils/socketEmitter.ts

// Re-export io from index for use in controllers
// This avoids circular dependencies
let socketIo: any = null;

export function setSocketIo(io: any) {
  socketIo = io;
}

export function getSocketIo() {
  if (!socketIo) {
    // Lazy load to avoid circular dependency
    const { io } = require('../index');
    socketIo = io;
  }
  return socketIo;
}

// For backwards compatibility, export as both named and default
export const io = new Proxy({} as any, {
  get(_target, prop) {
    return getSocketIo()[prop];
  }
});

export default io;
