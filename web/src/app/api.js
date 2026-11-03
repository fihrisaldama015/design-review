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
  forgetTemporaryPassword();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

// The password a new account typed to log in with. It stays in memory only (never in storage, gone on reload), so the
// forced "choose your own password" page does not ask for what the person has just typed.
let temporaryPassword = null;
export const rememberTemporaryPassword = (password) => { temporaryPassword = password || null; };
export const getTemporaryPassword = () => temporaryPassword;
export const forgetTemporaryPassword = () => { temporaryPassword = null; };

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
    throw Object.assign(new Error(data?.error || "Your session expired. Log in again."), { status: 401 });
  }
  if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status}).`), { status: res.status });
  return data;
}
