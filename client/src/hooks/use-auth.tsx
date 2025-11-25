import { createContext, ReactNode, useContext, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

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
        // Security: No sensitive logging in production

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
            const errorData = await response.json();
            throw new Error(errorData.message || 'Login failed');
          } catch (parseError) {
            // If JSON parsing fails, use the status text
            console.error('Error parsing error response:', parseError);
            throw new Error(`Authentication error: ${response.status} ${response.statusText}`);
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
          unit_id: userData.unit_id || []
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
      // Security: No sensitive logging in production
      // Ensure the user object has all required fields for display
      const processedUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        unit_id: user.unit_id || []
      };
      
      // Update the cache with the processed user
      queryClient.setQueryData(["/api/auth/me"], processedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      // BACKGROUND PREFETCH: Start prefetching beneficiary/employee AFM data in the background
      // This runs silently while user navigates, making autocomplete instant later
      fetch('/api/beneficiaries/prefetch', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          console.log('[Auth] Background AFM prefetch initiated:', data);
        })
        .catch(err => {
          // Silent failure - prefetch is optional optimization
          console.log('[Auth] Background prefetch failed (non-critical):', err);
        });
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${processedUser.name}!`,
      });
    },
    onError: (error: Error) => {
      console.error('Authentication error:', error);
      toast({
        title: "Login failed",
        description: error.message || "Authentication failed. Please try again.",
        variant: "destructive",
      });
    },
  });
}

function useLogoutMutation() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

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
      // Clear ALL cached queries to prevent stale data from previous user
      // This is critical for security and proper user experience when switching accounts
      queryClient.clear();
      
      // Use client-side navigation instead of full page reload
      navigate('/auth');
      
      // Show success message after navigation
      setTimeout(() => {
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
      }, 100);
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
            unit_id: userData.unit_id || []
          };
          
          return user;
        }
        
        return null;
      } catch (error) {
        console.error('Error fetching user:', error);
        // Ensure we always return null on error to prevent unhandled rejections
        return null;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  // Simplified session management for faster startup
  useEffect(() => {
    // Only for authenticated users, set up minimal session monitoring
    if (user) {
      let inactivityTimer: number | undefined;
      
      const checkSession = () => {
        // Only check if user is still active
        if (document.visibilityState === 'visible') {
          refetch();
        }
      };
      
      // Set up a single inactivity timer (15 minutes for less frequent checks)
      const resetTimer = () => {
        clearTimeout(inactivityTimer);
        inactivityTimer = window.setTimeout(checkSession, 15 * 60 * 1000);
      };
      
      // Listen for user activity (minimal event set for better performance)
      const activityEvents = ['click', 'keydown'];
      activityEvents.forEach(event => {
        window.addEventListener(event, resetTimer, { passive: true });
      });
      
      resetTimer();
      
      // Cleanup
      return () => {
        clearTimeout(inactivityTimer);
        activityEvents.forEach(event => {
          window.removeEventListener(event, resetTimer);
        });
      };
    }
  }, [user, refetch]);

  // BACKGROUND PREFETCH: Trigger prefetch when user is already logged in (page refresh/app load)
  useEffect(() => {
    if (user && !isLoading) {
      // Use a flag to prevent multiple prefetch calls
      const prefetchKey = `afm_prefetch_${user.id}`;
      const lastPrefetch = sessionStorage.getItem(prefetchKey);
      const now = Date.now();
      
      // Only prefetch if we haven't done it in the last 5 minutes
      if (!lastPrefetch || now - parseInt(lastPrefetch) > 5 * 60 * 1000) {
        sessionStorage.setItem(prefetchKey, now.toString());
        
        fetch('/api/beneficiaries/prefetch', { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            console.log('[Auth] Background AFM prefetch on app load:', data);
          })
          .catch(err => {
            console.log('[Auth] Background prefetch failed (non-critical):', err);
          });
      }
    }
  }, [user, isLoading]);

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