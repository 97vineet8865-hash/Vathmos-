import React from 'react';
import { FileText, Scale, CheckCircle2, AlertTriangle, ArrowLeft, ArrowUpRight, Zap, Shield, CreditCard, Mail } from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';
import { VathmosLogo } from '../components/VathmosLogo';

export const TermsPage: React.FC = () => {
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
              <VathmosLogo size="xs" />
              <span className="text-base font-bold tracking-tight text-white">Vathmos</span>
              <span className="text-xs text-slate-400">/ Terms of Service</span>
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Scale className="w-3.5 h-3.5" />
            <span>Last Updated: October 12, 2026 • Commercial SaaS Terms</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Terms of Service & SaaS Agreement
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Please read these Terms of Service carefully before subscribing to or utilizing <strong className="text-white">Vathmos</strong> ("Platform", "Service", operated by <span className="text-slate-200">Vathmos Technologies</span>). By accessing the platform, purchasing evaluation credit bundles, or activating subscription passes, you agree to be legally bound by these terms.
          </p>
        </div>

        {/* Highlight Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Instant Digital Delivery</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Candidate evaluation credits and passes are provisioned immediately into your account upon payment verification.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Transparent Credit Tiers</h3>
            <p className="text-xs text-slate-400 leading-normal">
              1 credit = 1 complete candidate 100-point rubric evaluation. Transparent billing with zero hidden surcharges.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Human-In-The-Loop</h3>
            <p className="text-xs text-slate-400 leading-normal">
              Vathmos serves strictly as a recruiter co-pilot and decision-support tool. It does not replace human hiring judgment.
            </p>
          </div>
        </div>

        {/* Detailed Legal Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          {/* Section 1 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono text-sm">01.</span>
              Platform Description & License Grant
            </h2>
            <p>
              Vathmos provides Tech & Business recruitment teams, corporate talent acquisition departments, and staffing agencies with an objective, consistent 100-point candidate scoring engine.
            </p>
            <p className="text-slate-400 text-xs">
              Subject to these Terms and active subscription/credit standing, Vathmos grants you a non-exclusive, non-transferable, revocable license to access the platform, upload job descriptions and candidate resumes, generate ranked comparison leaderboards, and export evaluation PDF reports.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono text-sm">02.</span>
              Credit-Based Billing & Digital Delivery
            </h2>
            <div className="space-y-2 text-xs text-slate-400">
              <p>
                <strong className="text-slate-200">1. Instant Digital Fulfillment:</strong> All purchases (Starter Pass at $39 / ₹3,705 INR, Pro at $79 / ₹7,505 INR, and Agency at $119 / ₹11,305 INR tiers) constitute digital SaaS goods. Upon successful payment callback via our authorized payment partners (<strong className="text-white">Razorpay</strong> and <strong className="text-white">Lemon Squeezy</strong>), evaluation credits are credited immediately and automatically to your authenticated account ID.
              </p>
              <p>
                <strong className="text-slate-200">2. Irreversible Credit Consumption:</strong> One (1) credit is consumed upon each candidate resume evaluation against a Job Description. Because evaluation immediately consumes non-recoverable real-time server compute and AI inference tokens, all consumed credits and delivered audits are strictly final and non-refundable. If an evaluation encounters an unrecoverable system processing error, the credit is automatically restored.
              </p>
              <p>
                <strong className="text-slate-200">3. Currency &amp; Taxes:</strong> Pricing is displayed in USD ($) and Indian Rupees (INR ₹). Depending on your billing region, applicable goods and services taxes (GST / VAT) may be included at checkout by our Merchant of Record.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono text-sm">03.</span>
              Acceptable Use & Recruiter Warranties
            </h2>
            <p className="text-xs text-slate-400">
              By submitting resumes to the Vathmos platform, you represent and warrant that:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-400">
              <li>You have legitimate legal standing, consent, or employment applicant authority to process the submitted candidate resumes for screening purposes.</li>
              <li>You will not upload malicious code, executable payloads, or corrupted files intended to disrupt service architecture.</li>
              <li>You will not attempt to reverse engineer, scrape, disassemble, or extract proprietary rubric scoring algorithms or system prompts.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono text-sm">04.</span>
              Decision-Support Disclaimer &amp; Human Oversight
            </h2>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Human Decision-Support Notice</span>
              </div>
              <p className="leading-relaxed">
                Vathmos is an assistive talent auditing tool designed to eliminate keyword-stuffing bias and surface objective evidence. <strong>Vathmos does NOT make hiring decisions, adverse employment choices, or automatic disqualifications.</strong> All final employment determinations, interview invitations, and candidate communications remain the sole responsibility of human recruiting personnel using fair, skills-based hiring practices.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono text-sm">05.</span>
              Limitation of Liability
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              To the maximum extent permitted by applicable law, Vathmos Technologies and its founders shall not be liable for any indirect, punitive, incidental, or consequential damages resulting from recruitment outcomes, candidate evaluations, or operational downtime. In no event shall our total cumulative liability exceed the total amount paid by you to Vathmos during the preceding twelve (12) months.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono text-sm">06.</span>
              Dispute Resolution &amp; Jurisdiction
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Any dispute, controversy, or claim arising out of or relating to these terms shall be resolved exclusively in the competent courts of New Delhi / NCR, India.
            </p>
          </section>
        </div>

        {/* Legal Links Footer */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link>
            <span>•</span>
            <Link href="/refund" className="hover:text-slate-300 transition">Refund & Cancellation Policy</Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-slate-300 transition">Contact Us</Link>
          </div>
          <p>© {new Date().getFullYear()} Vathmos Technologies. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
};
