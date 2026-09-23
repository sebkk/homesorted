import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Defense in depth: middleware.ts already redirects signed-out visitors, this
// is the belt-and-suspenders check at the layout level.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
