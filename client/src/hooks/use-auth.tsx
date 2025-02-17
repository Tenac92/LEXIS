import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  full_name?: string;
  unit?: string;
};

type AuthResponse = {
  user: User;
  token: string;
};

function useLoginMutation() {
  const { toast } = useToast();

  return useMutation<User, Error, LoginData>({
    mutationFn: async (credentials) => {
      console.log('[Auth] Attempting login with:', credentials.email);

      const response = await apiRequest<AuthResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: credentials.email,
          password: credentials.password
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response?.token) {
        throw new Error('Login failed: Invalid response from server');
      }

      // Store token in localStorage
      localStorage.setItem('auth_token', response.token);
      console.log('[Auth] Login successful');

      return response.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error) => {
      console.error('[Auth] Login error:', error);
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

  return useMutation<void, Error>({
    mutationFn: async () => {
      await apiRequest("/api/logout", { method: "POST" });
      localStorage.removeItem('auth_token');
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error) => {
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

  return useMutation<User, Error, RegisterData>({
    mutationFn: async (userData) => {
      const response = await apiRequest<AuthResponse>("/api/register", {
        method: "POST",
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name,
          unit: userData.unit
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.token) {
        localStorage.setItem('auth_token', response.token);
      }

      return response.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error) => {
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
  const { data: user, error, isLoading } = useQuery<User | null>({
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
        error: error instanceof Error ? error : null,
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