/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/coach/queue`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

export default async function CoachQueuePage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (me?.role !== "coach" && me?.role !== "admin") redirect("/athlete");
  const cookieStore = await cookies();
  const scopedCoachId = me?.role === "admin" ? cookieStore.get("admin_view_coach_id")?.value || "" : user.id;
  if (me?.role === "admin" && !scopedCoachId) redirect("/admin");

  const nowIso = new Date().toISOString();
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: linkedAthletes },
    { count: totalRequests },
    { count: pendingCount },
    { count: inReviewCount },
    { count: resolvedCount },
    { count: resolvedLast7Days },
    { data: openConfidenceRows }
  ] = await Promise.all([
    supabase
      .from("athlete_relationships")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", scopedCoachId),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", scopedCoachId),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", scopedCoachId)
      .eq("status", "pending"),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", scopedCoachId)
      .eq("status", "in_review"),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", scopedCoachId)
      .eq("status", "resolved"),
    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", scopedCoachId)
      .eq("status", "resolved")
      .gte("updated_at", sevenDaysAgoIso)
      .lte("updated_at", nowIso),
    supabase
      .from("review_requests")
      .select("confidence_score")
      .eq("coach_id", scopedCoachId)
      .neq("status", "resolved")
  ]);

  const openCount = (pendingCount ?? 0) + (inReviewCount ?? 0);
  const averageOpenConfidence = openConfidenceRows?.length
    ? openConfidenceRows.reduce((sum, row) => sum + Number(row.confidence_score ?? 0), 0) / openConfidenceRows.length
    : 0;
  const resolvedRate = (totalRequests ?? 0) > 0 ? ((resolvedCount ?? 0) / (totalRequests ?? 0)) * 100 : 0;

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Coach Dashboard</p>
        <h1 className="text-4xl mt-3">High-Level Stats</h1>
        <p className="meta mt-1">Snapshot for {me?.full_name ?? "Coach"}.</p>
      </section>

      <section className="grid md:grid-cols-3 gap-3">
        <div className="metric">
          <p className="meta text-sm">Linked Athletes</p>
          <p className="text-2xl font-semibold mt-1">{linkedAthletes ?? 0}</p>
        </div>
        <div className="metric">
          <p className="meta text-sm">Open Requests</p>
          <p className="text-2xl font-semibold mt-1">{openCount}</p>
        </div>
        <div className="metric">
          <p className="meta text-sm">Resolved (Last 7 Days)</p>
          <p className="text-2xl font-semibold mt-1">{resolvedLast7Days ?? 0}</p>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-3">
        <div className="metric">
          <p className="meta text-sm">Pending</p>
          <p className="text-xl font-semibold mt-1">{pendingCount ?? 0}</p>
        </div>
        <div className="metric">
          <p className="meta text-sm">In Review</p>
          <p className="text-xl font-semibold mt-1">{inReviewCount ?? 0}</p>
        </div>
        <div className="metric">
          <p className="meta text-sm">Resolved Rate</p>
          <p className="text-xl font-semibold mt-1">{formatPercent(resolvedRate)}</p>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Quality Signals</h2>
        <p className="meta mt-1">Average confidence score of open requests (1 = low confidence, 5 = high confidence).</p>
        <p className="text-3xl font-semibold mt-3">{averageOpenConfidence ? averageOpenConfidence.toFixed(1) : "-"}</p>
      </section>
    </main>
  );
}
