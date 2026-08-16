const STEPS = [
  { path: "seller-type", label: "Seller type" },
  { path: "details", label: "Your details" },
  { path: "business", label: "Business info" },
  { path: "operations", label: "What you sell" },
  { path: "review", label: "Review" },
] as const;

export function OnboardingProgress({ current }: { current: (typeof STEPS)[number]["path"] }) {
  const currentIndex = STEPS.findIndex((step) => step.path === current);

  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2" aria-label="Onboarding progress">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.path} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isCurrent
                  ? "bg-brand-700 text-white"
                  : isDone
                    ? "bg-brand-100 text-brand-800"
                    : "bg-stone-100 text-stone-400"
              }`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {index + 1}
            </span>
            <span className={`text-xs font-medium sm:text-sm ${isCurrent ? "text-stone-900" : "text-stone-500"}`}>
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className="mx-0.5 h-px w-4 shrink-0 bg-stone-200 sm:w-6" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
