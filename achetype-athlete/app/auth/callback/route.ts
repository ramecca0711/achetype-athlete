/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route handler for auth/server-side request flow.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// Handles Supabase OAuth/OTP callback and exchanges code for a user session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // When auth code exists, exchange it for an authenticated session cookie.
  if (code) {
    const supabase = createSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect back to the requested path (or home by default).
  return NextResponse.redirect(`${origin}${next}`);
}
