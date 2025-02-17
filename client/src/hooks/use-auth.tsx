import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: ReturnType<typeof useLoginMutation>;
  logoutMutation: ReturnType<typeof useLogoutMutation>;
  registerMutation: ReturnType<typeof useRegisterMutation>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = LoginData & {
  full_name: string;
};

// Auth response types
type AuthResponse = {
  user: User;
  token: string;
  error?: {
    message: string;
  };
};

function useLoginMutation() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log('[Auth] Attempting login:', credentials.email);
      const response = await apiRequest<AuthResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });

      if (response.error) {
        console.error('[Auth] Login error:', response.error);
        throw new Error(response.error.message);
      }

      console.log('[Auth] Login successful, storing token');
      localStorage.setItem('authToken', response.token);
      return response.user;
    },
    onSuccess: (user) => {
      console.log('[Auth] Updating user data in query cache');
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      console.error('[Auth] Login mutation error:', error);
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
      console.log('[Auth] Attempting logout');
      await apiRequest("/api/logout", {
        method: "POST",
      });
      console.log('[Auth] Removing auth token');
      localStorage.removeItem('authToken');
    },
    onSuccess: () => {
      console.log('[Auth] Clearing user data from query cache');
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      console.error('[Auth] Logout mutation error:', error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useRegisterMutation() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (userData: RegisterData) => {
      console.log('[Auth] Attempting registration:', userData.email);
      const response = await apiRequest<AuthResponse>("/api/register", {
        method: "POST",
        body: JSON.stringify(userData),
      });

      if (response.error) {
        console.error('[Auth] Registration error:', response.error);
        throw new Error(response.error.message);
      }

      console.log('[Auth] Registration successful, storing token');
      localStorage.setItem('authToken', response.token);
      return response.user;
    },
    onSuccess: (user) => {
      console.log('[Auth] Updating user data in query cache');
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      console.error('[Auth] Registration mutation error:', error);
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const registerMutation = useRegisterMutation();

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
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