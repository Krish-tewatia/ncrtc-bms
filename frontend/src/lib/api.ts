export const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

export type Me = { id:number; username:string; full_name:string; role:string; depot_id:number|null };

export function getToken() { return localStorage.getItem("token") || ""; }
export function getMe(): Me|null { const s = localStorage.getItem("me"); return s? JSON.parse(s):null; }
export function setSession(token:string, me:Me) {
  localStorage.setItem("token", token); localStorage.setItem("me", JSON.stringify(me));
}
export function clearSession(){ localStorage.removeItem("token"); localStorage.removeItem("me"); }

export async function api<T=any>(path:string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string,string> = { "Content-Type": "application/json", ...(init.headers as any) };
  const tok = getToken(); if (tok) headers["Authorization"] = `Bearer ${tok}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (res.status === 401) { clearSession(); window.location.href = "/login"; throw new Error("Unauthorized"); }
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  if (res.status === 204) return undefined as any;
  return res.json();
}

export async function login(username:string, password:string) {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${API}/api/auth/login`, { method:"POST", body });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  const me = await fetch(`${API}/api/auth/me`, { headers:{ Authorization:`Bearer ${data.access_token}` }}).then(r=>r.json());
  setSession(data.access_token, me);
  return me as Me;
}
