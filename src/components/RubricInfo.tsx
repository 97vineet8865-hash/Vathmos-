import React from 'react';
import { Target, Layers, CheckCircle2 } from 'lucide-react';

export const RubricInfo: React.FC = () => {
  return (
    <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06] mb-3.5">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            Objective 100-Point Evaluation Rubric
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Strict calibration prevents bias and aligns hiring decisions directly with job requirements.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono font-medium text-zinc-300 shadow-2xs">
          <span>Max Score:</span>
          <span className="font-bold text-sky-400">100 Pts</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Pillar 1 */}
        <div className="bg-[#0E1018]/80 border border-white/[0.06] rounded-xl p-3.5 shadow-2xs hover:border-white/[0.12] transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Target className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-zinc-200">Hard Requirements</span>
            </div>
            <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
              0 - 40 pts
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Direct mandatory skills, tools, certifications, education, and minimum years of experience required by the JD.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="bg-[#0E1018]/80 border border-white/[0.06] rounded-xl p-3.5 shadow-2xs hover:border-white/[0.12] transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-300 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-zinc-200">Domain Depth</span>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
              0 - 30 pts
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Direct relevance of past roles, project or business complexity, seniority ownership, and real-world domain familiarity.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="bg-[#0E1018]/80 border border-white/[0.06] rounded-xl p-3.5 shadow-2xs hover:border-white/[0.12] transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-zinc-200">Verifiable Evidence</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              0 - 30 pts
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Quantifiable metrics, verified outcomes, revenue or performance gains, and exact resume citations vs. vague buzzwords.
          </p>
        </div>
      </div>
    </div>
  );
};
