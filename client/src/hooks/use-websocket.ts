import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

// Deprecated: Use use-websocket-updates.ts instead
// This file is kept for reference only and should be removed in future
export function useWebSocket() {
  console.warn('[Deprecated] useWebSocket hook is deprecated. Use useWebSocketUpdates instead.');
  return null;
}