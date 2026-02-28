/**
 * AUTO-DOC: File overview
 * Purpose: Next.js route page for `/login`.
 * Related pages/files:
 * - `lib/supabase/client.ts`
 * - `app/layout.tsx`
 * - `components/right-sidebar.tsx`
 * Note: Update related files together when changing data shape or shared behavior.
 */
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type CoachOption = {
  id: string;
  full_name: string;
  email: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupRole, setSignupRole] = useState<"athlete" | "coach" | "admin">("athlete");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [signupCoachId, setSignupCoachId] = useState("");
  // Birthday, height, gender, and weight are collected post-signup during onboarding
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getSupabase = useMemo(() => {
    return () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key || !/^https?:\/\//.test(url)) {
        throw new Error("Supabase environment variables are missing or invalid.");
      }

      return createSupabaseBrowser();
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCoaches() {
      try {
        const supabase = getSupabase();
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "coach")
          .order("full_name", { ascending: true });
        if (!active) return;
        const rows = (data ?? []) as CoachOption[];
        setCoaches(rows);
        if (!signupCoachId && rows[0]?.id) setSignupCoachId(rows[0].id);
      } catch {
        if (!active) return;
        setCoaches([]);
      }
    }
    loadCoaches();
    return () => {
      active = false;
    };
  }, [getSupabase, signupCoachId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    if (mode === "signup" && signupRole === "athlete" && !signupCoachId) {
      setError("Please choose a coach.");
      setLoading(false);
      return;
    }

    let action;

    try {
      const supabase = getSupabase();
      action =
        mode === "signup"
          ? supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  role: signupRole,
                  coach_id: signupRole === "athlete" ? signupCoachId : null,
                  // Birthday, age, height, gender, and weight are collected during onboarding after account creation
                  // Pass approval_status in metadata so the DB trigger can write it to profiles.
                  // Coach and admin accounts start as 'pending' — an admin must approve before access.
                  approval_status: ["coach", "admin"].includes(signupRole) ? "pending" : "approved"
                }
              }
            })
          : supabase.auth.signInWithPassword({ email, password });
    } catch (clientError) {
      setError((clientError as Error).message);
      setLoading(false);
      return;
    }

    const { error: authError } = await action;

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      // Give coach/admin a clearer message that they need approval before logging in
      const needsApproval = ["coach", "admin"].includes(signupRole);
      setMessage(
        needsApproval
          ? "Account created. An admin must approve your account before you can sign in. Contact an existing admin."
          : "Account created. Sign in to open your portal."
      );
    } else {
      router.replace("/");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <main className="shell min-h-screen flex items-center justify-center">
      <section className="card w-full max-w-lg p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="badge inline-block">Your Portal</p>
        </div>
        <h1 className="text-3xl sm:text-4xl mt-4">Archetype Athlete Portal</h1>
        <p className="meta mt-2">Programming, video submissions, AI notes, and coach feedback queue.</p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`btn ${mode === "signup" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Create Account
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          {mode === "signup" && (
            <>
              <div>
                <label className="text-sm font-medium" htmlFor="signup-role">
                  Role
                </label>
                <select
                  className="select mt-1"
                  id="signup-role"
                  value={signupRole}
                  onChange={(event) =>
                    setSignupRole(event.target.value as "athlete" | "coach" | "admin")
                  }
                >
                  <option value="athlete">Athlete</option>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {signupRole === "athlete" && (
                <>
                  <div>
                    <label className="text-sm font-medium" htmlFor="signup-coach">
                      Coach
                    </label>
                    <select
                      className="select mt-1"
                      id="signup-coach"
                      value={signupCoachId}
                      onChange={(event) => setSignupCoachId(event.target.value)}
                      required
                    >
                      <option value="">Select coach</option>
                      {coaches.map((coach) => (
                        <option key={coach.id} value={coach.id}>
                          {coach.full_name} ({coach.email})
                        </option>
                      ))}
                    </select>
                    {!coaches.length && <p className="meta text-sm mt-1">No coaches available yet.</p>}
                  </div>
                </>
              )}
            </>
          )}


          <div>
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              className="input mt-1"
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              className="input mt-1"
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>

          <button className="btn btn-primary w-full" disabled={loading} type="submit">
            {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Login"}
          </button>
        </form>

        {message && <p className="mt-4 text-emerald-700">{message}</p>}
        {error && <p className="mt-4 text-red-700">{error}</p>}
      </section>
    </main>
  );
}
