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
          const error = await response.json();
          throw new Error(error.message || 'Login failed');
        }

        const data = await response.json();
        console.log('Login successful:', data);
        
        // Check if the data includes a user object (new format) or if it's the user itself (old format)
        const userData = data.user || data;
        
        // Make sure we have all required fields in the expected format
        const user: User = {
          id: userData.id,
          name: userData.name || "Guest User",
          email: userData.email,
          role: userData.role as 'admin' | 'user',
          units: userData.units || [],
          department: userData.department || undefined,
          telephone: userData.telephone || undefined
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
        units: user.units || [],
        department: user.department || undefined,
        telephone: user.telephone || undefined
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
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Force reload after successful logout to clear any cached state
      window.location.href = '/';
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
            role: userData.role as 'admin' | 'user',
            units: userData.units || [],
            department: userData.department || undefined,
            telephone: userData.telephone || undefined
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
    
    const resetTimer = () => {
      lastActivity = Date.now();
      clearTimeout(inactivityTimer);
      
      // If it's been more than 1 minute since last session check
      if (Date.now() - lastActivity > 60000) {
        refetch();
      }
      
      // Set a new timer for 5 minutes
      inactivityTimer = window.setTimeout(() => {
        // After 5 minutes of inactivity, check session
        refetch();
      }, 5 * 60 * 1000);
    };
    
    // Add event listeners for user activity
    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });
    
    // Set initial timer
    resetTimer();
    
    // Cleanup
    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [refetch]);

  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error: error instanceof Error ? error : null,
        loginMutation,
        logoutMutation,
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