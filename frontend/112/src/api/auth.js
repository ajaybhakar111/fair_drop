import { request, getStoredUser, storeUser, clearStoredUser } from "./http";

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export const getUser = getStoredUser;
export const clearUser = clearStoredUser;

// POST /auth/login   (sets the HTTP-only cookie)
export async function loginRequest({ email, password }) {
  const res = await request("/auth/login", { method: "POST", body: { email: email.trim(), password } });
  const user = publicUser(res.data.user);
  storeUser(user);
  return { ...res, data: { user } };
}

// POST /auth/register   (also logs the new user in)
export async function registerRequest({ name, email, password }) {
  const res = await request("/auth/register", {
    method: "POST",
    body: { name: name.trim(), email: email.trim(), password },
  });
  const user = publicUser(res.data.user);
  storeUser(user);
  return { ...res, data: { user } };
}

// POST /auth/logout
export async function logoutRequest() {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    /* even if the call fails, forget the user locally */
  }
  clearStoredUser();
}

// GET /auth/me   (asks the server whether the cookie is still valid)
export async function fetchMe() {
  const res = await request("/auth/me");
  const user = publicUser(res.data.user);
  storeUser(user);
  return user;
}
