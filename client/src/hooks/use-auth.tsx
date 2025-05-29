import { createContext, ReactNode, useContext, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface LoginCredentials {
  email: string;
  password: string;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: ReturnType<typeof useLoginMutation>;
  logoutMutation: ReturnType<typeof useLogoutMutation>;
  refreshUser: () => Promise<User | null>;
  logout: () => void;
};

function useLoginMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      try {
        console.log('Attempting login with:', credentials.email);

        const response = await fetch('/api/auth/login', {  
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          try {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
          } catch (parseError) {
            // If JSON parsing fails, use the status text
            console.error('Error parsing error response:', parseError);
            throw new Error(`Login failed: ${response.statusText}`);
          }
        }

        let data;
        try {
          data = await response.json();
          console.log('Login successful:', data);
        } catch (parseError) {
          console.error('Error parsing success response:', parseError);
          throw new Error('Login failed: Invalid response format');
        }
        
        // Check if the data includes a user object (new format) or if it's the user itself (old format)
        const userData = data.user || data;
        
        // Make sure we have all required fields in the expected format
        const user: User = {
          id: userData.id,
          name: userData.name || "Guest User",
          email: userData.email,
          role: userData.role,
          units: userData.units || []
        };
        
        return user;
      } catch (err) {
        console.error('Authentication error:', err);
        if (err instanceof Error) {
          throw new Error(`Login failed: ${err.message}`);
        }
        throw new Error('Login failed: Unknown error');
      }
    },
    onSuccess: (user) => {
      console.log('Login mutation succeeded, updating cache with user:', user);
      // Ensure the user object has all required fields for display
      const processedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        units: user.units || []
      };
      console.log('Processed user for cache:', processedUser);
      
      // Update the cache with the processed user
      queryClient.setQueryData(["/api/auth/me"], processedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${processedUser.name}!`,
      });
    },
    onError: (error: Error) => {
      console.error('Login mutation error:', error);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useLogoutMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Logout failed');
      }
    },
    onSuccess: () => {
      // Clear all cached data immediately
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
      
      // Use faster navigation instead of full page reload
      if (window.location.pathname !== '/auth') {
        window.location.replace('/auth');
      }
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, error, isLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        if (!response.ok) {
          if (response.status === 401) return null;
          throw new Error('Failed to fetch user data');
        }
        
        const responseData = await response.json();
        console.log('ME endpoint response:', responseData);
        
        // If not authenticated according to the response
        if (responseData && responseData.authenticated === false) {
          return null;
        }
        
        // Check if response is wrapped in an object with 'user' property (new format)
        // or if it's the direct user object (old format)
        const userData = responseData.user || responseData;
        
        // If we have a valid user object with required fields
        if (userData && userData.id) {
          // Ensure consistent format for user data
          const user: User = {
            id: userData.id,
            name: userData.name || "Guest User",
            email: userData.email,
            role: userData.role,
            units: userData.units || []
          };
          
          return user;
        }
        
        return null;
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: true, // Now will refresh when window gets focus
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes (300,000ms)
    staleTime: 60 * 1000, // Consider data stale after 1 minute
  });

  // Effect to refresh session when user interacts with the page
  useEffect(() => {
    let inactivityTimer: number | undefined;
    let lastActivity = Date.now();
    let sessionRefreshTimer: number | undefined;
    
    // Keep track of user activity
    const resetTimer = () => {
      // Update last activity timestamp
      lastActivity = Date.now();
      
      // Clear existing timeout
      clearTimeout(inactivityTimer);
      
      // Log activity for debugging (occasionally)
      if (Math.random() > 0.95) {
        console.log("[SessionKeeper] User active, refreshing session");
      }
      
      // Set a new timer for 5 minutes
      inactivityTimer = window.setTimeout(() => {
        // After 5 minutes of inactivity, check session
        refetch();
      }, 5 * 60 * 1000);
    };
    
    // Set up a regular session refresh interval (every 4 minutes)
    // This ensures the session stays active during form interactions
    const startSessionKeepAlive = () => {
      // Clear any existing timer
      clearTimeout(sessionRefreshTimer);
      
      // Set up periodic session refresh
      sessionRefreshTimer = window.setInterval(() => {
        // Only refresh if the user has been active in the last 10 minutes
        if (Date.now() - lastActivity < 10 * 60 * 1000) {
          fetch('/api/auth/me', { credentials: 'include' })
            .then(response => {
              if (response.ok) {
                // Session is valid, no further action needed
                return response.json();
              }
              return null;
            })
            .catch(error => {
              console.warn("[SessionKeeper] Session check error:", error);
            });
        }
      }, 4 * 60 * 1000); // Every 4 minutes
    };
    
    // Add event listeners for user activity
    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });
    
    // Initialize timers
    resetTimer();
    startSessionKeepAlive();
    
    // Cleanup
    return () => {
      clearTimeout(inactivityTimer);
      clearInterval(sessionRefreshTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [refetch]);

  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  
  // Function to manually refresh the user session with debouncing
  const refreshUser = async (): Promise<User | null> => {
    try {
      // Use a static variable to track last refresh time to prevent excessive refreshes
      const now = Date.now();
      if ((refreshUser as any).lastRefresh && now - (refreshUser as any).lastRefresh < 5000) {
        console.log('[Auth] Skipping refresh - too soon since last refresh');
        return user ?? null;
      }
      
      console.log('[Auth] Manually refreshing user session');
      (refreshUser as any).lastRefresh = now;
      
      const result = await refetch();
      return result.data ?? null;
    } catch (error) {
      console.error('[Auth] Error refreshing user session:', error);
      return null;
    }
  };
  
  // Shorthand for logout functionality
  const logout = () => {
    console.log('[Auth] Initiating logout');
    logoutMutation.mutate();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error: error instanceof Error ? error : null,
        loginMutation,
        logoutMutation,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}