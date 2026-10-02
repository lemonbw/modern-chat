import axios from "axios";

export type AppSessionStatus = {
  authenticated: boolean;
  writesEnabled: boolean;
  writeGranted: boolean;
};

type AuthResponse = Partial<AppSessionStatus> & { ok?: boolean; error?: string };

/** The gate lives on the same origin, so the session cookie travels with every request. */
const gateClient = axios.create({ withCredentials: true });

const message = (error: unknown, fallback: string) => (axios.isAxiosError(error) ? error.response?.data?.error || error.message || fallback : fallback);

export const sessionError = (error: unknown, fallback: string) => message(error, fallback);

export const fetchAppSession = async (): Promise<AppSessionStatus> => {
  try {
    const { data } = await gateClient.get<AuthResponse>("/api/auth");
    return { authenticated: data.authenticated === true, writesEnabled: data.writesEnabled !== false, writeGranted: data.writeGranted === true };
  } catch {
    return { authenticated: false, writesEnabled: true, writeGranted: false };
  }
};

export const signInToApp = async (password: string): Promise<AppSessionStatus> => {
  const { data } = await gateClient.post<AuthResponse>("/api/auth", { password });
  return { authenticated: data.authenticated !== false, writesEnabled: data.writesEnabled !== false, writeGranted: data.writeGranted === true };
};

export const requestWriteGrant = async (password: string): Promise<AppSessionStatus> => {
  const { data } = await gateClient.post<AuthResponse>("/api/auth", { password, scope: "write" });
  return { authenticated: data.authenticated !== false, writesEnabled: data.writesEnabled !== false, writeGranted: data.writeGranted === true };
};

export const signOutOfApp = async (): Promise<AppSessionStatus> => {
  const { data } = await gateClient.delete<AuthResponse>("/api/auth");
  return { authenticated: data.authenticated === true, writesEnabled: data.writesEnabled !== false, writeGranted: data.writeGranted === true };
};