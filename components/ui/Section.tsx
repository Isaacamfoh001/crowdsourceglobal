import { Container } from "./Container";

type SectionTone = "default" | "muted" | "warm" | "brand" | "ink";

const toneClasses: Record<SectionTone, string> = {
  default: "bg-ivory-50",
  muted: "bg-ivory-50",
  /** A deliberately distinct third surface — warm ivory tint — so alternating sections actually read as alternating. */
  warm: "bg-ivory-100",
  brand: "bg-espresso-950 text-ivory-100",
  ink: "bg-espresso-950 text-ivory-100",
};

export function Section({
  id,
  tone = "default",
  className = "",
  containerClassName = "",
  children,
}: {
  id?: string;
  tone?: SectionTone;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`py-16 sm:py-20 lg:py-28 ${toneClasses[tone]} ${className}`}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
