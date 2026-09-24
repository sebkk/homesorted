import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "./ProfileView";

export async function generateMetadata() {
  return { title: (await getTranslations("titles"))("profile") };
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const name = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  return <ProfileView email={user.email} name={name} />;
}
