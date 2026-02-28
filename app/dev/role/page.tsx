/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/dev/role`.
 * Related pages/files:
 * - `lib/supabase/server.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

const roleOptions = ["athlete", "coach", "admin"] as const;

export default async function DevRolePage() {
  const supabase = createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  async function switchRole(formData: FormData) {
    "use server";

    const sb = createSupabaseServer();
    const {
      data: { user: actionUser }
    } = await sb.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }

    const role = String(formData.get("role") ?? "");
    if (!roleOptions.includes(role as (typeof roleOptions)[number])) {
      redirect("/dev/role");
    }

    await sb.from("profiles").update({ role }).eq("id", actionUser.id);
    redirect("/");
  }

  return (
    <main className="shell">
      <section className="card p-6 max-w-xl">
        <div className="flex items-center justify-between gap-2">
          <p className="badge inline-block">Dev Tools</p>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </div>
        <h1 className="text-3xl mt-3">Quick Role Switch</h1>
        <p className="meta mt-2">
          Signed in as {profile?.full_name ?? "User"} ({profile?.email ?? user.email})
        </p>
        <p className="mt-1">Current role: <span className="font-semibold">{profile?.role ?? "unknown"}</span></p>

        <div className="flex gap-2 mt-4 flex-wrap">
          {roleOptions.map((role) => (
            <form key={role} action={switchRole}>
              <input type="hidden" name="role" value={role} />
              <button className="btn btn-primary" type="submit">
                Switch to {role}
              </button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
