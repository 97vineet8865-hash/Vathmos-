import { useAuth } from '../context/AuthContext';
import { openRazorpayCheckout, TIERS, IS_PUBLIC_BETA } from '../utils/razorpayService';
import { BetaAccessModal } from '../components/BetaAccessModal';
import { VathmosLogo } from '../components/VathmosLogo';
import React, { useState } from 'react';
import { CreditCard, 
  Shield, 
  Sparkles, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  Cpu, 
  Lock, 
  Zap, 
  Users, 
  Download, 
  ChevronRight, 
  Scale, 
  FileCheck, 
  Layers, 
  BarChart3, 
  ServerOff, 
  Flame, 
  Eye, 
  ExternalLink,
  Check,
  Star,
  Play,
  Mail
} from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';
import { trackEvent } from '../utils/analytics';

export const LandingPage: React.FC = () => {
  const [paymentSuccess, setPaymentSuccess] = useState<{ id: string; tierName: string } | null>(null);
  const [betaModalTier, setBetaModalTier] = useState<'starter' | 'pro' | 'agency' | null>(null);

  const { currentUser, upgradeTier } = useAuth();
  const handleSubscribe = (tierId: 'starter' | 'pro' | 'agency') => {
    trackEvent('upgrade_clicked', { tier: tierId }, currentUser?.tier || 'guest');
    if (IS_PUBLIC_BETA) {
      setBetaModalTier(tierId);
      return;
    }
    openRazorpayCheckout({
      tierId,
      customerEmail: currentUser?.email || 'vathmossupport@gmail.com',
      onSuccess: (res) => {
        upgradeTier(tierId, res.razorpay_payment_id);
        setPaymentSuccess({ id: res.razorpay_payment_id, tierName: res.tier.name });
      },
    });
  };

  const { navigate } = useRouter();
  const [selectedDemoCandidate, setSelectedDemoCandidate] = useState<'top' | 'gap'>('top');
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [pricingCycle, setPricingCycle] = useState<'usd' | 'inr'>('usd');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-white relative overflow-x-hidden">
      {/* Background ambient radial glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-sky-500/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[800px] left-0 w-[500px] h-[500px] bg-cyan-500/5 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[1800px] right-0 w-[600px] h-[600px] bg-indigo-500/5 blur-3xl pointer-events-none -z-10" />

      {/* 1. Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <VathmosLogo size="md" className="transition-transform duration-200 group-hover:scale-[1.03]" />
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">Vathmos</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  100-PT RUBRIC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal hidden sm:block">
                Evidence-Based Hiring for Tech & Business Teams
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-cyan-400 transition">Features</a>
            <a href="#demo" className="hover:text-cyan-400 transition">Interactive Demo</a>
            <a href="#pricing" className="hover:text-cyan-400 transition">Pricing</a>
            <a href="#compliance" className="hover:text-cyan-400 transition">Compliance</a>
            <Link href="/contact" className="hover:text-cyan-400 transition">Contact Us</Link>
          </nav>

          {/* Primary CTA Button */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/20 transition-all duration-150 cursor-pointer"
            >
              <span>Launch App</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center space-y-8">
        {/* Eyebrow Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-white font-black tracking-wide text-sm">Vathmos</span>
          <span className="text-slate-500">•</span>
          <span>
            {IS_PUBLIC_BETA
              ? 'Public Beta Live • Free 5-Eval Trial (Free Account)'
              : 'Catches AI Resume Fluff • Zero Black-Box Guessing'}
          </span>
        </div>

        {/* Catchy Headline */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08]">
            Screen Candidates With Proof,{' '}
            <span className="text-cyan-400 sm:bg-gradient-to-r sm:from-sky-400 sm:via-cyan-300 sm:to-indigo-400 sm:bg-clip-text sm:text-transparent">
              Not Keyword Guesswork.
            </span>
          </h1>
          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Upload a job description and a batch of resumes. Vathmos scores every candidate on a strict <strong className="text-white font-semibold">100-point evidence rubric</strong>, pulls exact quotes from their CV, and flags missing skills — so you stop wasting hours reading inflated resumes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-[0.98] text-white text-sm font-bold shadow-xl shadow-sky-500/25 transition-all cursor-pointer"
          >
            <span>Sign Up Free (5 Evals)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSampleModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 text-sm font-semibold transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>View Sample PDF Leaderboard</span>
          </button>
        </div>

        {/* Trust Badges */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exact Resume Citations (Backed by real quotes)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Consistent 100-Point Rubric (Zero random AI scores)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% Private (Resumes deleted right after audit)</span>
          </div>
        </div>

        {/* Hero Visual Container: Framed Dynamic Scorecard / Leaderboard Interface */}
        <div className="pt-8 max-w-5xl mx-auto">
          <div className="relative rounded-2xl bg-gradient-to-b from-slate-800/80 via-slate-900/60 to-slate-950 p-1 sm:p-2.5 shadow-2xl shadow-sky-500/10 border border-slate-800 group">
            {/* Window bar */}
            <div className="px-4 py-3 bg-slate-950/90 rounded-t-xl border-b border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-slate-400 font-mono text-[11px] ml-2">vathmos-screening-core://session/active-batch</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                  Standard 100-Point Rubric
                </span>
              </div>
            </div>

            {/* Scorecard Hero Mockup Content */}
            <div className="p-4 sm:p-6 bg-slate-950/70 rounded-b-xl text-left space-y-6">
              {/* Leaderboard Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Target Role: Principal Distributed Systems Engineer</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono">JD #4029</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluated against Consistent 100-Point Standard Rubric • Batch Leaderboard Top Match
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  <span>Open Full Dashboard</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Top Candidate Showcase Card */}
              <div className="p-5 rounded-xl bg-slate-900/90 border border-cyan-500/30 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-sm">
                      #1
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-extrabold text-white">Alex Rivera</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          QUALIFIED FOR ONSITE
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Senior Systems & Cloud Architect • 9 Years Experience</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <div className="text-right">
                      <span className="text-3xl sm:text-4xl font-extrabold text-cyan-400">92</span>
                      <span className="text-sm font-semibold text-slate-400">/100</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                      Top 2%
                    </span>
                  </div>
                </div>

                {/* 3 Pillars Breakdown Scores */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Hard Requirements</span>
                      <span className="font-bold text-sky-400">38 / 40</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                      <div className="bg-sky-400 h-1.5 rounded-full" style={{ width: '95%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">
                      ✓ Distributed Go/Rust, Raft consensus, Kubernetes
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Role & Industry Depth</span>
                      <span className="font-bold text-indigo-300">28 / 30</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                      <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: '93%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">
                      ✓ Multi-region partition fault tolerance, gRPC
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Measurable Impact</span>
                      <span className="font-bold text-emerald-400">26 / 30</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                      <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: '87%' }} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-1">
                      ✓ Reduced p99 latency by 44% at 1.2M QPS scale
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Feature Grid (3 Pillars) */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12 border-t border-slate-800/80">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Why Recruiters Switch to Vathmos</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Built for Recruiters Who Can't Afford Bad Shortlists
          </h2>
          <p className="text-sm text-slate-400">
            Traditional tools blindly match keywords. Vathmos audits real-world proof — whether you're hiring a Senior Engineer, Sales Lead, or Operations Manager.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="p-7 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/40 transition-all duration-300 space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Scale className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider">PILLAR 01</span>
              <h3 className="text-lg font-bold text-white">Evidence-Backed 100-Point Scorecard</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every candidate is graded across three clear areas: <strong className="text-slate-200">40 pts Hard Requirements</strong> (must-have skills), <strong className="text-slate-200">30 pts Role &amp; Domain Depth</strong> (real hands-on experience), and <strong className="text-slate-200">30 pts Measurable Impact</strong> (verified numbers and outcomes) — with direct quotes pulled straight from their resume.
            </p>
            <div className="pt-2 text-xs text-sky-300 flex items-center gap-1.5 font-semibold">
              <span>Zero black-box guessing</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-7 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ServerOff className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">PILLAR 02</span>
              <h3 className="text-lg font-bold text-white">100% Private (Zero Data Retention)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Candidate resumes and personal details are processed purely in temporary memory and <strong className="text-slate-200">wiped clean the second your report is generated</strong>. Files are never saved to disk or used to train AI models — keeping you aligned with client NDAs and strict privacy standards.
            </p>
            <div className="pt-2 text-xs text-emerald-300 flex items-center gap-1.5 font-semibold">
              <span>Transient In-Memory Privacy</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-7 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition-all duration-300 space-y-4 group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-indigo-400 uppercase tracking-wider">PILLAR 03</span>
              <h3 className="text-lg font-bold text-white">Client-Ready PDF Reports &amp; Interview Co-Pilot</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export clean, ranked candidate leaderboards in 1 click — complete with <strong className="text-slate-200">custom interview questions targeting each candidate's weak spots</strong>, red-flag alerts, and ready-to-send outreach or rejection emails.
            </p>
            <div className="pt-2 text-xs text-indigo-300 flex items-center gap-1.5 font-semibold">
              <span>Executive &amp; client ready</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Interactive Scorecard Comparison Demo */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10 border-t border-slate-800/80">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Zap className="w-3.5 h-3.5" />
            <span>Interactive Evaluation Sandbox</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            See How the 100-Point Audit Works Across Tech &amp; Business Roles
          </h2>
          <p className="text-xs text-slate-400">
            Switch between a verified Engineering candidate and a Non-Tech Sales candidate to see how Vathmos catches inflated AI buzzwords automatically.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex justify-center">
          <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 inline-flex flex-wrap justify-center items-center gap-1">
            <button
              onClick={() => setSelectedDemoCandidate('top')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedDemoCandidate === 'top'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tech Role: Alex Rivera (92 pts • Strong Hire)
            </button>
            <button
              onClick={() => setSelectedDemoCandidate('gap')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedDemoCandidate === 'gap'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Non-Tech Role: Maya Lin (48 pts • AI Fluff Caught)
            </button>
          </div>
        </div>

        {/* Card display */}
        <div className="max-w-4xl mx-auto p-6 sm:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6">
          {selectedDemoCandidate === 'top' ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white">Alex Rivera</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Tier 1 • High Recommendation
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Role: Principal Distributed Systems Engineer — Verified proof across Go, Raft consensus, and cost-saving metrics.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-3xl font-extrabold text-cyan-400">92 / 100</div>
                  <span className="text-[11px] text-slate-500 font-mono">CALIBRATION: STANDARD</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">Hard Requirements</span>
                    <span className="text-sky-400">38/40</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Exact quote: &quot;Engineered distributed stream pipeline in Go handling 850k events/sec with zero packet loss.&quot;
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">Role &amp; Industry Depth</span>
                    <span className="text-indigo-300">28/30</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Exact quote: &quot;Architected multi-DC failover clusters using Consul and eBPF network observability.&quot;
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">Measurable Impact</span>
                    <span className="text-emerald-400">26/30</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Exact quote: &quot;Cut compute cloud expenditure by $320,000 annually via memory compaction algorithms.&quot;
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-white">Maya Lin</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      Flagged • Vague AI Fluff Without Numbers
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Role: Enterprise Account Executive (Non-Tech) — Claims &quot;led global revenue growth&quot; with zero actual quota numbers or deal metrics.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-3xl font-extrabold text-rose-400">48 / 100</div>
                  <span className="text-[11px] text-slate-500 font-mono">CALIBRATION: STANDARD</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950 border border-rose-900/40 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">Hard Requirements</span>
                    <span className="text-rose-400">18/40 (Missing Proof)</span>
                  </div>
                  <p className="text-[11px] text-rose-300/80 leading-relaxed">
                    Gap identified: JD asks for Enterprise Quota Attainment &amp; Salesforce pipeline ownership — resume lists no CRM, territory size, or closing metrics.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">Role &amp; Industry Depth</span>
                    <span className="text-amber-400">18/30</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Uses generic buzzwords (&quot;spearheaded cross-functional sales synergies&quot;) without real enterprise deal cycle details.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-rose-900/40 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">Measurable Impact</span>
                    <span className="text-rose-400">12/30 (0 Metrics)</span>
                  </div>
                  <p className="text-[11px] text-rose-300/80 leading-relaxed">
                    Caught claim: &quot;Led global revenue growth across key regions&quot; — zero ARR figures, win rates, or % quota attainment verified.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12 border-t border-slate-800/80">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CreditCard className="w-3.5 h-3.5" />
            <span>
              {IS_PUBLIC_BETA
                ? 'Public Beta Pricing Preview • Gateway KYC In Progress'
                : 'Transparent Credit & Subscription Tiers'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {IS_PUBLIC_BETA
              ? 'Free Public Beta Open — Founding Pricing Locked'
              : 'Simple, High-Margin Pricing for Growing Teams'}
          </h2>
          <p className="text-sm text-slate-400">
            {IS_PUBLIC_BETA
              ? 'Create a free account to unlock 5 candidate evaluations & 5 AI interview guides. Online card & UPI checkout activates shortly — request founding beta access on any bundle below.'
              : 'No convoluted per-seat penalties. Pay for what you screen with instant digital delivery.'}
          </p>

          {/* Currency Toggle */}
          <div className="pt-2 flex justify-center">
            <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 inline-flex items-center gap-1 text-xs">
              <button
                onClick={() => setPricingCycle('usd')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  pricingCycle === 'usd' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Global USD ($)
              </button>
              <button
                onClick={() => setPricingCycle('inr')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  pricingCycle === 'inr' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                India INR (₹) • Fixed $1 = ₹95
              </button>
            </div>
          </div>
        </div>

        {/* Featured Starter Pass + Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
          {/* Card 1: Starter Pass (Primary Featured Tier) */}
          <div className="relative p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-sky-500/60 shadow-xl shadow-sky-500/10 flex flex-col justify-between space-y-6">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-[11px] font-extrabold tracking-wide uppercase shadow-md">
              Most Popular For Launch
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Starter Pass</h3>
                <p className="text-xs text-slate-400">
                  Ideal for solo recruiters, HR teams &amp; boutique agencies launching active candidate searches.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-4xl font-extrabold text-white">
                  {pricingCycle === 'usd' ? '$39' : '₹3,705'}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ 150 evaluations bundle</span>
              </div>

              <ul className="space-y-3 pt-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">150 Candidate Evaluations</strong> included</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">80 AI Role-Calibrated Interview Guides</strong> (240 targeted questions: 1 Pro + 2 Gap Probes per candidate)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400/90 shrink-0 mt-0.5" />
                  <span><strong className="text-amber-300">3-Mode Scoring Calibration:</strong> Standard only (🔒 Strict &amp; Lenient locked)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Consistent 100-Point Scorecard (Hard 40, Role Depth 30, Impact 30)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Exact Resume Citations (Verified quotes &amp; metric proofs)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>PDF Scorecard &amp; Pool Leaderboard export (Top 5 candidates)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>Recruiter Co-Pilot (Job offers, invitations, rejection notes)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>100% Private (Zero Data Retention &amp; In-RAM Privacy Guarantee)</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe('starter')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-bold transition shadow-md shadow-sky-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>
                {IS_PUBLIC_BETA
                  ? `🚀 Request Beta Access — ${pricingCycle === 'usd' ? '$39' : '₹3,705'}`
                  : `💳 Pay ${pricingCycle === 'usd' ? '$39' : '₹3,705'} - Get Starter Pass`}
              </span>
            </button>
          </div>

          {/* Card 2: Pro Tier */}
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Pro Recruiter</h3>
                <p className="text-xs text-slate-400">
                  For active hiring teams and staffing firms screening 100+ candidates weekly across any role.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-4xl font-extrabold text-white">
                  {pricingCycle === 'usd' ? '$79' : '₹7,505'}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ 400 evaluations bundle</span>
              </div>

              <ul className="space-y-3 pt-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">400 Candidate Evaluations</strong> included</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">250 AI Role-Calibrated Interview Guides</strong> (750 targeted questions with benchmark answers)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">Full 3-Mode Scoring Calibration</strong> (Standard / ⚡ Strict / Lenient)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Unlimited Candidate PDF Scorecards &amp; Full Pool Leaderboard exports</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>All Starter features + Priority email support desk</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe('pro')}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white text-xs font-bold transition border border-slate-700 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>
                {IS_PUBLIC_BETA
                  ? `🚀 Request Beta Access — ${pricingCycle === 'usd' ? '$79' : '₹7,505'}`
                  : `💳 Pay ${pricingCycle === 'usd' ? '$79' : '₹7,505'} - Choose Pro Tier`}
              </span>
            </button>
          </div>

          {/* Card 3: Agency Tier */}
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Agency &amp; Enterprise</h3>
                <p className="text-xs text-slate-400">
                  High-volume recruitment consultancies, HR departments, and enterprise hiring teams.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-4xl font-extrabold text-white">
                  {pricingCycle === 'usd' ? '$119' : '₹11,305'}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ 1,000 evaluations bundle</span>
              </div>

              <ul className="space-y-3 pt-3 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">1,000 Candidate Evaluations</strong> included (&lt; $0.12 / candidate)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">750 AI Role-Calibrated Interview Guides</strong> (2,250 targeted questions)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">White-Label Candidate & Leaderboard PDF Reporting</strong> (Custom Agency Logo & Company Name)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span><strong className="text-white">Full 3-Mode Scoring Calibration</strong> (Standard / ⚡ Strict / Lenient)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <span>High-Volume Parallel Screening for large candidate batches</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div>
                      <strong className="text-white">Dedicated Support</strong>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-slate-400">
                      <li>• Priority handling of bug reports</li>
                      <li>• Direct support through dedicated email: <span className="text-cyan-400 font-mono">vathmossupport@gmail.com</span></li>
                      <li>• Faster responses to critical problems (&lt; 24 hrs)</li>
                      <li>• Help with account or batch-processing issues</li>
                    </ul>
                  </div>
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe('agency')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-bold transition shadow-md shadow-sky-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>
                {IS_PUBLIC_BETA
                  ? `🚀 Request Beta Access — ${pricingCycle === 'usd' ? '$119' : '₹11,305'}`
                  : `💳 Pay ${pricingCycle === 'usd' ? '$119' : '₹11,305'} - Choose Agency Tier`}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* 6. Compliance & Privacy Banner */}
      <section id="compliance" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-slate-800/80">
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold">
              <Shield className="w-4 h-4" />
              <span>Candidate Privacy & Data Handling</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              Candidate Resumes Are Not Stored
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We only store your account email, name, and pricing tier. Resumes are processed in temporary memory to generate your evaluation and are immediately deleted.
            </p>
          </div>
          <Link
            href="/privacy"
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shrink-0"
          >
            Read Simple Privacy Policy →
          </Link>
        </div>
      </section>

      {/* 7. Compliance Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800/60">
            {/* Brand Logo & Name */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <VathmosLogo size="sm" />
                <span className="text-lg font-bold text-white tracking-tight">Vathmos Technologies</span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Evidence-backed candidate intelligence and objective hiring decision-support — built for engineering, sales, marketing, finance, and HR teams.
              </p>
            </div>

            {/* Direct Compliance Links */}
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 font-medium">
              <Link href="/privacy" className="hover:text-cyan-400 transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-cyan-400 transition">Terms of Service</Link>
              <Link href="/refund" className="hover:text-cyan-400 transition">Refund & Cancellation Policy</Link>
              <Link href="/contact" className="hover:text-cyan-400 transition">Contact Us</Link>
              <Link href="/dashboard" className="text-cyan-400 hover:text-cyan-300 font-bold transition flex items-center gap-1">
                <span>Launch App</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-slate-400 font-medium">
                © {new Date().getFullYear()} Vathmos. All rights reserved.
              </p>
              <p className="text-[11px] text-slate-500 max-w-xl">
                Consistent 100-point candidate screening engine. Resumes are processed in temporary memory and immediately deleted.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] shrink-0">
              <a href="mailto:vathmossupport@gmail.com" className="text-cyan-400 hover:text-cyan-300 transition font-mono">
                vathmossupport@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Sample PDF Leaderboard Modal Preview */}
      {sampleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 rounded-2xl max-w-2xl w-full p-6 border border-slate-800 shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base text-white">Sample Candidate Pool PDF Export</h3>
              </div>
              <button
                onClick={() => setSampleModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800/80 pb-2">
                <span>Leaderboard Rank</span>
                <span>Candidate</span>
                <span>Rubric Score</span>
                <span>Status</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/40">
                <span className="font-mono text-cyan-400 font-bold">#1 Top Match</span>
                <span className="font-bold text-white">Alex Rivera</span>
                <span className="font-mono text-cyan-400 font-bold">92 / 100</span>
                <span className="text-emerald-400">Onsite Qualified</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/40">
                <span className="font-mono text-slate-400">#2 Ranked</span>
                <span className="font-semibold text-white">Sarah Chen</span>
                <span className="font-mono text-sky-400 font-bold">86 / 100</span>
                <span className="text-emerald-400">Phone Screen</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="font-mono text-slate-400">#3 Ranked</span>
                <span className="font-semibold text-white">Jordan Smith</span>
                <span className="font-mono text-amber-400 font-bold">64 / 100</span>
                <span className="text-amber-400">Review Skill Gaps</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Every exported Vathmos PDF report features high-resolution vector charts, candidate interview question prompts, detected red-flag anomalies, and direct verbatim evidence excerpts from candidate CVs.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSampleModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  setSampleModalOpen(false);
                  navigate('/dashboard');
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold hover:from-sky-400 hover:to-indigo-500 transition cursor-pointer"
              >
                Open Dashboard & Export Real PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public Beta Founding Access Modal */}
      <BetaAccessModal
        isOpen={Boolean(betaModalTier)}
        tierId={betaModalTier || 'starter'}
        defaultName={currentUser?.name || ''}
        defaultEmail={currentUser?.email || ''}
        onClose={() => setBetaModalTier(null)}
        onLaunchTrial={() => {
          setBetaModalTier(null);
          navigate('/dashboard');
        }}
      />
    </div>
  );
};
