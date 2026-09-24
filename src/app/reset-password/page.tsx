import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

// Reached from /auth/reset with a recovery session. Deliberately outside
// (app)/: an account with encryption enabled would otherwise hit the
// encryption unlock screen before it could set a new login password.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login?notice=resetError");

  return <ResetPasswordForm email={user.email} />;
}
