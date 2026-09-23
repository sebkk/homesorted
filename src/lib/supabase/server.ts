import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used from Server Components, Server Actions and Route Handlers.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to write to —
            // safe to ignore as long as middleware.ts also refreshes the session.
          }
        },
      },
    }
  );
}
