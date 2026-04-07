import { Crown } from "lucide-react";

interface ProBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function ProBadge({ onClick, className = "" }: ProBadgeProps) {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 ${onClick ? "cursor-pointer" : ""} select-none whitespace-nowrap ${className}`}
    >
      <Crown className="w-2.5 h-2.5" />
      Pro
    </span>
  );
}
