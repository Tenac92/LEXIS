import { useEffect } from 'react';

/**
 * SessionInit Component
 * 
 * This component ensures that a unique session ID is generated and stored
 * in sessionStorage. The session ID is used to track the client and avoid
 * self-updates in real-time features.
 */
export default function SessionInit() {
  // Initialize client session ID on mount
  useEffect(() => {
    // Check if we already have a client session ID
    const existingSessionId = sessionStorage.getItem('clientSessionId');
    
    if (!existingSessionId) {
      // Generate a unique ID combining timestamp and random string
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 10);
      const sessionId = `session_${timestamp}_${randomPart}`;
      
      // Store the session ID
      sessionStorage.setItem('clientSessionId', sessionId);
      console.log('[SessionInit] Generated new client session ID:', sessionId);
    } else {
      console.log('[SessionInit] Using existing client session ID:', existingSessionId);
    }
  }, []);

  // This component doesn't render anything
  return null;
}