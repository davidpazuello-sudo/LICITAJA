const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface ApiRequestOptions extends RequestInit {
  method?: ApiMethod;
  query?: Record<string, string | number | undefined | null>;
}

function buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { query, headers, method = "GET", ...rest } = options;
  const hasFormDataBody = typeof FormData !== "undefined" && rest.body instanceof FormData;
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      ...(hasFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? {}),
    },
    ...rest,
  });

  if (!response.ok) {
    let detail = "Nao foi possivel concluir a requisicao.";

    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Keep the generic fallback when the backend does not return JSON.
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/health");
}

export { API_BASE_URL };
