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
  async function getAuthSummary(): Promise<{ role: AppRole | null; email: string | null }> {
    const supabase = createSupabaseServer();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return { role: null, email: null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return {
      role: (profile?.role as AppRole | undefined) ?? null,
      email: user.email ?? null
    };
  }

  const auth = await getAuthSummary();

  return (
    <html lang="en" >
      <body>
        <div className="app-shell">
          <div className="app-main">{children}</div>
          <RightSidebar role={auth.role} email={auth.email} />
        </div>
      </body>
    </html>
  );
}
