import Link from "next/link";

export function Logo({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display text-xl font-medium tracking-tight ${onDark ? "text-white" : "text-stone-900"} ${className}`}
    >
      CrownSource<span className={onDark ? "text-gold-300" : "text-brand-700"}>Global</span>
    </Link>
  );
}
