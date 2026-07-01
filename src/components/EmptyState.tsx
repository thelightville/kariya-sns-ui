import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// Used across every data view for the "no data yet" and "backend unreachable"
// states. K-SNS Alpha 1 has no live backend connection — pages must never
// fabricate placeholder data that looks real; this component is the single
// place that renders "nothing to show" so every page looks/behaves the same.
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-navy-700/60 px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-gray-600" />
      <p className="text-sm font-medium text-gray-300">{title}</p>
      {description && (
        <p className="max-w-md text-xs text-gray-500">{description}</p>
      )}
      {action}
    </div>
  );
}
