import { Badge } from "./Badge";

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
        <Badge tone={onDark ? "onDark" : "brand"} className="mb-4">
          {eyebrow}
        </Badge>
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
