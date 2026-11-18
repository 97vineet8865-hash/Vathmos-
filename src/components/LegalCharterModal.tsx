import React, { useState } from 'react';
import { X, Shield, Cpu, Lock, CheckCircle2, Scale, Eye, UserCheck, AlertTriangle, FileText } from 'lucide-react';

interface LegalCharterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalCharterModal: React.FC<LegalCharterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ram' | 'privacy' | 'antibias' | 'ai_ethics' | 'terms'>('ram');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-[#10131B] rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-white/[0.1] overflow-hidden text-zinc-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-charter-title"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0E1018]/95">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="legal-charter-title" className="text-base font-bold text-white">
                  Privacy, Anti-Bias &amp; Safeguards Charter
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Active Shield
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Vathmos Decision-Support Architecture • In-RAM Ephemeral Processing Principles
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-[#12151E] border-b border-white/[0.06] overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('ram')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ram'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>In-RAM Processing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy &amp; Deletion</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('antibias')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'antibias'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Fairness &amp; Anti-Bias</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai_ethics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ai_ethics'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Zero Model Training</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Human-in-the-Loop Shield</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed text-zinc-300">
          {/* TAB 1: IN-RAM EPHEMERAL PROCESSING */}
          {activeTab === 'ram' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-200">
                <div className="flex items-center gap-2 font-bold text-white text-sm mb-1">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  Volatile RAM-Only Data Lifecycle — Our Standout Architecture
                </div>
                <p className="text-xs text-blue-200/90 leading-normal">
                  Unlike traditional recruitment platforms that store candidate resumes in databases, cloud buckets, or disk drives, Vathmos processes candidate documentation strictly within volatile in-memory buffers (RAM).
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Key Technical Guarantees
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-white font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Zero Disk Persistence
                    </div>
                    <p className="text-zinc-400 leading-normal">
                      Candidate PDFs, DOCX files, and raw text are never written to any persistent storage volume, database table, or disk file.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-white font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Immediate Buffer Eviction
                    </div>
                    <p className="text-zinc-400 leading-normal">
                      Once parsing and scoring benchmarks are evaluated, server-side memory buffers are marked for immediate garbage collection.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-white font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Client-Side Session Isolation
                    </div>
                    <p className="text-zinc-400 leading-normal">
                      Candidate evaluation state lives exclusively in the recruiter’s local browser memory. Closing the browser tab or clearing the candidate list discards all record traces.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-white font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Encrypted In-Flight Only
                    </div>
                    <p className="text-zinc-400 leading-normal">
                      All communication between client and server occurs over TLS/HTTPS with standard encryption in transit. No static cache remains.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0E1018] border border-white/[0.08] text-xs text-zinc-400 space-y-2">
                <span className="font-semibold text-white">Why This Matters for Recruiter Trust:</span>
                <p>
                  Recruitment teams handle highly sensitive applicant details every day. By eliminating persistent candidate databases, Vathmos removes the attack surface for data breaches and protects candidate confidentiality end-to-end.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ZERO-RETENTION PRIVACY & DELETION */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                <div className="flex items-center gap-2 font-bold text-white text-sm mb-1">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  Zero-Retention Privacy &amp; Instant Data Deletion
                </div>
                <p className="text-xs text-emerald-200/90 leading-normal">
                  Vathmos is architected from the ground up to respect candidate privacy, minimize data exposure, and keep evaluations transparent.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Automatic Session-End Deletion
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Zero Storage
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Because Vathmos maintains <strong>zero persistent database records</strong> of candidate resumes or personal contact details, erasure happens automatically as soon as your session ends. No orphan records or disk backups retain candidate identities.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Human-Controlled Decisions Only (No Automated Rejections)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Advisory Only
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Vathmos operates exclusively as an <strong>advisory decision-support system</strong>. Scores, pros, cons, and interview questions exist solely to assist human reviewers. No employment offer, screening rejection, or hiring decision is ever automated by Vathmos.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Strict Data Minimization
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Strict Minimum
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Processing is strictly limited to the resume text provided for evaluating suitability against your target job description. No background profiling, social media scraping, or third-party tracking is performed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FAIRNESS & ANTI-BIAS SAFEGUARDS */}
          {activeTab === 'antibias' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                <div className="flex items-center gap-2 font-bold text-white text-sm mb-1">
                  <Scale className="w-4 h-4 text-amber-400" />
                  Skills-Only &amp; Fair Evaluation Safeguards
                </div>
                <p className="text-xs text-amber-200/90 leading-normal">
                  Vathmos enforces strict structural guardrails so every candidate is evaluated solely on job-relevant skills, experience depth, and verifiable work outcomes.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Personal Attributes Strictly Excluded
                </h3>
                
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Strict Exclusion of Personal &amp; Demographic Traits
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    Evaluation rubrics are restricted to job-relevant qualifications, domain proficiencies, and verifiable work history. The system never scores or infers:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-zinc-400">
                    <div className="p-2 rounded bg-black/40 border border-white/[0.04]">• Race &amp; Ethnicity</div>
                    <div className="p-2 rounded bg-black/40 border border-white/[0.04]">• Gender &amp; Sex</div>
                    <div className="p-2 rounded bg-black/40 border border-white/[0.04]">• Age</div>
                    <div className="p-2 rounded bg-black/40 border border-white/[0.04]">• Religion &amp; Creed</div>
                    <div className="p-2 rounded bg-black/40 border border-white/[0.04]">• Disability Status</div>
                    <div className="p-2 rounded bg-black/40 border border-white/[0.04]">• National Origin</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Anti-Keyword Stuffing &amp; Evidence-Based Rubric
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    To prevent superficial keyword gaming while treating all applicants fairly, scoring allocates <strong>30% strictly to verifiable evidence</strong> (metrics, shipped deliverables, scale, outcomes) rather than buzzword repetition.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Transparent, Auditable Evaluation Reasoning
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    Every score includes explicit line-item evidence: which stated requirements matched, which were missing, verbatim resume quotes, and a concise rationale for human review.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ZERO MODEL TRAINING */}
          {activeTab === 'ai_ethics' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200">
                <div className="flex items-center gap-2 font-bold text-white text-sm mb-1">
                  <Eye className="w-4 h-4 text-purple-400" />
                  Intellectual Property & Zero AI Model Training Guarantee
                </div>
                <p className="text-xs text-purple-200/90 leading-normal">
                  Uploaded candidate resumes, job descriptions, and proprietary employer evaluation criteria are strictly segregated from AI model training pipelines.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Zero Training / Zero Fine-Tuning
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    Customer data, applicant PII, and company job descriptions processed through the Vathmos platform are <strong>never used</strong> to train, retrain, fine-tune, or benchmark public foundation models or third-party AI models.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Zero Cross-Customer Data Leakage
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    Each candidate evaluation is executed within a strictly isolated, stateless request lifecycle. One organization’s resumes or job rubrics are never indexed, cross-referenced, or visible to any other organization.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
                  <div className="text-white font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    API Provider Data Protections
                  </div>
                  <p className="text-zinc-300 leading-relaxed">
                    Backend calls utilize enterprise API endpoints with zero data logging for model improvements, complying with commercial non-retention agreements.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HUMAN-IN-THE-LOOP & TERMS */}
          {activeTab === 'terms' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200">
                  <div className="flex items-center gap-2 font-bold text-white text-sm mb-1">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    Human-in-the-Loop Decision Shield &amp; Accountability
                  </div>
                  <p className="text-xs text-indigo-200/90 leading-normal">
                    Vathmos is an advisory technical decision-support tool. The human recruiter and employer organization remain solely responsible for all recruitment decisions.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="text-white font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      1. Advisory Benchmarks Only
                    </div>
                    <p className="text-zinc-300 leading-relaxed">
                      Evaluations, scores, skill match tallies, and interview questions generated by Vathmos are strictly decision-support benchmarks based on textual analysis. They do not constitute formal employment advice or guarantees of candidate competency.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="text-white font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      2. Mandatory Human Verification
                    </div>
                    <p className="text-zinc-300 leading-relaxed">
                      Interviewers and hiring managers must independently verify all claimed credentials, technical work samples, employment history, and references before extending employment offers or rejecting applicants.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="text-white font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      3. Employer Final Responsibility
                    </div>
                    <p className="text-zinc-300 leading-relaxed">
                      The employer organization retains full accountability for all final hiring determinations and fair workplace practices. Vathmos serves strictly as a scoring aid for human reviewers.
                    </p>
                  </div>
                </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0E1018]/95 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Revision 2026.4 • Verified Ephemeral In-RAM Protocol</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-[0.98]"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
