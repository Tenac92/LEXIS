import { useEffect } from 'react';

/**
 * SessionInit Component
 * Responsible for initializing and managing client-side session identifiers 
 * that are used for real-time synchronization between multiple clients
 */
export const SessionInit = () => {
  useEffect(() => {
    // Generate and store a unique session ID if one doesn't exist
    if (!sessionStorage.getItem('clientSessionId')) {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem('clientSessionId', newSessionId);
      console.log(`[Session] Generated new client session ID: ${newSessionId}`);
    } else {
      console.log('[Session] Using existing client session ID');
    }

    return () => {
      // We don't clear the session ID on unmount, as it should persist for the browser session
    };
  }, []);

  // This is a utility component with no UI rendering
  return null;
};

export default SessionInit;