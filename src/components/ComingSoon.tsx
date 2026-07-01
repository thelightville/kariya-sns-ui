import { Construction } from "lucide-react";

// Explicit "not yet implemented" placeholder — distinct from EmptyState,
// which represents a real feature with no data yet. ComingSoon marks
// features (like Evidence Graph) that have no implementation at all in
// Alpha 1, so operators are never misled into thinking a feature is live
// but simply empty.
export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-navy-700/60 px-6 py-20 text-center">
      <Construction className="h-9 w-9 text-kariya-500" />
      <p className="badge badge-warn">Not Yet Implemented</p>
      <p className="text-sm font-medium text-gray-300">{title}</p>
      <p className="max-w-md text-xs text-gray-500">{description}</p>
    </div>
  );
}
