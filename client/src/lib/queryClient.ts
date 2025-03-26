import { QueryClient, QueryFunction } from "@tanstack/react-query";

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // Ensure URL starts with / but not // (avoiding protocol-relative URLs)
    let formattedUrl = url;
    if (!url.startsWith('/')) {
      formattedUrl = `/${url}`;
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      ...options.headers,
    });

    // Add request ID for tracking through logs
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    headers.set('X-Request-ID', requestId);

    const response = await fetch(formattedUrl, {
      ...options,
      headers,
      credentials: 'include' // Include cookies for session handling
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/auth'; // Redirect to auth page on 401
        throw new Error("Μη εξουσιοδοτημένη πρόσβαση. Παρακαλώ συνδεθείτε.");
      }

      try {
        const errorText = await response.text();
        let errorMessage: string;
        
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error?.message || 
                        `Σφάλμα HTTP! κατάσταση: ${response.status}`;
        } catch (parseError) {
          // If not valid JSON, use the raw text
          errorMessage = errorText || `Σφάλμα HTTP! κατάσταση: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      } catch (responseError) {
        throw new Error(`Σφάλμα HTTP! κατάσταση: ${response.status}`);
      }
    }

    // Special handling for DELETE requests that might return empty responses
    if (options.method === 'DELETE') {
      try {
        // Try to parse JSON, but if it fails, return empty object
        const data = await response.json();
        return data;
      } catch (jsonError) {
        console.log("[API] DELETE request returned non-JSON response, returning empty object");
        return {} as T;
      }
    }
    
    // Regular JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[API] Request failed:", error);
    throw error;
  }
}

export const getQueryFn = ({ on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}): QueryFunction => 
  async ({ queryKey }) => {
    try {
      const url = queryKey[0] as string;
      
      // Ensure URL starts with / but not // (avoiding protocol-relative URLs)
      let formattedUrl = url;
      if (!url.startsWith('/')) {
        formattedUrl = `/${url}`;
      }
      
      // Add request ID for tracking through logs
      const requestId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const headers = new Headers({
        'X-Request-ID': requestId
      });
      
      const response = await fetch(formattedUrl, { 
        credentials: 'include',
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          if (on401 === "returnNull") {
            return null;
          }
          window.location.href = '/auth'; // Redirect to auth page on 401
          throw new Error("Μη εξουσιοδοτημένη πρόσβαση. Παρακαλώ συνδεθείτε.");
        }

        try {
          const errorText = await response.text();
          let errorMessage: string;
          
          try {
            // Try to parse as JSON
            const errorData = JSON.parse(errorText);
            errorMessage = errorData?.message || errorData?.error?.message || 
                          `Σφάλμα HTTP! κατάσταση: ${response.status}`;
          } catch (parseError) {
            // If not valid JSON, use the raw text
            errorMessage = errorText || `Σφάλμα HTTP! κατάσταση: ${response.status}`;
          }
          
          throw new Error(errorMessage);
        } catch (responseError) {
          throw new Error(`Σφάλμα HTTP! κατάσταση: ${response.status}`);
        }
      }

      const data = await response.json();
      return data;
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