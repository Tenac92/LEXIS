import { QueryClient, QueryFunction } from "@tanstack/react-query";

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const headers = new Headers({
      "Content-Type": "application/json",
      ...options.headers,
    });

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // Include cookies for session handling
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/auth'; // Redirect to auth page on 401
        throw new Error("Μη εξουσιοδοτημένη πρόσβαση. Παρακαλώ συνδεθείτε.");
      }

      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error?.message || `Σφάλμα HTTP! κατάσταση: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("[API] Το αίτημα απέτυχε:", error);
    throw error;
  }
}

export const getQueryFn = ({ on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}): QueryFunction => 
  async ({ queryKey }) => {
    try {
      const response = await fetch(queryKey[0] as string, { 
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          if (on401 === "returnNull") {
            return null;
          }
          window.location.href = '/auth'; // Redirect to auth page on 401
          throw new Error("Μη εξουσιοδοτημένη πρόσβαση. Παρακαλώ συνδεθείτε.");
        }

        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || `Σφάλμα HTTP! κατάσταση: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("[Query] Το αίτημα απέτυχε:", error);
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