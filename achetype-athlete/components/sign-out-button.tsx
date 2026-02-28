/**
 * Small client component that signs the user out via the Supabase browser client
 * and redirects to /login. Used on the /pending-approval page.
 */
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="btn btn-secondary" type="button" onClick={handleSignOut}>
      Sign Out
    </button>
  );
}
