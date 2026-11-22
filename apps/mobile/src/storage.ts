import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "whoosh_mobile_token";
const GUEST_KEY = "whoosh_mobile_guest_id";
const BASE_KEY = "whoosh_mobile_api_base";
const LANGUAGE_KEY = "whoosh_mobile_language";

export async function readToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function writeToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function readApiBase(): Promise<string | null> {
  return AsyncStorage.getItem(BASE_KEY);
}

export async function writeApiBase(base: string): Promise<void> {
  await AsyncStorage.setItem(BASE_KEY, base);
}

export async function readLanguage(): Promise<"id" | "en" | null> {
  const value = await AsyncStorage.getItem(LANGUAGE_KEY);
  return value === "en" ? "en" : value === "id" ? "id" : null;
}

export async function writeLanguage(language: "id" | "en"): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
}

function makeGuestId(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `guest_${stamp}_${random()}${random()}`.slice(0, 48);
}

export async function ensureGuestId(): Promise<string> {
  const existing = await AsyncStorage.getItem(GUEST_KEY);
  if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
  const created = makeGuestId();
  await AsyncStorage.setItem(GUEST_KEY, created);
  return created;
}
