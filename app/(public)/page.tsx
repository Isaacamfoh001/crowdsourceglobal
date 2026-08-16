import Link from "next/link";
import { Button } from "../../components/ui/Button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            CrownSource<span className="text-blue-700">Global</span>
          </span>
          <nav className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link href="/sign-up">
              <Button className="!w-auto px-4 py-2">Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Buy what you need, however you need it.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Shop normally, buy in bulk with instant pricing, or ask CrownSourceGlobal to
            source something custom.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/sign-up">
              <Button className="!w-auto px-6 py-3">Create your account</Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            The full marketplace experience is under active development.
          </p>
        </div>
      </main>
    </div>
  );
}
