import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ToastProvider } from "@/components/ui/Toast";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { ...metadata, description: t("description") };
}

const metadata: Metadata = {
  // Pages set just their own name ("Profil"); the tab reads "Profil · HomeSorted".
  title: { default: "HomeSorted", template: "%s · HomeSorted" },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    // Installed iOS app: content runs under the status bar; screens pad for it
    // with env(safe-area-inset-top).
    statusBarStyle: "black-translucent",
    title: "HomeSorted",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#282b2e", // = --app-bg in globals.css
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={ibmPlexSans.variable}>
      <body className="font-sans flex justify-center">
        <div className="w-full max-w-[480px] min-h-dvh md:min-h-[min(860px,calc(100dvh-48px))] md:my-6 md:rounded-[20px] md:overflow-hidden md:bg-surface glass md:border md:border-border md:shadow-glass relative flex flex-col">
          <NextIntlClientProvider>
            <ToastProvider>{children}</ToastProvider>
          </NextIntlClientProvider>
        </div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

function ServiceWorkerRegister() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function () {});
            });
          }
        `,
      }}
    />
  );
}
