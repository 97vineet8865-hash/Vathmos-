import React, { useState } from 'react';
import { X, Copy, Check, FileCode, CheckCircle2 } from 'lucide-react';
import { EvaluationResult } from '../types';

interface JsonOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: EvaluationResult | null;
  candidateName: string;
}

export const JsonOutputModal: React.FC<JsonOutputModalProps> = ({
  isOpen,
  onClose,
  result,
  candidateName,
}) => {
  const [copiedMode, setCopiedMode] = useState<'strict' | 'full' | null>(null);
  const [activeTab, setActiveTab] = useState<'strict' | 'full'>('strict');

  if (!isOpen || !result) return null;

  // Strict output specified in the user prompt:
  // score, matched_skills, pros (3 strengths), cons (3 gaps), and rank_reasoning (2 sentences)
  const strictJson = {
    score: result.score,
    matched_skills: result.matched_skills,
    pros: result.pros,
    cons: result.cons,
    rank_reasoning: result.rank_reasoning,
  };

  const strictString = JSON.stringify(strictJson, null, 2);
  const fullString = JSON.stringify(result, null, 2);

  const copyToClipboard = (mode: 'strict' | 'full') => {
    const textToCopy = mode === 'strict' ? strictString : fullString;
    navigator.clipboard.writeText(textToCopy);
    setCopiedMode(mode);
    setTimeout(() => setCopiedMode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#10131B] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-white/[0.08] overflow-hidden text-zinc-100">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between bg-[#0E1018]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
              <FileCode className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                JSON Decision-Support Output
              </h3>
              <p className="text-xs text-zinc-400">
                Candidate: {candidateName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-white/[0.06] bg-[#0E1018]/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('strict')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'strict'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              Strict Schema (Prompt Format)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('full')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'full'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              Full Rubric Audit JSON
            </button>
          </div>

          <button
            type="button"
            id="copy-modal-json-btn"
            onClick={() => copyToClipboard(activeTab)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white border border-white/[0.08] transition-colors cursor-pointer"
          >
            {copiedMode === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>

        {/* JSON Code Viewer */}
        <div className="flex-1 overflow-auto p-4 bg-[#080A10] text-zinc-100 font-mono text-xs leading-relaxed border-y border-white/[0.04]">
          <pre className="selection:bg-blue-600/30 selection:text-white">
            {activeTab === 'strict' ? strictString : fullString}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0E1018]/90 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Validated JSON response conforming to schema
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 hover:text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
