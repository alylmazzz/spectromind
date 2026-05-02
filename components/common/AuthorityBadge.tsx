'use client';

interface AuthorityBadgeProps {
  label: string;
  tone?: 'authoritative' | 'helper' | 'fallback';
}

export default function AuthorityBadge({ label, tone = 'authoritative' }: AuthorityBadgeProps) {
  const classes =
    tone === 'authoritative'
      ? 'bg-emerald-900/40 border-emerald-500/50 text-emerald-300'
      : tone === 'helper'
        ? 'bg-sky-900/40 border-sky-500/50 text-sky-300'
        : 'bg-amber-900/40 border-amber-500/50 text-amber-300';

  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}
