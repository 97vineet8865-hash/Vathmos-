import React, { useState } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Layers,
  Settings,
  ShieldAlert,
  BarChart3,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  minScoreFilter: number;
  onMinScoreFilterChange: (val: number) => void;
  strictnessMode: 'standard' | 'strict' | 'lenient';
  onStrictnessModeChange: (val: 'standard' | 'strict' | 'lenient') => void;
  autoExtractName: boolean;
  onToggleAutoExtractName: (val: boolean) => void;
}

export const SideDrawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  minScoreFilter,
  onMinScoreFilterChange,
  strictnessMode,
  onStrictnessModeChange,
  autoExtractName,
  onToggleAutoExtractName,
}) => {
  const { currentUser, openOnboardingModal } = useAuth();
  const isStarterTier = currentUser?.tier === 'starter';
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#10131B]/95 backdrop-blur-2xl shadow-2xl border-l border-white/[0.08] flex flex-col text-zinc-100">
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between bg-[#0E1018]/90">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shadow-xs">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Tool Settings & Extensions
                </h2>
                <p className="text-xs text-zinc-400">
                  Control scoring filters, presets & future modules
                </p>
              </div>
            </div>

            <button
              type="button"
              id="close-side-drawer-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Ranking Filters */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Leaderboard Score Filter
                </h3>
              </div>

              <div className="bg-[#0E1018]/80 border border-white/[0.06] rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-semibold text-white">
                  <span>Minimum Passing Score:</span>
                  <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/25 font-mono text-xs">
                    {minScoreFilter} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="5"
                  value={minScoreFilter}
                  onChange={(e) => onMinScoreFilterChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0 (All candidates)</span>
                  <span>50 (Marginal)</span>
                  <span>70 (Qualified)</span>
                  <span>85+ (Fit)</span>
                </div>
              </div>
            </div>

            {/* Section 2: AI Parsing & Extraction Rules */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  AI Parsing Preferences
                </h3>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-white/[0.06] bg-[#0E1018]/80 hover:bg-white/[0.03] cursor-pointer transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={autoExtractName}
                    onChange={(e) => onToggleAutoExtractName(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-sky-400 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Auto-Extract Candidate Names
                    </span>
                    <span className="text-[11px] text-zinc-400 leading-normal">
                      Automatically detects and extracts the real candidate name from the top header of pasted or uploaded resumes.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Section 3: Evaluation Strictness */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Evaluation Calibration Mode
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: 'standard',
                    label: 'Standard (Default)',
                    desc: 'Balanced 100-pt rubric',
                  },
                  {
                    id: 'strict',
                    label: 'Strict',
                    desc: 'Auditor discipline & gaps penalty',
                  },
                  {
                    id: 'lenient',
                    label: 'Lenient',
                    desc: 'Benefit of the doubt',
                  },
                ].map((mode) => {
                  const isLocked = isStarterTier && mode.id !== 'standard';
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        if (isLocked) {
                          setLockedNotice(
                            '3-Mode Calibration (⚡ Strict & Lenient) is locked on Starter ($39 / ₹3,705). Upgrade to Pro ($79 / ₹7,505) or Agency ($119 / ₹11,305) to unlock.'
                          );
                          return;
                        }
                        setLockedNotice(null);
                        onStrictnessModeChange(mode.id as any);
                      }}
                      className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer relative ${
                        strictnessMode === mode.id
                          ? 'border-sky-500/40 bg-sky-500/15 ring-1 ring-sky-500/30 text-white'
                          : isLocked
                          ? 'border-white/[0.04] bg-[#0E1018]/50 text-zinc-500 hover:text-zinc-400'
                          : 'border-white/[0.06] bg-[#0E1018]/80 hover:bg-white/[0.03] text-zinc-400 hover:text-white'
                      }`}
                      title={
                        isLocked
                          ? `${mode.label} calibration is locked on Starter tier. Available on Free Trial, Pro ($79 / ₹7,505), and Agency ($119 / ₹11,305).`
                          : mode.desc
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold block">{mode.label}</span>
                        {isLocked && <Lock className="w-3 h-3 text-amber-400/90 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-zinc-500 block leading-tight mt-0.5">
                        {isLocked ? 'Locked on Starter' : mode.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {lockedNotice && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{lockedNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openOnboardingModal();
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] whitespace-nowrap cursor-pointer transition shrink-0"
                  >
                    View Upgrade Plans
                  </button>
                </div>
              )}
            </div>

            {/* Section 4: Future Features & Extensibility Pipeline */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Upcoming Module Expansion Slots
                </h3>
              </div>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-2xl border border-dashed border-white/[0.08] bg-[#0E1018]/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Automated Interview Question Generator
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 font-medium border border-white/[0.06]">
                      Ready to Plug In
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Generate tailored behavioral & technical interview questions targeting candidate gaps and identified missing skills.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-dashed border-white/[0.08] bg-[#0E1018]/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      ATS / Google Drive Webhook Sync
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 font-medium border border-white/[0.06]">
                      Ready to Plug In
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Direct sync with Greenhouse, Lever, or Google Drive candidate folders for auto-batch evaluation.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-dashed border-white/[0.08] bg-[#0E1018]/60 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      PDF & DOCX Native OCR Parser
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 font-medium border border-white/[0.06]">
                      Ready to Plug In
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Direct binary parsing of PDF resumes without needing text conversion.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-white/[0.06] bg-[#0E1018]/90 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Settings persist for current session
            </span>
            <button
              type="button"
              id="apply-drawer-settings-btn"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
