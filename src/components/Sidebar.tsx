"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FileCog,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Network,
  PanelsTopLeft,
  Plug,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/workflow", label: "Security Workflow", icon: PanelsTopLeft },
  { href: "/incidents", label: "Incidents", icon: FolderKanban },
  { href: "/actions", label: "Autonomous Actions", icon: Activity },
  { href: "/trust", label: "Trust & Risk", icon: ShieldCheck },
  { href: "/integrations", label: "Connectors & Telemetry", icon: Plug },
  { href: "/evidence-graph", label: "Evidence & Explain", icon: Network },
  { href: "/events", label: "Events", icon: Zap },
  { href: "/decisions", label: "Decisions", icon: GitBranch },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/explanations", label: "KAI Explanations", icon: MessageSquareText },
  { href: "/policies", label: "Policies", icon: FileCog },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-navy-700/60 bg-navy-900/95 backdrop-blur-xl">
      <Link
        href="/overview"
        className="flex items-center gap-3 border-b border-navy-700/60 px-5 py-5"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-kariya-500 to-kariya-700 shadow-lg shadow-kariya-600/20">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-wide text-white">K-SNS</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
            Security Nervous System
          </span>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-kariya-500/10 text-kariya-400 shadow-sm"
                  : "text-gray-500 hover:bg-navy-800/50 hover:text-gray-300"
              }`}
              style={active ? { boxShadow: "inset 3px 0 0 #f97316" } : undefined}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-colors duration-150 ${
                  active ? "text-kariya-400" : "text-gray-600 group-hover:text-gray-400"
                }`}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-navy-700/60 px-3 py-3">
        <Link
          href="/login"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-gray-500 transition-all duration-150 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span>Sign Out</span>
        </Link>
      </div>
    </aside>
  );
}
