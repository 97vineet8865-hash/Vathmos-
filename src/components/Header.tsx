import React from 'react';
import { RefreshCw, SlidersHorizontal, UserPlus, LogIn, ChevronDown, Shield, Home } from 'lucide-react';
import { Link } from '../router/RouterContext';
import { useAuth } from '../context/AuthContext';
import { VathmosLogo } from './VathmosLogo';

interface HeaderProps {
  onReset: () => void;
  onOpenSettings: () => void;
  onOpenLegalModal?: () => void;
  isEvaluating: boolean;
  hasData: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onOpenSettings,
  onOpenLegalModal,
  isEvaluating,
  hasData,
}) => {
  const { currentUser, openAuthModal, openProfileModal } = useAuth();
  const [isLightMode, setIsLightMode] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('vathmos_theme') === 'light';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      if (isLightMode) {
        document.documentElement.classList.add('vathmos-light');
        document.body.classList.add('bg-slate-50', 'text-slate-900');
        document.body.classList.remove('bg-[#0A0C11]', 'text-[#F3F4F6]');
        localStorage.setItem('vathmos_theme', 'light');
      } else {
        document.documentElement.classList.remove('vathmos-light');
        document.body.classList.remove('bg-slate-50', 'text-slate-900');
        document.body.classList.add('bg-[#0A0C11]', 'text-[#F3F4F6]');
        localStorage.setItem('vathmos_theme', 'dark');
      }
    } catch {}
  }, [isLightMode]);

  const toggleTheme = () => setIsLightMode((prev) => !prev);


  const getInitials = (n: string) => {
    return n
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="border-b border-white/[0.07] bg-[#0A0C11]/80 backdrop-blur-xl sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group cursor-pointer" title="Back to Vathmos Home">
          <VathmosLogo size="md" className="transition-transform duration-200 group-hover:scale-[1.03]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-cyan-400 transition">
                Vathmos
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 tracking-tight">
                100-Point Rubric
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                v2.4 Enterprise Live
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block font-normal">
              Objective Recruitment Decision-Support System
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
            title="Back to Marketing Home"
          >
            <Home className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          {onOpenLegalModal && (
            <button
              type="button"
              id="header-legal-charter-btn"
              onClick={onOpenLegalModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all cursor-pointer shadow-2xs"
              title="View In-RAM Ephemeral Processing, Privacy & Fair Evaluation Charter"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Privacy &amp; Safeguards</span>
            </button>
          )}

          <button
            type="button"
            id="open-settings-drawer-btn"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer shadow-2xs hover:text-white"
            title="Open filters, controls & future extensions"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Options & Tools</span>
          </button>

          {hasData && (
            <button
              type="button"
              id="clear-workspace-btn"
              onClick={onReset}
              disabled={isEvaluating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent hover:border-white/[0.08] transition-all disabled:opacity-50 cursor-pointer"
              title="Clear all fields and restart"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Workspace</span>
            </button>
          )}

          {/* User Authentication & Profile Trigger */}
          {currentUser ? (
            <button
              type="button"
              id="user-profile-header-btn"
              onClick={openProfileModal}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer shadow-2xs group"
              title="View recruiter profile & settings"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shadow-xs shrink-0"
                style={{ backgroundColor: currentUser.avatarColor || '#3B82F6' }}
              >
                {getInitials(currentUser.name)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xs font-bold text-zinc-100 group-hover:text-white truncate max-w-[110px]">
                    {currentUser.name}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                    currentUser.tier === 'agency'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : currentUser.tier === 'pro'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : currentUser.tier === 'starter'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {currentUser.tier ? `${currentUser.tier} Plan` : 'Free Tier'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono leading-tight truncate max-w-[170px] mt-0.5">
                  <span className="text-cyan-400">
                    {Math.max(0, (currentUser.evaluationsLimit ?? 5) - (currentUser.evaluationsUsed ?? 0))} evals
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-emerald-400">
                    {Math.max(0, (currentUser.interviewQuestionsLimit ?? 5) - (currentUser.interviewQuestionsUsed ?? 0))} guides
                  </span>
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors ml-0.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="header-sign-in-btn"
                onClick={() => openAuthModal('signin')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                id="header-sign-up-btn"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
