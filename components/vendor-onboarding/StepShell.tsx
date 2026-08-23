import { OnboardingProgress } from "./OnboardingProgress";

export function StepShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: Parameters<typeof OnboardingProgress>[0]["current"];
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <OnboardingProgress current={step} />
      <div>
        <h1 className="font-display text-2xl font-medium text-espresso-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-espresso-900/65">{subtitle}</p>
      </div>
      <div className="rounded-2xl border border-ivory-300 bg-white p-5 sm:p-8">{children}</div>
    </div>
  );
}
