import { Container } from "./Container";

type SectionTone = "default" | "muted" | "brand" | "ink";

const toneClasses: Record<SectionTone, string> = {
  default: "bg-stone-50",
  muted: "bg-white",
  brand: "bg-brand-900 text-brand-50",
  ink: "bg-stone-950 text-stone-50",
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
