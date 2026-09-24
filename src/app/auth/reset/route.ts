import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the link in the password-reset email (`redirectTo` in
// ForgotPasswordForm). Signs the user in with the one-time recovery session,
// then sends them to set a new password. Handles both link styles:
// `?code=` (default template, PKCE) and `?token_hash=&type=recovery`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const supabase = await createClient();

  let ok = false;
  if (tokenHash) {
    ok = !(await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })).error;
  } else if (code) {
    // Fails when opened in a different browser than the one that asked for
    // the link (no PKCE verifier cookie there) — the user is told to retry.
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  return NextResponse.redirect(new URL(ok ? "/reset-password" : "/login?notice=resetError", origin));
}
