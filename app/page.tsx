import Link from 'next/link';
import { ArrowRightIcon, CheckCircleIcon, ShieldCheckIcon, CreditCardIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const features = [
  {
    name: 'Universal Bill Payment',
    description: 'Pay any UK bill from one secure platform. Council tax, utilities, broadband - all in one place.',
    icon: CreditCardIcon,
  },
  {
    name: 'Bank-Level Security',
    description: 'FCA-regulated with bank-grade encryption. Your money and data are always protected.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Build Your Credit',
    description: 'Every payment helps rebuild your credit score. We report to all major credit agencies.',
    icon: ChartBarIcon,
  },
  {
    name: 'Smart Reminders',
    description: 'Never miss a payment again. Get intelligent reminders tailored to your schedule.',
    icon: CheckCircleIcon,
  },
];

const stats = [
  { label: 'Active Users', value: '10,000+' },
  { label: 'Bills Processed', value: '£2M+' },
  { label: 'Average Savings', value: '£120/year' },
  { label: 'Credit Score Improvement', value: '+65 points' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-neutral-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-lg dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-primary-600">BillPay</span>
              <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">UK</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-700 hover:text-primary-600 dark:text-neutral-300 dark:hover:text-primary-400"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn-primary btn-md rounded-full px-6"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-grid opacity-10" />
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
              <ShieldCheckIcon className="h-4 w-4" />
              FCA Regulated & Secure
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-6xl lg:text-7xl">
              Pay Every UK Bill
              <span className="block text-gradient">Without Direct Debit</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-neutral-600 dark:text-neutral-400">
              Join thousands rebuilding their financial future. One secure platform for all your bills - 
              no credit checks, no direct debit required, just simple payments that build your credit score.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="btn-primary btn-lg flex items-center justify-center gap-2 rounded-full px-8"
              >
                Start Free Today
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
              <Link
                href="#how-it-works"
                className="btn-outline btn-lg rounded-full px-8"
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success-500" />
              No credit checks
            </div>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success-500" />
              Cancel anytime
            </div>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success-500" />
              Bank-level security
            </div>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success-500" />
              FCA regulated
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              Everything You Need to Take Control
            </h2>
            <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
              Built for real people with real challenges. No judgment, just solutions.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid gap-8 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.name} className="card p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
                      <feature.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        {feature.name}
                      </h3>
                      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-t border-neutral-200 bg-neutral-50 px-4 py-24 dark:border-neutral-800 dark:bg-neutral-950 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
              Three Simple Steps to Financial Freedom
            </h2>
          </div>
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid gap-12 lg:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Sign Up in Minutes',
                  description: 'Quick verification with just your ID and phone. No credit checks or lengthy forms.',
                },
                {
                  step: '2',
                  title: 'Add Your Bills',
                  description: 'Snap a photo or enter details manually. We support every UK biller.',
                },
                {
                  step: '3',
                  title: 'Pay & Build Credit',
                  description: 'Pay securely via bank transfer or card. Every payment improves your credit score.',
                },
              ].map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-2xl font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-neutral-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
            Ready to Take Control?
          </h2>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
            Join thousands who've already simplified their bills and improved their credit.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="btn-primary btn-lg inline-flex items-center gap-2 rounded-full px-8"
            >
              Get Started Free
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center">
              <span className="text-xl font-bold text-primary-600">BillPay</span>
              <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">UK</span>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              © 2024 BillPay UK. All rights reserved. FCA Regulated.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}