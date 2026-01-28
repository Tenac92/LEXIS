import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { BudgetUpdate } from '@/lib/types';
import { useStableWebSocket } from '@/hooks/use-stable-websocket';

export interface BudgetUpdateMessage extends BudgetUpdate {}

// Re-export the stable WebSocket implementation to maintain compatibility
export function useWebSocketUpdates() {
  const { isConnected, connectionState, lastMessage, reconnect, disconnect } = useStableWebSocket();
  
  return {
    isConnected,
    lastMessage,
    connect: reconnect,
    disconnect,
    reconnect
  };
}