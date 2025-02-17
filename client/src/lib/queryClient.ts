import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let errorMessage = `${res.status}: ${res.statusText}`;

    try {
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        errorMessage = data.message || errorMessage;
      } else {
        const text = await res.text();
        errorMessage = text || errorMessage;
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
    }

    if (res.status === 401) {
      localStorage.removeItem('authToken');
      throw new Error("Unauthorized. Please log in.");
    }

    throw new Error(errorMessage);
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  console.log(`[API] Making request to ${url}`, { method: options.method || 'GET' });

  const authToken = localStorage.getItem('authToken');
  const headers = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  await throwIfResNotOk(res);
  return res.json();
}

export const getQueryFn = ({ on401 }: { on401: "returnNull" | "throw" }): QueryFunction => 
  async ({ queryKey }) => {
    console.log(`[Query] Executing query for key:`, queryKey);

    try {
      const authToken = localStorage.getItem('authToken');
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

      const res = await fetch(queryKey[0] as string, { headers });

      if (on401 === "returnNull" && res.status === 401) {
        console.log(`[Query] Returning null for unauthorized request to ${queryKey[0]}`);
        return null;
      }

      await throwIfResNotOk(res);
      return res.json();
    } catch (error) {
      if (on401 === "returnNull" && error instanceof Error && error.message.includes("Unauthorized")) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});