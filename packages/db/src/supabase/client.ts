"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

export function getBrowserClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createBrowserClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return document.cookie.split(";").map((c) => {
          const eq = c.indexOf("=");
          const name = eq === -1 ? c.trim() : c.slice(0, eq).trim();
          const value = eq === -1 ? "" : c.slice(eq + 1);
          return { name, value };
        });
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          let str = `${name}=${value}`;
          if (options?.path) str += `; Path=${options.path}`;
          if (options?.maxAge != null) str += `; Max-Age=${options.maxAge}`;
          if (options?.sameSite) str += `; SameSite=${options.sameSite}`;
          if (options?.secure) str += "; Secure";
          document.cookie = str;
        });
      },
    },
  });
}
