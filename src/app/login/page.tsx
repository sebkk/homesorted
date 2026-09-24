import { AuthForms, type LoginNotice } from "./AuthForms";

// `?notice=` is set by /auth/confirm after the user clicks the link in the
// sign-up confirmation email.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const known: LoginNotice = notice === "confirmed" || notice === "confirmError" ? notice : null;
  return <AuthForms notice={known} />;
}
