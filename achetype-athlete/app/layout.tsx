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
import { Abril_Fatface, Poppins } from "next/font/google";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";
import "./globals.css";
import RightSidebar from "@/components/right-sidebar";

// Abril Fatface: editorial display serif for headings (matches Gunther Klaus site)
const abrilFatface = Abril_Fatface({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap"
});

// Poppins: clean geometric sans-serif for body and UI text
const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Gunther Athlete Portal",
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
    <html lang="en" className={`${abrilFatface.variable} ${poppins.variable}`}>
      <body>
        <div className="app-shell">
          <div className="app-main">{children}</div>
          <RightSidebar role={auth.role} email={auth.email} />
        </div>
      </body>
    </html>
  );
}
