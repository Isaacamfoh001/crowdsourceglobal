import Link from "next/link";
import { Container } from "../../../components/ui/Container";
import { Button } from "../../../components/ui/Button";

export const metadata = {
  title: "Beauty Talent",
  description: "Show CrownSourceGlobal what you can do. Apply with your work — no CV required.",
};

const WHO_CAN_APPLY = [
  "Hairdressers",
  "Wig makers",
  "Wig installers",
  "Braiders",
  "Makeup artists",
  "Lash technicians",
  "Nail technicians",
  "Beauticians",
  "Salon assistants",
  "Beauty sales staff",
];

export default function CareersLandingPage() {
  return (
    <div>
      <div className="bg-espresso-950">
        <Container className="max-w-2xl py-14 sm:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-300 uppercase">Beauty talent</p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ivory-50 sm:text-5xl">
            Your work speaks for you.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ivory-200/70">
            Looking for opportunities in beauty? Show us what you can do, tell us the kind of
            work you&apos;re looking for, and CrownSourceGlobal may connect you with relevant
            beauty opportunities.
          </p>
          <p className="mt-3 text-sm text-ivory-200/50">No CV needed — just real photos of your work.</p>
          <div className="mt-8">
            <Link href="/careers/apply">
              <Button size="lg" className="!bg-champagne-400 !text-espresso-950 hover:!bg-champagne-300">
                Apply with your work
              </Button>
            </Link>
          </div>
        </Container>
      </div>

      <div className="bg-ivory-100 py-14 sm:py-20">
        <Container className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">Who can apply</p>
          <h2 className="mt-3 font-display text-2xl font-medium text-espresso-950 sm:text-3xl">
            Beauty professionals of every kind
          </h2>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {WHO_CAN_APPLY.map((role) => (
              <li key={role} className="flex items-center gap-2 text-[15px] text-espresso-900/75">
                <span className="size-1.5 rounded-full bg-champagne-500" aria-hidden />
                {role}
              </li>
            ))}
          </ul>

          <div className="mt-12 border-t border-ivory-300 pt-8">
            <h2 className="font-display text-lg font-medium text-espresso-950">How it works</h2>
            <ol className="mt-4 flex flex-col gap-3 text-[15px] leading-relaxed text-espresso-900/70">
              <li>1. Tell us who you are and what you do.</li>
              <li>2. Upload a few clear photos of work you personally completed.</li>
              <li>3. Submit — no account or sign-in required.</li>
            </ol>
            <p className="mt-6 text-sm text-espresso-900/50">
              CrownSourceGlobal may connect suitable applicants with relevant beauty
              opportunities. Submitting an application does not guarantee placement or
              employment.
            </p>
          </div>

          <div className="mt-10">
            <Link href="/careers/apply">
              <Button size="lg" fullWidth className="sm:w-auto">
                Apply with your work
              </Button>
            </Link>
          </div>
        </Container>
      </div>
    </div>
  );
}
