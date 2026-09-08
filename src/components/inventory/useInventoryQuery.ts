"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** Shared client-side helper for the inventory list page's search/filter/
 * sort controls: reads current query params and writes new ones via
 * router.replace (soft navigation — the server component re-renders with
 * fresh, server-filtered results, but the browser never does a full page
 * reload). Changing anything other than the page number itself resets
 * page back to 1, since a new filter can easily leave fewer pages than
 * where the customer was. */
export function useInventoryQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const update = useCallback(
    (patch: Record<string, string | undefined>, opts?: { resetPage?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (opts?.resetPage !== false) params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  return { get, update, clearAll, searchParams };
}
