import { io, Socket } from 'socket.io-client';
import { WSMessage, CursorPosition } from '@/types';

let socket: Socket | null = null;

export const socketApi = {
  connect: (fileId: number, token: string) => {
    if (socket?.connected) {
      socket.disconnect();
    }

    socket = io('/', {
      path: '/ws/collab',
      query: { fileId: String(fileId), token },
      transports: ['websocket'],
    });

    return socket;
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  onMessage: (callback: (message: WSMessage) => void) => {
    if (socket) {
      socket.on('message', callback);
    }
  },

  sendCursorUpdate: (position: CursorPosition) => {
    if (socket?.connected) {
      socket.emit('message', { type: 'cursor_update', position });
    }
  },

  sendContentChange: (content: string, cursorPosition: CursorPosition) => {
    if (socket?.connected) {
      socket.emit('message', { type: 'content_change', content, cursor_position: cursorPosition });
    }
  },

  sendSave: (content: string) => {
    if (socket?.connected) {
      socket.emit('message', { type: 'save', content });
    }
  },
};
