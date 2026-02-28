/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - `app/admin/page.tsx`
 * - `app/analytics/page.tsx`
 * - `app/athlete/day/[dayId]/page.tsx`
 * - `app/athlete/exercises/page.tsx`
 * - `app/athlete/feedback/page.tsx`
 * - `app/athlete/page.tsx`
 * - `app/athlete/profile/page.tsx`
 * - `app/athlete/request-review/page.tsx`
 * - `app/auth/callback/route.ts`
 * - `app/coach/build-program/page.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  };
};

// Server Supabase client wired to Next.js request/response cookies.
export function createSupabaseServer() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read all request cookies for Supabase auth/session handling.
        getAll() {
          return cookieStore.getAll();
        },
        // Persist any cookies that Supabase needs to set/update.
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore writes when called from contexts where Next.js disallows cookie mutation.
            }
          });
        },
      },
    }
  );
}
