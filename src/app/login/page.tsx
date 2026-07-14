"use client";

import { Shield, Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { safeNextPath } from "@/lib/safeNextPath.mjs";

type LoginPhase = "password" | "mfa";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setOperator = useSessionStore((s) => s.setOperator);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [phase, setPhase] = useState<LoginPhase>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function completeLogin() {
    setOperator({ email });
    const next = safeNextPath(searchParams.get("next"));
    router.push(next);
    router.refresh();
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      if (data.mfa_required) {
        if (!data.mfa_token) {
          setError("MFA challenge did not include a verification token");
          return;
        }
        setMfaToken(data.mfa_token);
        setPhase("mfa");
        setMfaCode("");
        return;
      }

      completeLogin();
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_token: mfaToken, code: mfaCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "MFA verification failed");
        return;
      }

      completeLogin();
    } finally {
      setLoading(false);
    }
  }

  const isMfa = phase === "mfa";

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-kariya-500 to-kariya-700 shadow-lg shadow-kariya-600/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">K-SNS</h1>
          <p className="mt-1 text-sm text-gray-500">
            Security Nervous System, SOC Operations
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={isMfa ? handleMfaVerify : handlePasswordLogin}>
            {!isMfa ? (
              <>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@kariya.ng"
                    autoComplete="email"
                    className="w-full rounded-xl border border-navy-700/40 bg-navy-800/40 px-3 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none transition-all duration-200 hover:border-navy-600/60 focus:border-kariya-500/40 focus:ring-2 focus:ring-kariya-500/25"
                  />
                </div>
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-gray-400">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-navy-700/40 bg-navy-800/40 px-3 py-3 pr-10 text-sm text-gray-200 placeholder-gray-600 outline-none transition-all duration-200 hover:border-navy-600/60 focus:border-kariya-500/40 focus:ring-2 focus:ring-kariya-500/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  MFA Code
                </label>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  className="w-full rounded-xl border border-navy-700/40 bg-navy-800/40 px-3 py-3 text-sm text-gray-200 placeholder-gray-600 outline-none transition-all duration-200 hover:border-navy-600/60 focus:border-kariya-500/40 focus:ring-2 focus:ring-kariya-500/25"
                />
              </div>
            )}

            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-kariya-600 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-kariya-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? isMfa
                  ? "Verifying..."
                  : "Signing in..."
                : isMfa
                  ? "Verify MFA"
                  : "Sign In"}
            </button>

            {isMfa && (
              <button
                type="button"
                onClick={() => {
                  setPhase("password");
                  setMfaToken("");
                  setMfaCode("");
                  setError("");
                }}
                className="mt-3 w-full rounded-xl border border-navy-700/40 py-3 text-sm font-semibold text-gray-300 transition-all duration-200 hover:border-navy-600/70 hover:text-white"
              >
                Back to password
              </button>
            )}
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Kariya Security Nervous System, SOC Operations
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
