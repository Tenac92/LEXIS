import { QueryClient, QueryFunction } from "@tanstack/react-query";
import TokenManager from "./token-manager";

const tokenManager = TokenManager.getInstance();

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const token = await tokenManager.getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        tokenManager.clearToken();
        throw new Error("Unauthorized. Please log in.");
      }

      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error?.message || `HTTP error! status: ${res.status}`);
    }

    return res.json();
  } catch (error) {
    console.error(`[API] Request failed:`, error);
    throw error;
  }
}

export const getQueryFn = ({ on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}): QueryFunction => 
  async ({ queryKey }) => {
    try {
      const token = await tokenManager.getToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(queryKey[0] as string, { headers });

      if (res.status === 401) {
        if (on401 === "returnNull") {
          return null;
        }
        tokenManager.clearToken();
        throw new Error("Unauthorized. Please log in.");
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error?.message || `HTTP error! status: ${res.status}`);
      }

      return res.json();
    } catch (error) {
      console.error(`[Query] Request failed:`, error);
      if (error instanceof Error && error.message.includes("Unauthorized") && on401 === "returnNull") {
        return null;
      }
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