import { getTranslations } from "next-intl/server";
import { AuthForms, type LoginNotice } from "./AuthForms";

export async function generateMetadata() {
  return { title: (await getTranslations("titles"))("login") };
}

// `?notice=` is set by /auth/confirm and /auth/reset after the user clicks a
// link in a confirmation or password-reset email.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const known: LoginNotice = notice === "confirmed" || notice === "confirmError" || notice === "resetError" ? notice : null;
  return <AuthForms notice={known} />;
}
