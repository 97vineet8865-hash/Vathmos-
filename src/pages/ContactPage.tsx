import React, { useState } from 'react';
import { Mail, MapPin, Clock, ShieldCheck, Send, CheckCircle2, AlertCircle, ArrowLeft, ArrowUpRight, MessageSquare, PhoneCall, Building2 } from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';

export const ContactPage: React.FC = () => {
  const { navigate } = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Support & Inquiries');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      setSubmitError('Please enter your email and message.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: subject.toLowerCase().includes('billing') ? 'billing' : 'general',
          name: name.trim() || 'Website Visitor',
          email: email.trim(),
          description: `[Subject: ${subject}]\n\n${message.trim()}`,
          telemetry: {
            source: 'contact_page',
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSubmitSuccess(data.referenceId || data.report?.id || data.id || 'FB-SUBMITTED');
      setMessage('');
    } catch (err: any) {
      setSubmitError(err?.message || 'Could not send message. Please email directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <span className="text-xs text-slate-400">/ Contact Us</span>
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
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Header Hero */}
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Customer Support & Official Merchant Inquiries</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Contact Vathmos Technologies
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Have questions about enterprise evaluation bundles, billing, payment verification on Razorpay or Lemon Squeezy, or need technical onboarding support? Our team responds within 24 hours.
          </p>
        </div>

        {/* 2-Column Grid: Left is Official Details (Gateway Compliance), Right is Contact Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Official Business Details (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-400" />
                <span>Registered Merchant Information</span>
              </h2>

              {/* Entity Name */}
              <div className="space-y-1 text-xs">
                <p className="text-slate-400 font-medium">Platform & Service</p>
                <p className="text-white font-semibold text-sm">Vathmos</p>
                <p className="text-slate-400 text-[11px]">B2B Candidate Screening & Recruiter Co-Pilot (Operated under Sole Proprietorship)</p>
              </div>

              {/* Direct Support Email */}
              <div className="space-y-2 text-xs pt-3 border-t border-slate-800/80">
                <p className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>Official Support & Inquiries</span>
                </p>
                <a
                  href="mailto:vathmossupport@gmail.com"
                  className="text-cyan-400 hover:text-cyan-300 font-mono text-sm pl-6 block font-bold transition"
                >
                  vathmossupport@gmail.com
                </a>
                <p className="text-slate-500 text-[11px] pl-6">
                  Official inquiries, enterprise billing, and customer support. Response within 24 hours.
                </p>
              </div>

              {/* Leadership Desk */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 text-xs">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Operations & Engineering Desk</span>
                </p>
                <p className="text-slate-400 text-[11px]">
                  Leadership: <strong className="text-slate-200">Vathmos Core Team</strong><br />
                  Desk: <a href="mailto:vathmossupport@gmail.com" className="font-mono text-cyan-400 underline">vathmossupport@gmail.com</a>
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Contact Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white">Send Us a Direct Message</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Fill in the details below and our technical founding team will get right back to you.
                </p>
              </div>

              {submitSuccess ? (
                <div className="p-6 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-base text-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Message Dispatched Successfully!</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Thank you for reaching out. Your inquiry has been logged in our support inbox with Reference ID <strong className="font-mono text-white bg-emerald-900/50 px-2 py-0.5 rounded">{submitSuccess}</strong>. We will reply to your email within 24 hours.
                  </p>
                  <div className="flex items-center gap-3 pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSubmitSuccess(null)}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-200 underline cursor-pointer"
                    >
                      Send another message
                    </button>
                    <span className="text-slate-600">•</span>
                    <a
                      href={`mailto:vathmossupport@gmail.com?subject=Vathmos%20Inquiry%20%5B${submitSuccess}%5D`}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-200 inline-flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Also copy directly to Gmail</span>
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Your Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Inquiry Subject</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition cursor-pointer"
                    >
                      <option value="General Support & Inquiries">General Support & Inquiries</option>
                      <option value="Starter Pass ($39) & Payment Assistance">Starter Pass ($39 / ₹3,100) & Payment Assistance</option>
                      <option value="Razorpay / Lemon Squeezy Gateway Inquiry">Razorpay / Lemon Squeezy Gateway Inquiry</option>
                      <option value="Enterprise / Agency Custom Volume Tier">Enterprise / Agency Custom Volume Tier</option>
                      <option value="Bug Report & Technical Feedback">Bug Report & Technical Feedback</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Message Details <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your recruitment volume, questions, or how we can assist..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition resize-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold shadow-md hover:from-sky-400 hover:to-indigo-500 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{isSubmitting ? 'Sending Message...' : 'Send Message to Vathmos'}</span>
                    </button>

                    <a
                      href={`mailto:vathmossupport@gmail.com?subject=${encodeURIComponent(
                        subject ? `[Vathmos] ${subject}` : 'Vathmos Inquiry'
                      )}&body=${encodeURIComponent(
                        `Sender: ${name || 'N/A'}\nEmail: ${email || 'N/A'}\n\nMessage:\n${message}`
                      )}`}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Or Send via Gmail / Email App</span>
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Legal Links Footer */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-slate-300 transition">Terms of Service</Link>
            <span>•</span>
            <Link href="/refund" className="hover:text-slate-300 transition">Refund & Cancellation Policy</Link>
          </div>
          <p>© {new Date().getFullYear()} Vathmos Technologies. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
};
