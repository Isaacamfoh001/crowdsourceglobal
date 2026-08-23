import Link from "next/link";

export function Logo({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      className={`font-display text-xl font-medium tracking-tight ${onDark ? "text-white" : "text-espresso-950"} ${className}`}
    >
      CrownSource<span className={onDark ? "text-champagne-400" : "text-forest-800"}>Global</span>
    </Link>
  );
}
