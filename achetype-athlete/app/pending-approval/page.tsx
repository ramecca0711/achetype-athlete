/**
 * AUTO-DOC: File overview
 * Purpose: Waiting room shown to coach/admin accounts that have not yet been
 *          approved by an existing admin. Users land here from app/page.tsx
 *          when their profile has approval_status = 'pending'.
 * Related pages/files:
 * - `app/page.tsx`          — redirects here when approval_status = 'pending'
 * - `app/admin/page.tsx`    — admins approve/reject from Pending Approvals section
 * - `lib/supabase/server.ts`
 * - `lib/supabase/client.ts`
 */
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";

export default async function PendingApprovalPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, approval_status, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  // If the account has been approved since the last visit, send them on
  if (profile?.approval_status !== "pending") {
    redirect("/");
  }

  const roleLabel = profile?.role === "admin" ? "administrator" : "coach";

  return (
    <main className="shell min-h-screen flex items-center justify-center">
      <section className="card w-full max-w-lg p-8 text-center space-y-4">
        <p className="badge inline-block">Account Pending</p>
        <h1 className="text-3xl mt-3">Awaiting Approval</h1>
        <p className="meta">
          Your <strong>{roleLabel}</strong> account for{" "}
          <strong>{profile?.email ?? user.email}</strong> has been created and is
          waiting for an existing admin to approve it before you can access the portal.
        </p>
        <p className="meta text-sm">
          Once approved, sign back in and you&apos;ll be taken to your dashboard automatically.
        </p>
        {/* Sign-out button so they can log out and come back later */}
        <div className="pt-2">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
