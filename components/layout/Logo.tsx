import Image from "next/image";
import Link from "next/link";

/**
 * Brand lockup: the crown/globe mark (public/icons/icon-192.png — the
 * approved PWA app icon, reused here rather than a redesign) plus the
 * "CrownSourceGlobal" wordmark, with "Global" in champagne/gold — the
 * client's approved brand-name treatment (M17.1). Text size steps down at
 * the smallest breakpoint so mark + wordmark stay uncrowded next to header
 * icons on ~360px screens without losing brand recognition.
 */
export function Logo({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={28}
        height={28}
        className="size-6 shrink-0 rounded-[6px] sm:size-7"
      />
      <span
        className={`font-display text-lg font-medium tracking-tight sm:text-xl ${onDark ? "text-white" : "text-espresso-950"}`}
      >
        CrownSource<span className={onDark ? "text-champagne-400" : "text-champagne-700"}>Global</span>
      </span>
    </Link>
  );
}
