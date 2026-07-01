"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/overview": "Security Overview",
  "/events": "Events",
  "/trust": "Trust",
  "/decisions": "Decisions",
  "/incidents": "Incidents",
  "/recommendations": "Recommendations",
  "/explanations": "Explanations",
  "/integrations": "Integrations",
  "/policies": "Policies",
  "/evidence-graph": "Evidence Graph",
};

export default function Topbar() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "K-SNS";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-navy-700/60 bg-navy-900/60 px-6 backdrop-blur-xl">
      <h1 className="text-base font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gray-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-500" />
        </span>
        <span>K-SNS API not connected (Alpha 1)</span>
      </div>
    </header>
  );
}
