/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/analytics`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AnalyticsPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ count: totalSubmissions }, { count: pendingCount }, { count: thereCount }, { count: coachCount }] = await Promise.all([
    supabase.from("exercise_submissions").select("id", { count: "exact", head: true }),
    supabase.from("exercise_submissions").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("exercise_submissions").select("id", { count: "exact", head: true }).eq("status", "there"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "coach")
  ]);

  return (
    <main className="shell">
      <section className="card p-6">
        <p className="badge inline-block">Platform Analytics</p>
        <h1 className="text-3xl mt-3">Training Snapshot</h1>
        <p className="meta mt-1">High-level production metrics for delivery quality and coaching throughput.</p>
      </section>
      <section className="grid md:grid-cols-4 gap-3 mt-4">
        <article className="metric"><p className="meta text-sm">Total Submissions</p><p className="font-semibold">{totalSubmissions ?? 0}</p></article>
        <article className="metric"><p className="meta text-sm">Pending Review</p><p className="font-semibold">{pendingCount ?? 0}</p></article>
        <article className="metric"><p className="meta text-sm">Marked There</p><p className="font-semibold">{thereCount ?? 0}</p></article>
        <article className="metric"><p className="meta text-sm">Active Coaches</p><p className="font-semibold">{coachCount ?? 0}</p></article>
      </section>
    </main>
  );
}
