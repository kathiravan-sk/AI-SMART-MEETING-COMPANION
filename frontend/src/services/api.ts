import type { Session } from "../../../shared/types";
export const API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_URL || "http://localhost:8000";
export function session(): Session | null {
  try {
    return JSON.parse(localStorage.getItem("meetmind-session") || "null");
  } catch {
    return null;
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000);
  try {
    const response = await fetch(API + path, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(session() ? { Authorization: `Bearer ${session()!.token}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 401 && !path.startsWith("/auth/"))
        window.dispatchEvent(new Event("session-expired"));
      throw new Error(
        typeof body.detail === "string"
          ? body.detail
          : response.status === 422
            ? "Please check the fields and try again."
            : `Request failed (${response.status})`,
      );
    }
    return response.json();
  } catch (e) {
    if (e instanceof TypeError)
      throw new Error(
        "Cannot reach the backend. Start the FastAPI server on port 8000.",
      );
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export async function download(id: string) {
  const r = await fetch(API + `/meetings/${id}/export`, {
    headers: { Authorization: `Bearer ${session()!.token}` },
  });
  if (!r.ok) throw new Error("Export failed");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "meetmind-meeting.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
