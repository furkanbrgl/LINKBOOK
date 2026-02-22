import Link from "next/link";
import {
  Calendar,
  Link2,
  Palette,
  Mail,
  UserPlus,
  Settings,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/80">
        <nav className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-50"
          >
            Linkbook
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/slim-barber">Demo</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1100px] text-center">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl md:text-5xl">
              Online booking for service businesses
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
              Let customers book 24/7. Owners manage schedules in a
              calendar-first dashboard.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/slim-barber">View demo</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-500">
              Works for barbers, clinics, salons, trainers, and more.
            </p>
          </div>
        </section>

        {/* Feature grid */}
        <section className="border-t border-neutral-200 bg-white px-4 py-16 dark:border-neutral-800 dark:bg-neutral-900/50 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-center text-2xl font-semibold text-neutral-900 dark:text-neutral-50 sm:text-3xl">
              Everything you need to run bookings
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-neutral-600 dark:text-neutral-400">
              Built for service-based businesses that value simplicity and
              reliability.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<Calendar className="size-6" />}
                title="Calendar-first schedule"
                description="Day view, staff columns, and quick actions. Manage bookings without leaving the dashboard."
              />
              <FeatureCard
                icon={<Link2 className="size-6" />}
                title="Branded booking page"
                description="Public link with your accent color. Customers pick service, provider, and time in one flow."
              />
              <FeatureCard
                icon={<Palette className="size-6" />}
                title="Industry templates"
                description="Generic, dental, barber, clinic. Customize labels and copy. Switching templates never changes your data."
              />
              <FeatureCard
                icon={<Mail className="size-6" />}
                title="Automated messages"
                description="Confirmation, reschedule/cancel links, and reminders. Reliable delivery via outbox."
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-neutral-200 px-4 py-16 dark:border-neutral-800 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-center text-2xl font-semibold text-neutral-900 dark:text-neutral-50 sm:text-3xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-3">
              <StepCard
                step={1}
                icon={<UserPlus className="size-6" />}
                title="Create your business"
                description="Sign up and add your shop details. Set timezone and contact info."
              />
              <StepCard
                step={2}
                icon={<Settings className="size-6" />}
                title="Add staff, services, hours"
                description="Define your team, services, and working hours. Full control over availability."
              />
              <StepCard
                step={3}
                icon={<Share2 className="size-6" />}
                title="Share your booking link"
                description="Send your public link to customers. They book, you confirm."
              />
            </div>
          </div>
        </section>

        {/* Templates */}
        <section className="border-t border-neutral-200 bg-white px-4 py-16 dark:border-neutral-800 dark:bg-neutral-900/50 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="text-center text-2xl font-semibold text-neutral-900 dark:text-neutral-50 sm:text-3xl">
              Start with a template
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-neutral-600 dark:text-neutral-400">
              Pick a starting template. Customize wording & branding safely.
              Switching templates never changes your data.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <TemplatePill label="Generic" />
              <TemplatePill label="Barber" />
              <TemplatePill label="Dental" />
              <TemplatePill label="Clinic" />
            </div>
          </div>
        </section>

        {/* Social proof placeholder */}
        <section className="border-t border-neutral-200 px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-[1100px] text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-500">
              Trusted by service businesses worldwide.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-100 px-4 py-8 dark:border-neutral-800 dark:bg-neutral-900 sm:px-6">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex gap-6 text-sm">
            <Link
              href="#"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
            >
              Terms
            </Link>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-500">
            © Linkbook
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-neutral-900 dark:text-neutral-50">
        {title}
      </h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <span className="absolute -top-3 left-6 flex size-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
        {step}
      </span>
      <div className="mt-2 flex size-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-neutral-900 dark:text-neutral-50">
        {title}
      </h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}

function TemplatePill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
      {label}
    </span>
  );
}
