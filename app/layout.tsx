/**
 * AUTO-DOC: File overview
 * Purpose: Project source file.
 * Related pages/files:
 * - `components/right-sidebar.tsx`
 * - `lib/supabase/server.ts`
 * - `lib/types.ts`
 * Note: Update related files together when changing data shape or shared behavior.
 */
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";
import "./globals.css";
import RightSidebar from "@/components/right-sidebar";

export const metadata: Metadata = {
  title: "Archetype Athlete Portal",
  description: "Training programs, Loom submissions, and coach review workflows"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  async function getAuthSummary(): Promise<{
    role: AppRole | null;
    email: string | null;
    adminCoachContextId: string;
    adminAthleteContextId: string;
  }> {
    const supabase = createSupabaseServer();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        role: null,
        email: null,
        adminCoachContextId: "",
        adminAthleteContextId: ""
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const cookieStore = await cookies();

    return {
      role: (profile?.role as AppRole | undefined) ?? null,
      email: user.email ?? null,
      adminCoachContextId: cookieStore.get("admin_view_coach_id")?.value ?? "",
      adminAthleteContextId: cookieStore.get("admin_view_athlete_id")?.value ?? ""
    };
  }

  const auth = await getAuthSummary();

  return (
    <html lang="en" >
      <body>
        <div className="app-shell">
          <div className="app-main">{children}</div>
          <RightSidebar
            role={auth.role}
            email={auth.email}
            adminCoachContextId={auth.adminCoachContextId}
            adminAthleteContextId={auth.adminAthleteContextId}
          />
        </div>
      </body>
    </html>
  );
}
