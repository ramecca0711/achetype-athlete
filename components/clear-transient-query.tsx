/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/athlete/request-review/page.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  keys: string[];
  delayMs?: number;
};

export default function ClearTransientQuery({ keys, delayMs = 1200 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hasAny = keys.some((key) => searchParams.get(key) !== null);
    if (!hasAny) return;

    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      for (const key of keys) next.delete(key);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, keys, pathname, router, searchParams]);

  return null;
}

