import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Target of the link in the sign-up confirmation email (passed as
// `emailRedirectTo` in AuthForms). Handles both link styles Supabase can send:
// - `?code=` (default template, PKCE): Supabase has already confirmed the
//   address before redirecting here; exchanging the code signs the user in.
// - `?token_hash=&type=` (custom template pointing straight at this route).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return NextResponse.redirect(new URL(error ? "/login?notice=confirmError" : "/launcher", origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // The exchange fails when the link is opened in a different browser than
    // the one used to sign up (no PKCE verifier cookie there). The address is
    // confirmed either way, so the user only has to sign in.
    return NextResponse.redirect(new URL(error ? "/login?notice=confirmed" : "/launcher", origin));
  }

  // Expired/invalid links arrive with the error in the URL fragment, which
  // never reaches the server — so no code at all means the link didn't work.
  return NextResponse.redirect(new URL("/login?notice=confirmError", origin));
}
