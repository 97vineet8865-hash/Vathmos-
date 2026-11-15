import React, { useState } from 'react';
import { Check, Sparkles, Zap, Shield, Crown, X, ArrowRight, Award, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { openRazorpayCheckout, TIERS } from '../utils/razorpayService';

export const OnboardingPricingModal: React.FC = () => {
  const { currentUser, isOnboardingModalOpen, closeOnboardingModal, dismissOnboarding, upgradeTier } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'starter' | 'pro' | 'agency'>('pro');

  if (!isOnboardingModalOpen || !currentUser) {
    return null;
  }

  const handleSelectPaidTier = (tierId: 'starter' | 'pro' | 'agency') => {
    setIsProcessing(true);
    openRazorpayCheckout({
      tierId,
      customerEmail: currentUser.email,
      customerPhone: '',
      onSuccess: (paymentData) => {
        setIsProcessing(false);
        upgradeTier(tierId, paymentData.razorpay_payment_id);
      },
      onDismiss: () => {
        setIsProcessing(false);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Dimmed backdrop */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={dismissOnboarding}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-5xl bg-[#0F131D] border border-blue-500/20 rounded-2xl shadow-2xl shadow-blue-950/50 p-5 sm:p-7 md:p-8 z-10 my-auto overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={dismissOnboarding}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-white p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
          title="Close and explore free plan"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Welcome to Vathmos</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Choose Your Recruiter Plan
          </h2>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            Welcome, <span className="text-blue-400 font-semibold">{currentUser.name || 'Recruiter'}</span>! 
            Select the evaluation capacity tailored to your hiring pipeline. You can start with our 
            <span className="text-gray-200"> Free Trial</span> or choose a high-capacity hiring pass.
          </p>
        </div>

        {/* 4 Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          
          {/* Card 1: Free Trial */}
          <div className="relative rounded-xl border border-gray-800 bg-[#141926]/80 p-5 flex flex-col justify-between hover:border-gray-700 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Trial</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-gray-300">
                  Free Forever
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">Free Explorer</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">$0</span>
                <span className="text-xs text-gray-400">/ forever</span>
              </div>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                Test our 100-point rubric on your first candidate shortlist.
              </p>

              <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>5</strong> Resume Evaluations</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>5</strong> AI Interview Guides (15 Qs)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Full 3-Mode Scoring Calibration (Standard / Strict / Lenient)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>100-Point Mathematical Rubric</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={dismissOnboarding}
                className="w-full py-2.5 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Continue Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Starter Pass ($39) */}
          <div className="relative rounded-xl border border-blue-900/40 bg-[#141926]/80 p-5 flex flex-col justify-between hover:border-blue-700/60 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Pass</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/70 text-blue-300 border border-blue-800/50">
                  Sprint Hiring
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">Starter Pass</h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">$39</span>
                <span className="text-xs text-gray-400">₹3,705</span>
                <span className="text-[11px] text-gray-500 ml-auto">One-time</span>
              </div>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                Ideal for a focused hiring sprint or single engineering role.
              </p>

              <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>150</strong> Resume Evaluations</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>80</strong> AI Interview Guides (240 Qs)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-300/90 font-medium">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>3-Mode Calibration: Standard only (🔒 Strict & Lenient locked)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Bulk Upload & Batch Ranking</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>JD Alignment & Gaps Radar</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={() => handleSelectPaidTier('starter')}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Select Starter ($39)</span>
              </button>
            </div>
          </div>

          {/* Card 3: Pro Recruiter ($79) - MOST POPULAR */}
          <div className="relative rounded-xl border-2 border-blue-500 bg-gradient-to-b from-[#162033] to-[#0F1420] p-5 flex flex-col justify-between shadow-xl shadow-blue-900/30 scale-[1.02] transform">
            {/* Most popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/50">
                <Crown className="w-3 h-3 text-amber-300" />
                <span>Most Popular</span>
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 mt-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">Recommended</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/40">
                  Best Value
                </span>
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                <span>Pro Recruiter</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">$79</span>
                <span className="text-xs text-blue-300">₹7,505</span>
                <span className="text-[11px] text-gray-400 ml-auto">One-time</span>
              </div>
              <p className="mt-2 text-xs text-gray-300 leading-relaxed">
                Full-scale evaluation capacity for active agencies and startups.
              </p>

              <div className="mt-4 pt-4 border-t border-blue-500/30 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-white font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>400</strong> Resume Evaluations</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>250</strong> AI Interview Guides (750 Qs)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span><strong>Full 3-Mode Calibration:</strong> Standard / ⚡ Strict / Lenient</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Strict Evidence Quotation Verification</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <Check className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Priority Scoring Speed</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={() => handleSelectPaidTier('pro')}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Select Pro ($79)</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </div>
          </div>

          {/* Card 4: Agency & Scale ($119) */}
          <div className="relative rounded-xl border border-indigo-900/40 bg-[#141926]/80 p-5 flex flex-col justify-between hover:border-indigo-700/60 transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Scale</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-950/70 text-indigo-300 border border-indigo-800/50">
                  High Volume
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">Agency & Scale</h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">$119</span>
                <span className="text-xs text-gray-400">₹11,305</span>
                <span className="text-[11px] text-gray-500 ml-auto">One-time</span>
              </div>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                Maximum capacity for recruiting agencies & enterprise teams.
              </p>

              <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong>1,000</strong> Resume Evaluations</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-300">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong>750</strong> AI Interview Guides (2,250 Qs)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-white font-medium">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong>White-Label Candidate & Leaderboard PDF Reporting</strong> (Custom Agency Logo & Name)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong>Full 3-Mode Calibration:</strong> Standard / ⚡ Strict / Lenient</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-200">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div>
                      <strong className="text-white">Dedicated Support</strong>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-gray-400">
                      <li>• Priority handling of bug reports</li>
                      <li>• Direct support through dedicated email: <span className="text-indigo-300 font-mono">vathmossupport@gmail.com</span></li>
                      <li>• Faster responses to critical problems (&lt; 24 hrs)</li>
                      <li>• Help with account or batch-processing issues</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-2">
              <button
                type="button"
                onClick={() => handleSelectPaidTier('agency')}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Select Agency ($119)</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer / Helper Note */}
        <div className="pt-4 border-t border-gray-800/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Encrypted 256-bit checkout via Razorpay • 100% money-back guarantee • No recurring fees</span>
          </div>

          <button
            onClick={dismissOnboarding}
            className="text-gray-400 hover:text-gray-200 underline transition-colors"
          >
            I'll decide later, explore Free Plan
          </button>
        </div>
      </div>
    </div>
  );
};
