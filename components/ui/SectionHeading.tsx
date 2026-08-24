/**
 * Editorial section intro (M14.4) — the eyebrow is plain tracked-out text,
 * not a filled pill. A solid champagne badge above every section heading is
 * exactly the "gold everywhere" texture this pass removes; gold survives
 * only as the eyebrow's ink color, a detail rather than a surface.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  onDark = false,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""} ${className}`}
    >
      {eyebrow ? (
        <p
          className={`mb-3 text-xs font-semibold tracking-[0.2em] uppercase ${onDark ? "text-champagne-300" : "text-champagne-700"}`}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={`font-display text-3xl font-medium tracking-tight sm:text-4xl ${onDark ? "text-ivory-50" : "text-espresso-950"}`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={`mt-4 text-lg leading-relaxed ${onDark ? "text-ivory-100/70" : "text-espresso-900/65"}`}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
