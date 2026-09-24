import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request and redirects
// signed-out users away from protected routes.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], headers: Record<string, string>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          // Cache-control headers from @supabase/ssr: a response carrying a
          // refreshed session cookie must never be cached and served to someone else.
          Object.entries(headers ?? {}).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  // Email confirmation links land here before the user has a session.
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/");
  const isPublicAsset =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/manifest") ||
    request.nextUrl.pathname.startsWith("/icons") ||
    request.nextUrl.pathname.startsWith("/sw.js");

  if (!user && !isAuthRoute && !isAuthCallback && !isPublicAsset && request.nextUrl.pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/launcher";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
