import Link from "next/link";

export function WhooshMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="wm-hood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9E1C2C" />
          <stop offset="100%" stopColor="#6C101B" />
        </linearGradient>
      </defs>
      <path
        d="M20 2.8C11.4 2.8 5.2 9.4 5.2 20.7c0 3.9.3 7.2 1 9.9 1.2 5.2 6 9 13.8 9s12.6-3.8 13.8-9c.7-2.7 1-6 1-9.9C34.8 9.4 28.6 2.8 20 2.8Z"
        fill="#FFFDFA"
        stroke="#3B0B12"
        strokeWidth="2"
      />
      <path
        d="M20 4C11.9 4 6.3 10.3 6.3 20.6c0 3.2.2 6 .7 8.2h26c.5-2.2.7-5 .7-8.2C33.7 10.3 28.1 4 20 4Z"
        fill="url(#wm-hood)"
      />
      <path d="M9.3 31.7c5.9 3.6 15.5 3.6 21.4 0" fill="none" stroke="#C8102E" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M13.3 35.3c4 2.1 9.4 2.1 13.4 0" fill="none" stroke="#C8102E" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
      <circle cx="15.2" cy="23.1" r="2.3" fill="#241114" />
      <circle cx="24.8" cy="23.1" r="2.3" fill="#241114" />
      <circle cx="14.4" cy="22.3" r=".75" fill="#FFFDFA" />
      <circle cx="24" cy="22.3" r=".75" fill="#FFFDFA" />
      <path d="M17.8 27.4q2.2 2.1 4.4 0" fill="none" stroke="#241114" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="12.4" cy="26.1" rx="2" ry="1" fill="#FDA4AF" opacity=".75" />
      <ellipse cx="27.6" cy="26.1" rx="2" ry="1" fill="#FDA4AF" opacity=".75" />
    </svg>
  );
}

export function Wordmark({
  inverted = false,
  compact = false,
  href = "/",
}: {
  inverted?: boolean;
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="Whoosh AI">
      <WhooshMark className={compact ? "h-8 w-8" : "h-9 w-9"} />
      <span className="flex items-baseline gap-1.5">
        <span
          className={`text-[19px] font-extrabold tracking-[-0.035em] ${inverted ? "text-white" : "text-ink"}`}
        >
          Whoosh
        </span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[13px] font-semibold ${
            inverted ? "bg-white/15 text-white" : "bg-blush text-maroon"
          }`}
        >
          AI
        </span>
      </span>
    </Link>
  );
}
