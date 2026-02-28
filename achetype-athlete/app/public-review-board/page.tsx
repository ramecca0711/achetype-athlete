/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/public-review-board`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function PublicReviewBoardPage({
  searchParams
}: {
  searchParams?: { post_error?: string; post_status?: string; delete_error?: string; delete_status?: string };
}) {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("id, role, full_name").eq("id", user.id).maybeSingle();
  if (!me?.role) redirect("/");
  const cookieStore = await cookies();
  if (me.role === "admin" && !cookieStore.get("admin_view_coach_id")?.value && !cookieStore.get("admin_view_athlete_id")?.value) {
    redirect("/admin");
  }

  async function postBoardMessage(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");
    const { data: actionMe } = await sb.from("profiles").select("id, role").eq("id", actionUser.id).maybeSingle();
    if (!actionMe?.role) redirect("/");

    const message = String(formData.get("message_text") ?? "").trim();
    if (!message) redirect("/public-review-board?post_error=empty");

    const { error: insertError } = await sb.from("public_review_board_messages").insert({
      sender_id: actionUser.id,
      athlete_id: actionMe.role === "athlete" ? actionUser.id : null,
      message_type: "chat",
      message_text: message
    });
    if (insertError) {
      redirect(`/public-review-board?post_error=${encodeURIComponent(insertError.message.slice(0, 120))}`);
    }

    redirect("/public-review-board?post_status=ok");
  }

  async function deleteBoardMessage(formData: FormData) {
    "use server";
    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();
    if (!actionUser) redirect("/login");

    const messageId = String(formData.get("message_id") ?? "").trim();
    if (!messageId) redirect("/public-review-board?delete_error=missing_id");

    // Use .select("id") so we can detect if 0 rows matched.
    // Supabase DELETE silently succeeds with no error even when nothing is deleted
    // (e.g. RLS blocks the row or the message belongs to someone else).
    const { data: deleted, error } = await sb
      .from("public_review_board_messages")
      .delete()
      .eq("id", messageId)
      .eq("sender_id", actionUser.id)
      .eq("message_type", "chat")
      .select("id");

    if (error) {
      console.error("[deleteBoardMessage] delete error:", error.message, error.details);
      redirect(`/public-review-board?delete_error=${encodeURIComponent(error.message.slice(0, 120))}`);
    }

    // If no rows came back the delete matched nothing — likely an RLS policy
    // blocking the operation or the message_id / sender_id not matching.
    if (!deleted?.length) {
      console.error("[deleteBoardMessage] 0 rows deleted for message:", messageId, "user:", actionUser.id);
      redirect("/public-review-board?delete_error=not_found");
    }

    redirect("/public-review-board?delete_status=ok");
  }

  const { data: messages } = await supabase
    .from("public_review_board_messages")
    .select("id, sender_id, athlete_id, message_type, message_text, loom_url, reviewed_exercises, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const senderIds = Array.from(new Set((messages ?? []).map((item: any) => item.sender_id).filter(Boolean)));
  const { data: senders } = senderIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", senderIds)
    : { data: [] as any[] };
  const senderMap = new Map((senders ?? []).map((sender: any) => [sender.id, sender]));

  return (
    <main className="shell space-y-4">
      <section className="card p-6">
        <p className="badge inline-block">Community</p>
        <h1 className="text-3xl mt-3">Public Review Board</h1>
        <p className="meta mt-1">
          Athlete chat and public request/review notifications (only from athletes with public sharing enabled).
        </p>
        {!!searchParams?.post_error && (
          <p className="text-red-700 text-sm mt-2">Post failed: {searchParams.post_error}</p>
        )}
        {searchParams?.post_status === "ok" && (
          <p className="text-green-700 text-sm mt-2">Message posted.</p>
        )}
        {!!searchParams?.delete_error && (
          <p className="text-red-700 text-sm mt-2">
            Delete failed:{" "}
            {searchParams.delete_error === "not_found" && "message not found or you don't own it."}
            {searchParams.delete_error === "missing_id" && "missing message ID."}
            {!["not_found", "missing_id"].includes(searchParams.delete_error) && searchParams.delete_error}
          </p>
        )}
        {searchParams?.delete_status === "ok" && (
          <p className="text-green-700 text-sm mt-2">Message deleted.</p>
        )}
      </section>

      <section className="card p-6">
        <form action={postBoardMessage} className="space-y-2">
          <label className="text-sm block">
            Message
            <textarea className="textarea mt-1" name="message_text" placeholder="Write to the public board..." required />
          </label>
          <button className="btn btn-primary" type="submit">Post Message</button>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-2xl">Board Feed</h2>
        <div className="space-y-2 mt-3">
          {(messages ?? []).map((message: any) => {
            const sender = senderMap.get(message.sender_id);
            const senderName = sender?.full_name ?? "Member";
            const senderRole = sender?.role ?? "user";
            const reviewedExercises = Array.isArray(message.reviewed_exercises) ? message.reviewed_exercises : [];
            const typeLabel =
              message.message_type === "request_submitted"
                ? "Public Request"
                : message.message_type === "loom_posted"
                  ? "New Loom Posted"
                  : "Chat";

            return (
              <div key={message.id} className="metric p-3">
                <div className="flex items-center gap-2 flex-wrap justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{senderName}</span>
                  <span className="badge">{senderRole}</span>
                  <span className="badge">{typeLabel}</span>
                  <span className="meta text-xs">{new Date(message.created_at).toLocaleString()}</span>
                  </div>
                  {message.message_type === "chat" && message.sender_id === user.id && (
                    <form action={deleteBoardMessage}>
                      <input type="hidden" name="message_id" value={message.id} />
                      {/* Use btn-danger so it looks like a real clickable button, not a label */}
                      <button className="btn btn-danger" type="submit" title="Delete message" aria-label="Delete message">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M10 10v6M14 10v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{message.message_text}</p>
                {message.loom_url && (
                  <p className="text-sm mt-2">
                    <span className="font-semibold">Loom:</span>{" "}
                    <a className="plain-link" href={message.loom_url} target="_blank">Open Link</a>
                  </p>
                )}
                {!!reviewedExercises.length && (
                  <p className="text-sm mt-1">
                    <span className="font-semibold">Exercises reviewed:</span> {reviewedExercises.join(", ")}
                  </p>
                )}
              </div>
            );
          })}
          {!messages?.length && <p className="meta">No board messages yet.</p>}
        </div>
      </section>
    </main>
  );
}
