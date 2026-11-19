import React, { useState } from 'react';
import { MessageSquareHeart, CheckCircle2, X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const QUICK_REVIEW_STORAGE_KEY = 'vathmos_quick_review_done_v1';

interface QuickReviewPromptProps {
  hasCompletedEvaluation: boolean;
}

export const QuickReviewPrompt: React.FC<QuickReviewPromptProps> = ({
  hasCompletedEvaluation,
}) => {
  const { currentUser } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(QUICK_REVIEW_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [clarity, setClarity] = useState<'Crystal clear' | 'Mostly clear' | 'A bit confusing' | ''>('');
  const [accuracy, setAccuracy] = useState<'Spot on' | 'Good' | 'Needs work' | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!hasCompletedEvaluation || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(QUICK_REVIEW_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarity && !accuracy && !note.trim()) return;
    setSubmitting(true);

    const summaryLines = [
      `[Quick Post-Evaluation Check]`,
      `Understood what Vathmos is built for: ${clarity || 'Not selected'}`,
      `100-pt score & quote accuracy: ${accuracy || 'Not selected'}`,
      note.trim() ? `Comment: ${note.trim()}` : 'Comment: (none)',
    ].join('\n');

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'general',
          description: summaryLines,
          email: currentUser?.email || 'Guest Recruiter',
          name: currentUser?.name || 'Recruiter',
          telemetry: {
            source: 'post_eval_quick_review',
            tier: currentUser?.tier || 'free',
            clarity,
            accuracy,
          },
        }),
      });
    } catch {
      // Non-blocking
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      try {
        localStorage.setItem(QUICK_REVIEW_STORAGE_KEY, '1');
      } catch {
        // ignore
      }
      setTimeout(() => {
        setDismissed(true);
      }, 2400);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl bg-emerald-950/35 border border-emerald-500/35 p-4 flex items-center gap-3 text-xs text-emerald-200">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="font-bold text-white">Thank you for your quick review!</p>
          <p className="text-emerald-300/80">Your feedback goes straight to the Vathmos founder.</p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-[#12151E]/90 backdrop-blur-md border border-indigo-500/25 p-4 sm:p-5 space-y-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
            <MessageSquareHeart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Quick 10-Second Check — How did Vathmos do?
            </h4>
            <p className="text-[11px] text-zinc-400">
              Help us improve scoring clarity for your hiring workflow.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          aria-label="Dismiss quick review"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-zinc-300">
            1. Was it clear what Vathmos is built for?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(['Crystal clear', 'Mostly clear', 'A bit confusing'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setClarity(opt)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  clarity === opt
                    ? 'bg-indigo-600 text-white border-indigo-400'
                    : 'bg-[#0E1018] text-zinc-300 border-white/[0.08] hover:border-indigo-500/40'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-zinc-300">
            2. Did the 100-pt score &amp; quotes feel accurate?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(['Spot on', 'Good', 'Needs work'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setAccuracy(opt)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                  accuracy === opt
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-[#0E1018] text-zinc-300 border-white/[0.08] hover:border-emerald-500/40'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: 1 thing we should improve or add..."
          maxLength={400}
          className="flex-1 px-3 py-2 rounded-xl bg-[#0E1018] border border-white/[0.08] focus:border-indigo-500 text-xs text-white placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || (!clarity && !accuracy && !note.trim())}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-xs font-semibold transition cursor-pointer shrink-0"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send Review</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
