import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CandidateItem, InterviewQuestion } from '../types';
import {
  Mic,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ChevronRight,
  Zap,
  Lock,
  FileText,
  User,
  Briefcase,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { buildFallbackInterviewQuestions } from '../utils/clientRubricEvaluator';

interface InterviewGeneratorViewProps {
  candidates: CandidateItem[];
  jobDescription: string;
  onOpenUpgradeModal?: () => void;
}

export const InterviewGeneratorView: React.FC<InterviewGeneratorViewProps> = ({
  candidates,
  jobDescription: defaultJobDescription,
  onOpenUpgradeModal,
}) => {
  const { currentUser, recordInterviewQuestionUsed, openAuthModal } = useAuth();

  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(() => {
    const firstEvaluated = candidates.find((c) => c.result);
    return firstEvaluated ? firstEvaluated.id : candidates[0]?.id || 'custom';
  });

  const [customName, setCustomName] = useState<string>('');
  const [customJobDesc, setCustomJobDesc] = useState<string>(defaultJobDescription || '');
  const [customResume, setCustomResume] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<InterviewQuestion[] | null>(null);
  const [lastTargetCandidate, setLastTargetCandidate] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Calculate limits
  const totalLimit = currentUser?.interviewQuestionsLimit ?? 5;
  const usedCount = currentUser?.interviewQuestionsUsed ?? 0;
  const remainingGenerations = Math.max(0, totalLimit - usedCount);
  const hasCredits = remainingGenerations > 0;

  // Selected candidate object
  const activeCandidate = candidates.find((c) => c.id === selectedCandidateId);

  const effectiveName =
    selectedCandidateId === 'custom'
      ? customName.trim() || 'Candidate'
      : activeCandidate?.name || 'Candidate';

  const effectiveJobDesc =
    selectedCandidateId === 'custom'
      ? customJobDesc.trim() || defaultJobDescription
      : defaultJobDescription || customJobDesc.trim();

  const effectiveResume =
    selectedCandidateId === 'custom'
      ? customResume.trim()
      : activeCandidate?.resumeText || '';

  const handleGenerate = async () => {
    if (!hasCredits) {
      setErrorMessage(
        `You have used all ${totalLimit} interview question guides on your ${
          currentUser?.tier ? currentUser.tier.toUpperCase() : 'FREE'
        } tier. Upgrade your tier to unlock 80, 250, or 750 candidate interview guides (up to 2,250 calibrated questions)!`
      );
      return;
    }

    if (!effectiveJobDesc.trim()) {
      setErrorMessage('Please provide a Job Description to calibrate role-specific interview questions.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const pros = activeCandidate?.result?.pros || [];
      const cons = activeCandidate?.result?.cons || [];
      const matched_skills = activeCandidate?.result?.matched_skills || [];
      const missing_skills = activeCandidate?.result?.missing_skills || [];

      let questionsList: InterviewQuestion[] = [];

      try {
        const response = await fetch('/api/generate-interview-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobDescription: effectiveJobDesc,
            candidateName: effectiveName,
            resumeText: effectiveResume,
            pros,
            cons,
            matched_skills,
            missing_skills,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            questionsList = data.questions;
          }
        }
      } catch (fetchErr) {
        console.log('Network note, falling back to local heuristic synthesis');
      }

      // If server returned empty or offline, generate calibrated role-aware fallback
      if (questionsList.length === 0) {
        questionsList = buildFallbackInterviewQuestions({
          jobDescription: effectiveJobDesc,
          pros,
          cons,
          matched_skills,
          missing_skills,
        });
      }

      setGeneratedQuestions(questionsList);
      setLastTargetCandidate(effectiveName);

      // Record 1 interview question generation credit used
      recordInterviewQuestionUsed(1);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to generate calibrated interview questions.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyAll = () => {
    if (!generatedQuestions || generatedQuestions.length === 0) return;
    const text = `# Vathmos Calibrated 3-Question Interview Guide: ${lastTargetCandidate}
Target Role: ${effectiveJobDesc.slice(0, 80)}...
Generated via Vathmos Calibrated Evaluation Engine

${generatedQuestions
  .map(
    (q, idx) => `---
${q.badge}
Target Focus: ${q.targetPoint}

QUESTION:
"${q.question}"

IDEAL BENCHMARK / WHAT TO LISTEN FOR:
${q.idealAnswer}

RED FLAG / RISK ALERT:
${q.caution}`
  )
  .join('\n\n')}

--------------------------------------------------
Notice: Benchmarks are decision-support guidelines. Verify candidate portfolios, reported metrics, and references independently.`
      .trim();

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingle = (q: InterviewQuestion, index: number) => {
    const text = `[Vathmos Interview Guide - ${lastTargetCandidate}]
${q.badge}
Target Focus: ${q.targetPoint}

QUESTION:
"${q.question}"

IDEAL BENCHMARK / WHAT TO LISTEN FOR:
${q.idealAnswer}

RED FLAG ALERT:
${q.caution}`;

    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleExportPdf = () => {
    if (!generatedQuestions || generatedQuestions.length === 0) return;

    const doc = new jsPDF();
    const margin = 14;
    let y = 16;

    // Header bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('VATHMOS CALIBRATED INTERVIEW GUIDE (3-QUESTION FORMULA)', margin, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Candidate: ${lastTargetCandidate} | Date: ${new Date().toLocaleDateString()}`, margin, 20);

    y = 36;

    generatedQuestions.forEach((q, idx) => {
      // Box header
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(margin, y, 182, 8, 'F');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(q.badge, margin + 4, y + 6);
      y += 12;

      // Target Focus
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Target Focus Area:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const targetLines = doc.splitTextToSize(q.targetPoint, 140);
      doc.text(targetLines, margin + 35, y);
      y += targetLines.length * 5 + 3;

      // Question
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199); // sky-600
      doc.text('Question to Ask:', margin, y);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(15, 23, 42);
      const qLines = doc.splitTextToSize(`"${q.question}"`, 140);
      doc.text(qLines, margin + 35, y);
      y += qLines.length * 5 + 4;

      // Ideal answer
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text('Ideal Benchmark:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const aLines = doc.splitTextToSize(q.idealAnswer, 140);
      doc.text(aLines, margin + 35, y);
      y += aLines.length * 4.5 + 3;

      // Caution / Red Flag
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text('Red Flag Alert:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const cLines = doc.splitTextToSize(q.caution, 140);
      doc.text(cLines, margin + 35, y);
      y += cLines.length * 4.5 + 8;
    });

    // Footer notice
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Notice: Vathmos is an objective decision-support platform. Always independently verify live code and references.',
      margin,
      285
    );

    doc.save(`Vathmos_Interview_Guide_${lastTargetCandidate.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Mic className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              AI Interview Question Generator
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
              3-Per-Time Formula
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Generate 3 calibrated, candidate-specific interview questions for every evaluation:
            <strong className="text-emerald-400 ml-1">1 Pro Verification</strong> (verifies claimed strengths) +
            <strong className="text-amber-400 ml-1">2 Gap Probes</strong> (exposes buzzword padding and tests critical requirements).
          </p>
        </div>

        {/* Tier & Remaining Credit Meter */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 shrink-0 flex flex-col items-start sm:items-end space-y-1.5 min-w-[200px]">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Current Plan:</span>
            <span className="font-extrabold uppercase px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300 border border-slate-700">
              {currentUser?.tier ? `${currentUser.tier} Plan` : 'Free Tier'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-white">{remainingGenerations}</span>
            <span className="text-xs text-slate-400">/ {totalLimit} generations left</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                hasCredits ? 'bg-cyan-400' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, (remainingGenerations / totalLimit) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Error or Limit Exhausted Notice */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-bold">Notice: </span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Workspace Inputs & Generator Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Target Candidate & Role Source */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 lg:col-span-1">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              <span>Select Candidate to Interview</span>
            </label>
            <p className="text-[11px] text-slate-400">
              Choose an evaluated candidate from your active workspace or enter custom candidate data.
            </p>
          </div>

          <div className="space-y-2">
            <select
              value={selectedCandidateId}
              onChange={(e) => setSelectedCandidateId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.result ? `(Score: ${c.result.score}/100)` : '(Not Evaluated Yet)'}
                </option>
              ))}
              <option value="custom">✏️ Custom Candidate (Manual Entry)</option>
            </select>
          </div>

          {selectedCandidateId === 'custom' ? (
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Candidate Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Target Role / Job Requirements</label>
                <textarea
                  value={customJobDesc}
                  onChange={(e) => setCustomJobDesc(e.target.value)}
                  placeholder="Paste key role requirements or job description..."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Candidate Resume Excerpt / Skills</label>
                <textarea
                  value={customResume}
                  onChange={(e) => setCustomResume(e.target.value)}
                  placeholder="Paste candidate resume text or key claimed accomplishments..."
                  rows={4}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 focus:outline-hidden resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Selected:</span>
                <span className="font-bold text-white">{activeCandidate?.name}</span>
              </div>
              {activeCandidate?.result ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Rubric Score:</span>
                    <span className="font-extrabold text-cyan-400">{activeCandidate.result.score}/100</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-semibold">Top Strength: </span>
                    {activeCandidate.result.pros?.[0] || 'Demonstrated domain experience'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <span className="text-rose-400 font-semibold">Primary Gap: </span>
                    {activeCandidate.result.missing_skills?.[0] || activeCandidate.result.cons?.[0] || 'Target requirements'}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-amber-400/90 italic">
                  Tip: Evaluating this candidate on the 100-point rubric first will give even more calibrated interview questions.
                </p>
              )}
            </div>
          )}

          {/* Generator CTA */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !hasCredits}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                !hasCredits
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/20 active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing 3 Questions...</span>
                </>
              ) : !hasCredits ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>0 Generations Remaining (Upgrade Plan)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate 3-Question Interview Guide</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Consumes 1 of your {totalLimit} generations ({remainingGenerations} left).
            </p>
          </div>
        </div>

        {/* Right Column: Generated 3-Question Interview Dossier */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Calibrated 3-Question Interview Dossier</span>
                {lastTargetCandidate && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-medium">
                    for {lastTargetCandidate}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact interviewer prompts, what to listen for, and red flag warnings.
              </p>
            </div>

            {generatedQuestions && generatedQuestions.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  title="Copy all 3 questions to clipboard"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportPdf}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  title="Export interview guide as PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Generated Questions List */}
          {generatedQuestions && generatedQuestions.length > 0 ? (
            <div className="space-y-4">
              {generatedQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-3 relative group"
                >
                  {/* Card Header & Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${
                        q.type === 'pro_verification'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : idx === 1
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {q.badge}
                    </span>

                    <button
                      onClick={() => handleCopySingle(q, idx)}
                      className="opacity-80 hover:opacity-100 text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer text-[11px] flex items-center gap-1"
                      title="Copy this question"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Target Focus Area */}
                  <div className="text-xs">
                    <span className="text-slate-400 font-semibold">Target Area: </span>
                    <span className="text-slate-200">{q.targetPoint}</span>
                  </div>

                  {/* The Question Prompt */}
                  <div className="p-3.5 rounded-lg bg-sky-950/20 border border-sky-500/20">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-1">
                      Interviewer Prompt to Ask:
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                      "{q.question}"
                    </p>
                  </div>

                  {/* Ideal Answer & Red Flag Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/30 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Ideal Answer (What to Listen For)</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{q.idealAnswer}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/30 space-y-1">
                      <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Red Flag Alert (Buzzword Warning)</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{q.caution}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 px-6 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                <Mic className="w-6 h-6 text-sky-400" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-sm font-bold text-white">No Interview Questions Generated Yet</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Select a candidate on the left and click <strong className="text-white">"Generate 3-Question Interview Guide"</strong> to create 1 strength verification and 2 gap-probing questions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tier Limit Breakdown Card */}
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Interview Question Generator Limits Per Tier</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            • <strong className="text-slate-300">Free Tier:</strong> 5 generations (15 calibrated questions total)
            <br className="sm:hidden" />
            {' '}• <strong className="text-emerald-300">Starter ($39 / ₹3,705):</strong> 80 generations (240 questions)
            <br className="sm:hidden" />
            {' '}• <strong className="text-sky-300">Pro ($79 / ₹7,505):</strong> 250 generations (750 questions)
            <br className="sm:hidden" />
            {' '}• <strong className="text-indigo-300">Agency ($119 / ₹11,305):</strong> 750 generations (2,250 questions)
          </p>
        </div>

        <button
          onClick={onOpenUpgradeModal}
          className="px-4 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 hover:text-white text-xs font-bold transition shrink-0 cursor-pointer"
        >
          View All Tiers & Upgrade →
        </button>
      </div>
    </div>
  );
};
