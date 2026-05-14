"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Neispravna email adresa ili lozinka.");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-ink-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 mb-5 shadow-lg shadow-[#003580]/20">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M4 22L6 14H26L28 22H4Z" fill="white" opacity="0.9"/>
              <rect x="7" y="22" width="4" height="3" rx="1.5" fill="white"/>
              <rect x="21" y="22" width="4" height="3" rx="1.5" fill="white"/>
              <path d="M8 14L10 8H22L24 14" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black text-brand-500 tracking-tight leading-tight">
            VTZ Rent-a-Car
          </h1>
          <p className="text-slate-500 text-[13px] font-semibold uppercase tracking-widest mt-1">
            Fleet Management System
          </p>
        </div>

        {/* Card */}
        <div className="card p-7">
          <h2 className="text-[15px] font-bold text-slate-800 mb-5">Prijava</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email adresa</label>
              <input
                type="email"
                className="input"
                placeholder="korisnik@vtz.ba"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Lozinka</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-1"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Prijava u toku...
                </>
              ) : (
                "Prijavi se"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-400 text-xs mt-6">
          VTZ Rent-a-Car &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
