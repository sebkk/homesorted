import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EncryptionProvider } from "@/components/encryption/EncryptionContext";
import { EncryptionGate } from "@/components/encryption/EncryptionGate";

// Defense in depth: middleware.ts already redirects signed-out visitors, this
// is the belt-and-suspenders check at the layout level.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Every page under (app) — launcher, zones, finance — sits behind the
  // encryption gate: locked accounts see an unlock screen instead, so no
  // finance data is ever fetched before the data key is available.
  return (
    <EncryptionProvider>
      <EncryptionGate>{children}</EncryptionGate>
    </EncryptionProvider>
  );
}
