const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `API error ${res.status}`);
  }
  return json.data as T;
}