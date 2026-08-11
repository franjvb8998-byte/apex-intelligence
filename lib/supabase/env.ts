// Next.js only inlines NEXT_PUBLIC_* vars when accessed statically (e.g.
// process.env.NEXT_PUBLIC_FOO), not via process.env[variableName].
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseUrl(): string {
  if (!supabaseUrl) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  return supabaseUrl;
}

export function getSupabaseAnonKey(): string {
  if (!supabaseAnonKey) {
    throw new Error(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return supabaseAnonKey;
}
