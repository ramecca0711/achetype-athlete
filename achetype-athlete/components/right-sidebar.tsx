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

// NavItem now carries an optional small SVG icon element rendered beside the label
type NavItem = { href: string; label: string; icon?: React.ReactNode };
type Props = { role: AppRole | null; email: string | null };

// ─── Inline SVG icon helpers (14×14, stroke-based, inherit color) ─────────────

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 10l5-3v10l-5-3V10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconDumbbell() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 5v14M18 5v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="2.5" y="7" width="3.5" height="10" rx="1" stroke="currentColor" strokeWidth="2"/>
      <rect x="18" y="7" width="3.5" height="10" rx="1" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M3.6 9h16.8M3.6 15h16.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9c2.5-3 4-5.5 4-9s-1.5-6-4-9z" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconMessageSquare() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Nav item lists with icons ────────────────────────────────────────────────

const adminItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <IconGrid /> },
  { href: "/analytics", label: "Analytics", icon: <IconBarChart /> }
];

const coachItems: NavItem[] = [
  { href: "/coach/queue", label: "Dashboard", icon: <IconGrid /> },
  { href: "/coach/review-log", label: "Review Log", icon: <IconList /> },
  { href: "/coach/new-loom-upload", label: "New Loom Video Connect", icon: <IconVideo /> },
  { href: "/coach/clients", label: "Client Profiles", icon: <IconUsers /> },
  { href: "/coach/exercises", label: "Exercise Database", icon: <IconDumbbell /> },
  { href: "/public-review-board", label: "Public Review Board", icon: <IconGlobe /> }
];

const athleteItems: NavItem[] = [
  { href: "/athlete/profile", label: "Profile", icon: <IconUser /> },
  { href: "/athlete", label: "Your Program", icon: <IconClipboard /> },
  { href: "/athlete/exercises", label: "Exercise Database", icon: <IconDumbbell /> },
  { href: "/public-review-board", label: "Public Review Board", icon: <IconGlobe /> }
];

const athleteVideoReviewItems: NavItem[] = [
  { href: "/athlete/request-review", label: "Request Review", icon: <IconVideo /> },
  { href: "/athlete/feedback", label: "Previous Feedback", icon: <IconMessageSquare /> }
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
                      {/* Icon + label side by side */}
                      {item.icon && <span className="sidebar-icon">{item.icon}</span>}
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
                      {item.icon && <span className="sidebar-icon">{item.icon}</span>}
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
                      {item.icon && <span className="sidebar-icon">{item.icon}</span>}
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
                      {item.icon && <span className="sidebar-icon">{item.icon}</span>}
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
