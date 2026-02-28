/**
 * AUTO-DOC: File overview
 * Purpose: Reusable UI/form component used across route pages.
 * Related pages/files:
 * - `app/layout.tsx`
 * - `lib/types.ts`
 * - `lib/supabase/client.ts`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AppRole } from "@/lib/types";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type NavItem = { href: string; label: string };
type Props = { role: AppRole | null; email: string | null };

const adminItems: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/analytics", label: "Analytics" }
];

const coachItems: NavItem[] = [
  { href: "/coach/queue", label: "Dashboard" },
  { href: "/coach/review-log", label: "Review Log" },
  { href: "/coach/new-loom-upload", label: "New Loom Video Connect" },
  { href: "/coach/clients", label: "Client Profiles" },
  { href: "/coach/exercises", label: "Exercise Database" },
  { href: "/public-review-board", label: "Public Review Board" }
];

const athleteItems: NavItem[] = [
  { href: "/athlete/profile", label: "Profile" },
  { href: "/athlete", label: "Your Program" },
  { href: "/athlete/exercises", label: "Exercise Database (view only)" },
  { href: "/public-review-board", label: "Public Review Board" }
];

const athleteVideoReviewItems: NavItem[] = [
  { href: "/athlete/request-review", label: "Request Review" },
  { href: "/athlete/feedback", label: "Previous Feedback" }
];

export default function RightSidebar({ role, email }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const hideSidebar = useMemo(
    () => pathname?.startsWith("/login") || pathname?.startsWith("/auth"),
    [pathname]
  );

  if (hideSidebar) return null;

  const showAdmin = role === "admin";
  const showCoach = role === "coach" || role === "admin";
  const showAthlete = role === "athlete" || role === "admin";

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className={`right-sidebar ${collapsed ? "collapsed" : ""}`}>
      <button className="sidebar-toggle" type="button" onClick={() => setCollapsed((v) => !v)}>
        {collapsed ? "Open" : "Close"}
      </button>

      {!collapsed && (
        <nav className="sidebar-nav">
          <section className="sidebar-section">
            <p className="sidebar-header">Signed In</p>
            <p className="text-xs meta">{email ?? "Unknown user"}</p>
            <p className="text-xs meta mt-1">Role: {role ?? "none"}</p>
            <button className="sidebar-signout mt-2" type="button" onClick={signOut}>
              Sign Out
            </button>
          </section>

          {showAdmin && (
            <section className="sidebar-section">
              <p className="sidebar-header">Admin</p>
              <ul className="sidebar-list">
                {adminItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showCoach && (
            <section className="sidebar-section">
              <p className="sidebar-header">Coach</p>
              <ul className="sidebar-list">
                {coachItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showAthlete && (
            <section className="sidebar-section">
              <p className="sidebar-header">Athlete</p>
              <ul className="sidebar-list">
                {athleteItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="sidebar-subheader">Video Review</p>
              <ul className="sidebar-list">
                {athleteVideoReviewItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar-link sidebar-link-nested ${pathname === item.href ? "active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </nav>
      )}
    </aside>
  );
}
