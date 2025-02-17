import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getAuthToken() {
  return localStorage.getItem('authToken');
}

function clearAuthToken() {
  localStorage.removeItem('authToken');
  // Redirect to auth page if we're not already there
  if (!window.location.pathname.includes('/auth')) {
    window.location.href = '/auth';
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let errorMessage = `${res.status}: ${res.statusText}`;

    try {
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        errorMessage = data.error?.message || data.message || errorMessage;
      } else {
        const text = await res.text();
        errorMessage = text || errorMessage;
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
    }

    if (res.status === 401) {
      clearAuthToken();
      throw new Error("Unauthorized. Please log in.");
    }

    throw new Error(errorMessage);
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  console.log(`[API] Making request to ${url}`, options);

  const token = getAuthToken();
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

    await throwIfResNotOk(res);
    return res.json();
  } catch (error) {
    console.error(`[API] Request failed:`, error);
    throw error;
  }
}

export const getQueryFn = ({ on401 = "throw" }: { on401?: "returnNull" | "throw" } = {}): QueryFunction => 
  async ({ queryKey }) => {
    console.log(`[Query] Executing query for key:`, queryKey);
    const token = getAuthToken();

    try {
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(queryKey[0] as string, { headers });

      if (res.status === 401) {
        if (on401 === "returnNull") {
          console.log(`[Query] Returning null for unauthorized request to ${queryKey[0]}`);
          return null;
        }
        clearAuthToken();
        throw new Error("Unauthorized. Please log in.");
      }

      await throwIfResNotOk(res);
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