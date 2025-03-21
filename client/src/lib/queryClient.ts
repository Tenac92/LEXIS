import { QueryClient, QueryFunction } from "@tanstack/react-query";

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    console.log(`[DEBUG] Making API request to ${url}`);
    
    // Ensure URL starts with / but not // (avoiding protocol-relative URLs)
    let formattedUrl = url;
    if (!url.startsWith('/')) {
      formattedUrl = `/${url}`;
      console.log(`[DEBUG] Fixed URL path to: ${formattedUrl}`);
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      ...options.headers,
    });

    // Add request ID for tracking through logs
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    headers.set('X-Request-ID', requestId);

    console.log(`[DEBUG] Request options for ${requestId}:`, {
      method: options.method || 'GET',
      url: formattedUrl,
      headers: Object.fromEntries(headers.entries()),
      credentials: 'include',
      bodySize: options.body ? JSON.stringify(options.body).length : 0
    });

    const startTime = performance.now();
    const response = await fetch(formattedUrl, {
      ...options,
      headers,
      credentials: 'include' // Include cookies for session handling
    });
    const duration = Math.round(performance.now() - startTime);

    console.log(`[DEBUG] Response received for ${requestId} in ${duration}ms - status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 401) {
        console.error(`[DEBUG] Authentication error (401) for request ${requestId}`);
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
        
        console.error(`[DEBUG] Error response for ${requestId}:`, {
          status: response.status,
          message: errorMessage
        });
        
        throw new Error(errorMessage);
      } catch (responseError) {
        console.error(`[DEBUG] Failed to parse error response for ${requestId}:`, responseError);
        throw new Error(`Σφάλμα HTTP! κατάσταση: ${response.status}`);
      }
    }

    const data = await response.json();
    console.log(`[DEBUG] Successful response for ${requestId}:`, {
      status: response.status,
      dataSize: JSON.stringify(data).length
    });
    
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
      console.log(`[DEBUG] Making query to: ${url}`);
      
      // Ensure URL starts with / but not // (avoiding protocol-relative URLs)
      let formattedUrl = url;
      if (!url.startsWith('/')) {
        formattedUrl = `/${url}`;
        console.log(`[DEBUG] Fixed URL path to: ${formattedUrl}`);
      }
      
      // Add request ID for tracking through logs
      const requestId = `query-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const headers = new Headers({
        'X-Request-ID': requestId
      });
      
      console.log(`[DEBUG] Query request ${requestId} to ${formattedUrl}`);
      
      const startTime = performance.now();
      const response = await fetch(formattedUrl, { 
        credentials: 'include',
        headers
      });
      const duration = Math.round(performance.now() - startTime);
      
      console.log(`[DEBUG] Query response for ${requestId} in ${duration}ms with status: ${response.status}`);

      if (!response.ok) {
        if (response.status === 401) {
          console.error(`[DEBUG] Authentication error (401) for query ${requestId}`);
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
          
          console.error(`[DEBUG] Error response for query ${requestId}:`, {
            status: response.status,
            message: errorMessage
          });
          
          throw new Error(errorMessage);
        } catch (responseError) {
          console.error(`[DEBUG] Failed to parse error response for query ${requestId}:`, responseError);
          throw new Error(`Σφάλμα HTTP! κατάσταση: ${response.status}`);
        }
      }

      const data = await response.json();
      console.log(`[DEBUG] Successful query response for ${requestId}:`, {
        status: response.status,
        dataSize: JSON.stringify(data).length
      });
      
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