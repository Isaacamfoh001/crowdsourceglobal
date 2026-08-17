type BadgeTone = "brand" | "gold" | "neutral" | "onDark" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  brand: "bg-brand-100 text-brand-800",
  gold: "bg-gold-100 text-gold-800",
  neutral: "bg-stone-100 text-stone-700",
  onDark: "bg-white/10 text-white",
  danger: "bg-red-100 text-red-800",
};

export function Badge({
  tone = "brand",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
