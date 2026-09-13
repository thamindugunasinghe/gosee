import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/** Normalize a Sri Lankan mobile number to E.164 (+94XXXXXXXXX). */
export function toE164(raw: string): string {
  let n = raw.replace(/[^\d]/g, "");
  if (n.startsWith("0")) n = "94" + n.slice(1);
  if (!n.startsWith("94")) n = "94" + n;
  return "+" + n;
}
