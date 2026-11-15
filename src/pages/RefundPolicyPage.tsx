import React from 'react';
import { RotateCcw, Clock, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, ArrowUpRight, HelpCircle, Mail, DollarSign } from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';

export const RefundPolicyPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">Vathmos</span>
              <span className="text-xs text-slate-400">/ Refund & Cancellation</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold shadow-md hover:from-sky-400 hover:to-indigo-500 transition cursor-pointer"
            >
              <span>Launch App</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Header Hero */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Customer Protection Charter • 7-Day Unused Credit Window</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>v2 Oct 15</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Refund & Cancellation Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            At Vathmos (<span className="text-slate-200">Vathmos Technologies</span>), we believe in transparent, honest, and recruiter-friendly business practices. We want you to evaluate candidate pools with complete peace of mind. This policy explains our refund timelines, eligibility rules, and credit cancellation workflows.
          </p>
        </div>

        {/* 3 Pillars of Refund */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">7-Day Refund Window</h3>
            <p className="text-xs text-slate-400 leading-normal">
              100% money-back refund on any Starter, Pro, or Agency credit package within 7 days of purchase for unused credits.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">5–7 Business Days Payout</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Refunds are initiated within 48 hours and settled to your original payment card, UPI, or bank in 5–7 working days.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">1-Click Cancellation</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Cancel recurring subscription renewals anytime with zero exit penalties, contracts, or lock-in periods.
            </p>
          </div>
        </div>

        {/* Detailed Policy Breakdown */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          {/* Section 1 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">01.</span>
              Eligibility for Refund
            </h2>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 space-y-1">
                <p className="font-bold text-amber-300">
                  ⚠️ Irreversible Digital Compute Notice:
                </p>
                <p className="leading-relaxed">
                  Due to the immediate, non-recoverable consumption of proprietary cloud infrastructure and GPU/AI inference compute upon each resume audit, <strong>all consumed evaluation credits are strictly non-refundable</strong> once a scorecard has been generated or viewed.
                </p>
              </div>
              <p>
                <strong className="text-slate-200">1. Unused Credit Bundles (Zero Consumption):</strong> If you purchased an evaluation bundle or subscription pass (Starter Pass $39 / ₹3,100, Pro, or Agency) and have <strong>consumed 0% of your credits (zero resumes evaluated)</strong>, you are eligible to request a 100% money-back refund within seven (7) calendar days of payment.
              </p>
              <p>
                <strong className="text-slate-200">2. Partially or Fully Consumed Bundles:</strong> Once any candidate resume has been audited or scorecards generated, the digital service is considered fully delivered. <strong>No partial, pro-rated, or proportional refunds are granted</strong> for active, used, or partially depleted credit pools.
              </p>
              <p>
                <strong className="text-slate-200">3. System Downtime & Processing Failures:</strong> In the rare event of an unrecoverable system timeout or service error where an evaluation failed to return a scorecard, your consumed credit is automatically re-credited to your account balance at zero charge.
              </p>
              <p>
                <strong className="text-slate-200">4. Chargeback Abuse & Fraud Prevention:</strong> Initiating fraudulent chargebacks after utilizing platform candidate audits, exporting PDF evaluation reports, or accessing recruiter tools constitutes a violation of these terms and will result in immediate permanent account termination and dispute submission to card networks.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">02.</span>
              Subscription Cancellation Guidelines
            </h2>
            <p className="text-xs text-slate-400">
              Users with recurring monthly subscriptions may cancel renewal at any time:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-400">
              <li>
                <strong className="text-slate-200">How to Cancel:</strong> Navigate to your profile settings in the app or send an email to <span className="text-white font-mono">vathmossupport@gmail.com</span> with your registered account email.
              </li>
              <li>
                <strong className="text-slate-200">Retaining Credit Access:</strong> Upon cancellation, your account will remain active and your remaining credits will stay valid through the end of the current billing cycle. You will not be charged on subsequent renewal dates.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">03.</span>
              Refund Processing & Settlement Timeline
            </h2>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-sky-400 font-semibold">
                <Clock className="w-4 h-4" />
                <span>Payment Gateway Settlement Lifecycle</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Once approved, refunds are triggered immediately on our payment processor gateway:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-400">
                <li><strong className="text-slate-200">Razorpay (India - UPI / Net Banking / RuPay):</strong> 5 to 7 business days for funds to reflect in your bank account, depending on your issuing bank.</li>
                <li><strong className="text-slate-200">Lemon Squeezy (International - Credit & Debit Cards):</strong> 5 to 10 business days depending on international card network clearance.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">04.</span>
              How to Request a Refund
            </h2>
            <p className="text-xs text-slate-400">
              To request a refund or report a billing concern, follow these simple steps:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-emerald-400 font-bold">Step 1</span>
                <p className="text-white font-semibold">Email Support</p>
                <p className="text-slate-400">Write to <span className="text-slate-200 font-mono">vathmossupport@gmail.com</span></p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-emerald-400 font-bold">Step 2</span>
                <p className="text-white font-semibold">Include Details</p>
                <p className="text-slate-400">Provide Order ID / Receipt and account email.</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-emerald-400 font-bold">Step 3</span>
                <p className="text-white font-semibold">Swift Resolution</p>
                <p className="text-slate-400">Our founding team reviews within 24 hours.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Legal Links Footer */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-slate-300 transition">Terms of Service</Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-slate-300 transition">Contact Us</Link>
          </div>
          <p>© {new Date().getFullYear()} Vathmos Technologies. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
};
