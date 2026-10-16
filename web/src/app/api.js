const BASE = "/api/v1";
const KEY = "dr-session";

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
export function setSession(session) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage blocked: the session lasts until reload */
  }
}
export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Fetch wrapper: JSON in and out. A 401 clears the session and tells the app to go to /login. */
export async function api(method, path, body) {
  const session = getSession();
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Try again.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && session && path !== "/auth/login" && path !== "/auth/password") {
    clearSession();
    window.dispatchEvent(new Event("dr-unauthorized"));
    throw new Error(data?.error || "Your session expired. Log in again.");
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}
