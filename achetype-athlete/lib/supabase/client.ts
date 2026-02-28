/**
 * AUTO-DOC: File overview
 * Purpose: Shared utility/helper module used by pages and components.
 * Related pages/files:
 * - `app/login/page.tsx`
 * - `components/exercise-sample-upload-form.tsx`
 * - `components/posture-photo-input.tsx`
 * - `components/program-load-form.tsx`
 * - `components/request-review-form.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client for client components and browser-only actions.
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
