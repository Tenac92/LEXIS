import { QueryClient, QueryFunction } from "@tanstack/react-query";
import TokenManager from "./token-manager";

const tokenManager = TokenManager.getInstance();

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  console.log(`[API] Making request to ${url}`, options);

  const token = await tokenManager.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorMessage = `${res.status}: ${res.statusText}`;

      try {
        if (contentType?.includes("application/json")) {
          const data = await res.json();
          errorMessage = data.error?.message || data.message || errorMessage;
        } else {
          const text = await res.text();
          errorMessage = text || errorMessage;
        }
      } catch (e) {
        console.error("[API] Error parsing error response:", e);
      }

      if (res.status === 401) {
        tokenManager.clearToken();
        throw new Error("Unauthorized. Please log in.");
      }

      throw new Error(errorMessage);
    }

    return res.json();
  } catch (error) {
    console.error(`[API] Request failed:`, error);
    throw error;
  }
}

export const getQueryFn = ({ on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}): QueryFunction => 
  async ({ queryKey }) => {
    console.log(`[Query] Executing query for key:`, queryKey);
    const token = await tokenManager.getToken();

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(queryKey[0] as string, { headers });

      if (res.status === 401) {
        if (on401 === "returnNull") {
          console.log(`[Query] Returning null for unauthorized request to ${queryKey[0]}`);
          return null;
        }
        tokenManager.clearToken();
        throw new Error("Unauthorized. Please log in.");
      }

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let errorMessage = `${res.status}: ${res.statusText}`;

        try {
          if (contentType?.includes("application/json")) {
            const data = await res.json();
            errorMessage = data.error?.message || data.message || errorMessage;
          } else {
            const text = await res.text();
            errorMessage = text || errorMessage;
          }
        } catch (e) {
          console.error("[Query] Error parsing error response:", e);
        }

        throw new Error(errorMessage);
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