import { QueryClient, QueryFunction } from "@tanstack/react-query";
import TokenManager from "./token-manager";

const tokenManager = TokenManager.getInstance();

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const token = await tokenManager.getToken();
    const headers = new Headers({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    });

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Include cookies for session handling
    });

    if (!response.ok) {
      if (response.status === 401) {
        tokenManager.clearToken();
        throw new Error("Unauthorized. Please log in.");
      }

      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("[API] Request failed:", error);
    throw error;
  }
}

export const getQueryFn = ({ on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}): QueryFunction => 
  async ({ queryKey }) => {
    try {
      const token = await tokenManager.getToken();
      const headers = new Headers({
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      });

      const response = await fetch(queryKey[0] as string, { 
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          if (on401 === "returnNull") {
            return null;
          }
          tokenManager.clearToken();
          throw new Error("Unauthorized. Please log in.");
        }

        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("[Query] Request failed:", error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});