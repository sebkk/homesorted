import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, toLocale } from "./config";

// No locale segment in URLs: the language lives in a cookie set by setLocale().
export default getRequestConfig(async () => {
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
