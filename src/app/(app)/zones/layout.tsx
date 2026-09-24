import { getTranslations } from "next-intl/server";

// The zones page is a client component, so its tab title is set here.
export async function generateMetadata() {
  return { title: (await getTranslations("titles"))("zones") };
}

export default function ZonesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
