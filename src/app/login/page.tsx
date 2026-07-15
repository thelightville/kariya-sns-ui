"use client";

import { Shield } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { safeNextPath } from "@/lib/safeNextPath.mjs";

function LoginCard() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const start = `/api/auth/exchange/start?next=${encodeURIComponent(next)}`;

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
          <h2 className="text-base font-semibold text-white">
            Continue with Kariya Cloud
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Cloud authentication establishes a short-lived, host-local K-SNS
            session. K-SNS never receives your password or MFA credential.
          </p>
          <a
            href={start}
            className="mt-5 block w-full rounded-xl bg-kariya-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-kariya-500"
          >
            Continue securely
          </a>
          <p className="mt-4 text-xs leading-5 text-gray-500">
            Workflow demonstrations remain deterministic synthetic evidence.
            Live dispatch, execution, and verification remain unavailable.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
