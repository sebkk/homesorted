import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The root route only ever decides where to send the visitor — middleware.ts
// already redirects signed-out users to /login, so if we get here we're
// either signed in (send to /launcher) or middleware hasn't run yet.
export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/launcher" : "/login");
}
