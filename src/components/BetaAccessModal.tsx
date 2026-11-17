import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Clock,
  Mail,
} from 'lucide-react';
import { TIERS } from '../utils/razorpayService';

interface BetaAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierId: 'starter' | 'pro' | 'agency';
  defaultName?: string;
  defaultEmail?: string;
  onLaunchTrial?: () => void;
}

export const BetaAccessModal: React.FC<BetaAccessModalProps> = ({
  isOpen,
  onClose,
  tierId,
  defaultName = '',
  defaultEmail = '',
  onLaunchTrial,
}) => {
  const tier = TIERS[tierId] || TIERS.starter;

  const [fullName, setFullName] = useState(defaultName);
  const [workEmail, setWorkEmail] = useState(defaultEmail);
  const [hiringNote, setHiringNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName(defaultName || '');
      setWorkEmail(defaultEmail || '');
      setHiringNote('');
      setErrorMsg(null);
      setReferenceId(null);
    }
  }, [isOpen, tierId, defaultName, defaultEmail]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = workEmail.trim();

    if (!cleanName) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid work email address.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const descriptionLines = [
      `Requested Beta Plan: ${tier.name} ($${tier.usdPrice} / ₹${tier.inrPrice.toLocaleString('en-IN')})`,
      `Capacity: ${tier.evaluations} Resume Evaluations + ${tier.interviewQuestions} AI Interview Guides`,
      hiringNote.trim() ? `Hiring Context / Notes: ${hiringNote.trim()}` : 'Hiring Context / Notes: Not specified',
    ];

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'beta_access',
          name: cleanName,
          email: cleanEmail,
          description: descriptionLines.join('\n'),
          telemetry: {
            source: 'public_beta_modal',
            requestedTier: tier.id,
            usdPrice: tier.usdPrice,
            inrPrice: tier.inrPrice,
            url: typeof window !== 'undefined' ? window.location.pathname : '',
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit your beta request. Please try again.');
      }

      setReferenceId(data.referenceId || 'BETA-REQ');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while submitting request.');
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-access-modal-title"
    >
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-2xl bg-[#0F131D] border border-sky-500/30 shadow-2xl shadow-sky-950/50 p-5 sm:p-6 z-10 my-auto text-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Status Indicator */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold mb-3">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Public Beta • Gateway Verification In Progress</span>
        </div>

        <h2 id="beta-access-modal-title" className="text-xl font-bold text-white tracking-tight">
          {referenceId ? 'Early-Access Request Received' : `Founding Beta Access — ${tier.name}`}
        </h2>

        {referenceId ? (
          <div className="mt-4 space-y-5">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-emerald-300">
                  Your priority request is logged ({referenceId})
                </p>
                <p className="text-slate-300 leading-relaxed">
                  We have notified <span className="font-mono text-cyan-300">vathmossupport@gmail.com</span> with your request for{' '}
                  <strong className="text-white">{tier.name}</strong> (${tier.usdPrice} / ₹{tier.inrPrice.toLocaleString('en-IN')}). Our team will reach out to <strong className="text-white">{workEmail}</strong> shortly with founding onboarding access.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
              <p className="font-semibold text-white">Start screening right now for free:</p>
              <p className="text-slate-400 leading-relaxed">
                Your Free Public Beta allowance includes <strong className="text-cyan-300">5 Resume Evaluations</strong>, <strong className="text-cyan-300">5 AI Interview Guides</strong>, and all 3 scoring modes (Standard, Strict, Lenient) with zero card required.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              {onLaunchTrial && (
                <button
                  type="button"
                  onClick={onLaunchTrial}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold transition shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Start 5 Free Evaluations Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Vathmos is currently in <strong className="text-slate-200">Public Beta</strong> while live card &amp; UPI payment settlement finishes final verification. Request founding access for{' '}
              <strong className="text-white">{tier.name}</strong> (${tier.usdPrice} / ₹{tier.inrPrice.toLocaleString('en-IN')}) below, or jump straight into your free beta workspace.
            </p>

            {/* Tier Snapshot */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>{tier.name}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {tier.evaluations.toLocaleString()} Evaluations • {tier.interviewQuestions} AI Interview Guides
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-extrabold text-white font-mono">
                  ${tier.usdPrice} / ₹{tier.inrPrice.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">Founding Rate Locked</div>
              </div>
            </div>

            {/* Free Beta Trial Highlight */}
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-2.5 text-[11px] text-slate-300">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-white">5 Resume Evaluations + 5 AI Interview Guides</strong> are unlocked &amp; active immediately on the Free Beta tier — no payment required today.
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="beta-full-name" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  id="beta-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Priya Sharma"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none text-xs text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label htmlFor="beta-work-email" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Work Email *
                </label>
                <input
                  id="beta-work-email"
                  type="email"
                  required
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none text-xs text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label htmlFor="beta-hiring-note" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Hiring Role or Monthly Screening Volume (Optional)
                </label>
                <textarea
                  id="beta-hiring-note"
                  rows={2}
                  value={hiringNote}
                  onChange={(e) => setHiringNote(e.target.value)}
                  placeholder="e.g., Screening 120 sales & backend candidates this month..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none text-xs text-white placeholder-slate-500 resize-none"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-60 text-white text-xs font-bold transition shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Request Founding Beta Access</span>
                    </>
                  )}
                </button>

                {onLaunchTrial && (
                  <button
                    type="button"
                    onClick={onLaunchTrial}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Use Free Beta (5 Evals)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
