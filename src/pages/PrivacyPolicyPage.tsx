import React from 'react';
import { useRouter } from '../router/RouterContext';
import { Shield, ArrowLeft, Mail, ArrowUpRight } from 'lucide-react';
import { Link } from '../router/RouterContext';
import { VathmosLogo } from '../components/VathmosLogo';

export const PrivacyPolicyPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0C11] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-white hover:text-cyan-400 transition">
            <ArrowLeft className="w-4 h-4" />
            <VathmosLogo size="xs" />
            <span className="text-xs font-bold uppercase tracking-wider">Back to Vathmos</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-slate-400">Plain English Privacy Policy</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10 w-full">
        {/* Title Header */}
        <div className="space-y-3 border-b border-slate-800 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>Honest & Plain English</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-400">
            Last updated: October 2026. This policy explains simply and honestly what we store and what we do not store.
          </p>
        </div>

        {/* Core Principles */}
        <div className="space-y-6">
          {/* 1. What We Store */}
          <section className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/70 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-cyan-400 font-mono text-sm">1.</span>
              What We Store
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              We only store your account information:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-slate-300">
              <li>Your <strong>name</strong>.</li>
              <li>Your <strong>email address</strong>.</li>
              <li>Your active <strong>pricing tier</strong> and evaluation balance.</li>
            </ul>
          </section>

          {/* 2. What We Do NOT Store */}
          <section className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/70 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-sm">2.</span>
              What We Do NOT Store
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong>Candidate resumes are NOT stored.</strong>
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              When you upload or paste a resume, it is processed in temporary computer memory to generate your candidate score and evidence breakdown. Once the evaluation is generated, the resume text is immediately deleted from memory. We do not save candidate resumes to disks, databases, or training datasets.
            </p>
          </section>

          {/* 3. Account & Data Deletion */}
          <section className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/70 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400 font-mono text-sm">3.</span>
              You Can Delete Your Account Anytime
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You have full control over your account. You can request account deletion at any time by emailing us at{' '}
              <a href="mailto:vathmossupport@gmail.com" className="text-cyan-400 underline underline-offset-2">
                vathmossupport@gmail.com
              </a>
              . When you delete your account, we delete your stored account details (name, email, and tier records) from our system.
            </p>
          </section>

          {/* 4. Questions & Contact */}
          <section className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/70 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-slate-400 font-mono text-sm">4.</span>
              Contact Us
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              If you have any questions about this privacy statement, you can reach us directly:
            </p>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-white">Vathmos Support Desk</p>
                <p className="text-slate-400">Support Email: <span className="text-cyan-400 font-mono">vathmossupport@gmail.com</span></p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold border border-slate-700 transition"
              >
                <span>Contact Desk</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        </div>

        {/* Legal Links Footer */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/terms" className="hover:text-slate-300 transition">Terms of Service</Link>
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
