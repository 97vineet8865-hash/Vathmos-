import React, { useState } from 'react';
import {
  Trophy,
  ArrowRight,
  Download,
  Filter,
  AlertCircle,
  FileText,
  Sparkles,
  ChevronRight,
  Palette,
} from 'lucide-react';
import { CandidateItem } from '../types';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';

interface LeaderboardViewProps {
  candidates: CandidateItem[];
  selectedCandidateId: string;
  onSelectCandidate: (id: string) => void;
  minScoreFilter?: number;
  onMinScoreFilterChange?: (val: number) => void;
  strictnessMode?: 'standard' | 'strict' | 'lenient';
}

function toTitleCase(str: string): string {
  if (!str) return '';
  // Preserve disambiguation suffix like (2), (3)
  const suffixMatch = str.match(/\s*(\(\d+\))$/);
  const suffix = suffixMatch ? ` ${suffixMatch[1]}` : '';
  const base = str.replace(/\s*\(\d+\)$/, '').trim();
  const cleaned = base
    .split(/\s+/)
    .map((word) => {
      if (!word) return '';
      if (/^(II|III|IV|VI|VII|VIII|IX|X)$/i.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  return `${cleaned}${suffix}`;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  minScoreFilter = 0,
  onMinScoreFilterChange,
  strictnessMode = 'standard',
}) => {
  const { currentUser } = useAuth();
  const isWhiteLabelActive = Boolean(
    (currentUser?.tier === 'agency' || currentUser?.email === 'vathmossupport@gmail.com') &&
    currentUser?.whiteLabel?.enabled
  );
  const wl = currentUser?.whiteLabel;
  const agencyName = (wl?.companyName || currentUser?.companyName || 'Agency Partner').trim();
  const agencyTagline = (wl?.tagline || 'Candidate Pool Ranking Leaderboard').trim();
  const agencyContact = (wl?.contactEmail || currentUser?.email || '').trim();

  const [viewMode, setViewMode] = useState<'passing' | 'all'>(
    minScoreFilter > 0 ? 'passing' : 'all'
  );

  // Deduplicate evaluated candidates by unique id and unique resume content
  const seenIds = new Set<string>();
  const uniqueEvaluated = candidates.filter((c) => {
    if (c.result?.score === undefined) return false;
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  const allEvaluated = uniqueEvaluated
    .sort((a, b) => {
      const resA = a.result!;
      const resB = b.result!;

      // Primary sort: Total 100-point rubric score descending
      const scoreDiff = (resB.score || 0) - (resA.score || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      // Secondary sort / Tiebreaker 1: Verifiable Evidence
      const evidenceDiff =
        (resB.score_breakdown?.verifiable_evidence || 0) -
        (resA.score_breakdown?.verifiable_evidence || 0);
      if (evidenceDiff !== 0) {
        return evidenceDiff;
      }

      // Tiebreaker 2: Hard Requirements
      const hardReqDiff =
        (resB.score_breakdown?.hard_requirements || 0) -
        (resA.score_breakdown?.hard_requirements || 0);
      if (hardReqDiff !== 0) {
        return hardReqDiff;
      }

      // Tiebreaker 3: Domain Depth
      const domainDiff =
        (resB.score_breakdown?.domain_depth || 0) -
        (resA.score_breakdown?.domain_depth || 0);
      if (domainDiff !== 0) {
        return domainDiff;
      }

      // Fallback: Candidate Name alphabetical
      return a.name.localeCompare(b.name);
    });

  if (allEvaluated.length === 0) return null;

  const passingCandidates = allEvaluated.filter(
    (c) => (c.result?.score || 0) >= minScoreFilter
  );

  const displayedCandidates =
    minScoreFilter > 0 && viewMode === 'passing'
      ? passingCandidates
      : allEvaluated;

  const hiddenCount = allEvaluated.length - passingCandidates.length;

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-[#10B981]';
    if (score >= 60) return 'text-[#F59E0B]';
    return 'text-rose-400';
  };

  const getRecommendationBadge = (rec: string, score: number) => {
    if (score >= 80) {
      return {
        label: 'Strong Fit',
        style: 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30',
      };
    }
    if (score >= 65) {
      return {
        label: 'Qualified',
        style: 'bg-[#6366F1]/15 text-[#818CF8] border-[#6366F1]/30',
      };
    }
    if (score >= 50) {
      return {
        label: 'Marginal',
        style: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
      };
    }
    return {
      label: 'Unqualified',
      style: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    };
  };

  const handleExportCSV = () => {
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

    const headers = [
      'Rank',
      'Candidate Name',
      'Overall Score (100)',
      'Recommendation',
      'Hard Requirements (40)',
      'Domain Depth (30)',
      'Verifiable Evidence (30)',
      'Matched Skills',
      'Missing Skills',
      'Pros',
      'Cons',
      'Rank Reasoning',
      'File Name',
      'Evaluated At',
    ];

    const rows = displayedCandidates.map((candidate, index) => {
      const res = candidate.result!;
      const cleanName = toTitleCase(candidate.name);
      return [
        (index + 1).toString(),
        escapeCsv(cleanName),
        res.score.toString(),
        escapeCsv(res.recommendation),
        res.score_breakdown.hard_requirements.toString(),
        res.score_breakdown.domain_depth.toString(),
        res.score_breakdown.verifiable_evidence.toString(),
        escapeCsv((res.matched_skills || []).join('; ')),
        escapeCsv((res.missing_skills || []).join('; ')),
        escapeCsv((res.pros || []).join(' | ')),
        escapeCsv((res.cons || []).join(' | ')),
        escapeCsv(res.rank_reasoning || ''),
        escapeCsv(candidate.fileName || ''),
        escapeCsv(res.evaluated_at || new Date().toISOString()),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `vathmos-leaderboard-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleDateString();

    if (isWhiteLabelActive) {
      let titleX = 14;
      if (wl?.logoDataUrl) {
        try {
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(14, 12, 22, 18, 1, 1, 'F');
          doc.addImage(wl.logoDataUrl, undefined, 15, 13, 20, 16);
          titleX = 40;
        } catch {
          titleX = 14;
        }
      }

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.setFont('Helvetica', 'bold');
      doc.text(agencyName.toUpperCase(), titleX, 20);

      doc.setFontSize(10.5);
      doc.setTextColor(100, 110, 125);
      doc.setFont('Helvetica', 'normal');
      doc.text(agencyTagline, titleX, 27);

      doc.setFontSize(8.5);
      doc.setTextColor(120, 130, 140);
      const subInfo = `Date: ${timestamp} | Calibration: ${strictnessMode.toUpperCase()}${agencyContact ? ` | ${agencyContact}` : ''}`;
      doc.text(subInfo, titleX, 33);
    } else {
      doc.setFontSize(22);
      doc.setTextColor(99, 102, 241);
      doc.text('VATHMOS', 14, 20);

      doc.setFontSize(12);
      doc.setTextColor(113, 113, 122);
      doc.text('Candidate Pool Ranking Leaderboard', 14, 27);

      doc.text(
        `Date Generated: ${timestamp} | Calibration: ${strictnessMode.toUpperCase()}`,
        14,
        34
      );
    }

    doc.setDrawColor(228, 228, 231);
    doc.line(14, 38, 196, 38);

    doc.setFontSize(10);
    doc.setTextColor(39, 39, 42);
    doc.setFont('Helvetica', 'bold');
    doc.text('Rank', 14, 46);
    doc.text('Candidate Name', 28, 46);
    doc.text('Hard (40)', 80, 46);
    doc.text('Domain (30)', 105, 46);
    doc.text('Evidence (30)', 130, 46);
    doc.text('Total (100)', 155, 46);
    doc.text('Recommendation', 196, 46, { align: 'right' });

    doc.line(14, 49, 196, 49);

    doc.setFont('Helvetica', 'normal');
    let y = 56;

    displayedCandidates.forEach((candidate, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
        doc.setFont('Helvetica', 'bold');
        doc.text('Rank', 14, y);
        doc.text('Candidate Name', 28, y);
        doc.text('Hard (40)', 80, y);
        doc.text('Domain (30)', 105, y);
        doc.text('Evidence (30)', 130, y);
        doc.text('Total (100)', 155, y);
        doc.text('Recommendation', 196, y, { align: 'right' });
        doc.line(14, y + 3, 196, y + 3);
        doc.setFont('Helvetica', 'normal');
        y += 10;
      }

      const res = candidate.result!;
      doc.text(`#${index + 1}`, 14, y);

      const cleanName = toTitleCase(candidate.name);
      const truncatedName =
        cleanName.length > 22 ? cleanName.substring(0, 20) + '...' : cleanName;
      doc.text(truncatedName, 28, y);

      doc.text(res.score_breakdown.hard_requirements.toString(), 80, y);
      doc.text(res.score_breakdown.domain_depth.toString(), 105, y);
      doc.text(res.score_breakdown.verifiable_evidence.toString(), 130, y);

      doc.setFont('Helvetica', 'bold');
      doc.text(res.score.toString(), 155, y);
      doc.setFont('Helvetica', 'normal');

      const rec = res.recommendation;
      const truncatedRec = rec.length > 15 ? rec.substring(0, 13) + '...' : rec;
      doc.text(truncatedRec, 196, y, { align: 'right' });

      y += 8;
    });

    const fileTimestamp = new Date().toISOString().split('T')[0];
    const pdfFilename = isWhiteLabelActive
      ? `${agencyName.replace(/\s+/g, '_')}_Leaderboard_${fileTimestamp}.pdf`
      : `vathmos-leaderboard-${fileTimestamp}.pdf`;
    doc.save(pdfFilename);
  };

  return (
    <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06] flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white">
                Candidate Pool Leaderboard ({displayedCandidates.length} of {allEvaluated.length})
              </h3>
              {strictnessMode === 'strict' && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  ⚡ Strict Standards
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Rank-ordered by 100-point rubric: Hard (40) + Domain (30) + Evidence (30)
            </p>
          </div>
        </div>

        {/* View Toggles & Export Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isWhiteLabelActive && (
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">
              <Palette className="w-3 h-3 text-indigo-400" />
              <span>White-Label Active: {agencyName}</span>
            </span>
          )}
          {minScoreFilter > 0 && (
            <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  viewMode === 'all'
                    ? 'bg-white/[0.08] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All ({allEvaluated.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('passing')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  viewMode === 'passing'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Passing ≥{minScoreFilter} ({passingCandidates.length})
              </button>
            </div>
          )}

          <button
            type="button"
            id="export-leaderboard-pdf-btn"
            onClick={handleExportPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 border border-blue-500 transition-colors cursor-pointer shadow-2xs active:scale-[0.98]"
            title="Download ranked candidate results as PDF"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>

          <button
            type="button"
            id="export-leaderboard-csv-btn"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-200 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer shadow-2xs active:scale-[0.98]"
            title="Download ranked candidate results as CSV"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Active Alert Banner */}
      {minScoreFilter > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-zinc-200">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>
              Passing Score Threshold: <strong className="text-white">≥{minScoreFilter} pts</strong>.
              {' '}
              {viewMode === 'passing' ? (
                <span>
                  Showing {passingCandidates.length} of {allEvaluated.length} candidates.
                  {hiddenCount > 0 && (
                    <span className="text-zinc-400 ml-1">
                      ({hiddenCount} candidate{hiddenCount > 1 ? 's' : ''} scored below {minScoreFilter})
                    </span>
                  )}
                </span>
              ) : (
                <span>Showing all {allEvaluated.length} candidates with pass/fail indicators.</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {viewMode === 'passing' && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className="text-xs font-semibold text-sky-400 hover:text-white underline cursor-pointer"
              >
                View All {allEvaluated.length}
              </button>
            )}
            {onMinScoreFilterChange && (
              <button
                type="button"
                onClick={() => {
                  onMinScoreFilterChange(0);
                  setViewMode('all');
                }}
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer border border-white/[0.06]"
              >
                Reset Filter (0)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty State when no candidates pass minScoreFilter */}
      {displayedCandidates.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#0E1018]/80 border border-white/[0.06] text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white">
            No Candidates Scored ≥ {minScoreFilter} pts
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            All {allEvaluated.length} evaluated candidates scored below your current {minScoreFilter}-point passing threshold {strictnessMode === 'strict' ? '(under Strict Standards)' : ''}.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              Show All {allEvaluated.length} Candidates
            </button>
            {onMinScoreFilterChange && (
              <button
                type="button"
                onClick={() => {
                  onMinScoreFilterChange(0);
                  setViewMode('all');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 text-xs font-semibold cursor-pointer border border-white/[0.08]"
              >
                Clear Score Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* 1. MOBILE RESPONSIVE CARD VIEW (Shows on mobile / small screens) */}
          {/* ============================================================== */}
          <div className="block md:hidden space-y-3">
            {displayedCandidates.map((candidate, index) => {
              const res = candidate.result!;
              const isSelected = candidate.id === selectedCandidateId;
              const isTop = index === 0;
              const isBelowCutoff = minScoreFilter > 0 && res.score < minScoreFilter;
              const cleanName = toTitleCase(candidate.name);
              const badge = getRecommendationBadge(res.recommendation, res.score);

              return (
                <div
                  key={candidate.id}
                  onClick={() => onSelectCandidate(candidate.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500/10 border-sky-500/35 ring-1 ring-sky-500/25 shadow-xs'
                      : 'bg-[#0E1018]/80 border-white/[0.06] hover:border-white/[0.12]'
                  } ${isBelowCutoff ? 'opacity-75' : ''}`}
                >
                  {/* Top Bar: Rank + Name + Total Score */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                          isTop
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : index === 1
                            ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                            : index === 2
                            ? 'bg-white/[0.05] text-zinc-300 border border-white/[0.08]'
                            : 'bg-white/[0.02] text-zinc-500 border border-white/[0.04]'
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm">
                            {cleanName}
                          </span>
                          {candidate.fileName && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                              {candidate.fileName}
                            </span>
                          )}
                        </div>
                        {isBelowCutoff && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 inline-block mt-0.5">
                            Below {minScoreFilter} pts threshold
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Total 100-Point Score */}
                    <div className="text-right shrink-0">
                      <div className="font-mono text-xl font-extrabold flex items-baseline justify-end gap-0.5">
                        <span className={getScoreColorClass(res.score)}>{res.score}</span>
                        <span className="text-[10px] text-zinc-500 font-normal">/100</span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium border inline-block mt-0.5 ${badge.style}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* 3-Part Calculation Breakdown Grid */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 py-2 px-2.5 rounded-xl bg-[#12151E]/90 border border-white/[0.06] text-center font-mono">
                    <div className="border-r border-white/[0.06] pr-1">
                      <span className="text-[10px] text-zinc-400 block font-sans">
                        Hard (40)
                      </span>
                      <span className="text-xs font-bold text-sky-400">
                        {res.score_breakdown.hard_requirements}
                      </span>
                    </div>
                    <div className="border-r border-white/[0.06] pr-1">
                      <span className="text-[10px] text-zinc-400 block font-sans">
                        Domain (30)
                      </span>
                      <span className="text-xs font-bold text-indigo-300">
                        {res.score_breakdown.domain_depth}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 block font-sans">
                        Evidence (30)
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        {res.score_breakdown.verifiable_evidence}
                      </span>
                    </div>
                  </div>

                  {/* Reasoning & Action */}
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                    <p className="text-zinc-400 text-[11px] line-clamp-1 flex-1">
                      {res.rank_reasoning}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCandidate(candidate.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white border border-white/[0.08]'
                      }`}
                    >
                      <span>{isSelected ? 'Viewing' : 'Inspect'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ============================================================== */}
          {/* 2. DESKTOP TABLE VIEW (Shows on medium & large screens >= 768px) */}
          {/* ============================================================== */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-semibold w-12">Rank</th>
                  <th className="py-2.5 px-3 font-semibold">Candidate</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-24">Hard Req (40)</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-24">Domain (30)</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-24">Evidence (30)</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-28">Total (100)</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {displayedCandidates.map((candidate, index) => {
                  const res = candidate.result!;
                  const isSelected = candidate.id === selectedCandidateId;
                  const isTop = index === 0;
                  const isBelowCutoff = minScoreFilter > 0 && res.score < minScoreFilter;
                  const cleanName = toTitleCase(candidate.name);

                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => onSelectCandidate(candidate.id)}
                      className={`hover:bg-white/[0.025] transition-colors cursor-pointer ${
                        isSelected ? 'bg-sky-500/10 font-medium' : ''
                      } ${isBelowCutoff ? 'opacity-70' : ''}`}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                              isTop
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : index === 1
                                ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                                : index === 2
                                ? 'bg-white/[0.05] text-zinc-300 border border-white/[0.08]'
                                : 'bg-white/[0.02] text-zinc-500 border border-white/[0.04]'
                            }`}
                          >
                            #{index + 1}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white block">
                              {cleanName}
                            </span>
                            {candidate.fileName && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                                {candidate.fileName}
                              </span>
                            )}
                            {isBelowCutoff && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                Below {minScoreFilter} pts
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-400 line-clamp-1 max-w-xs mt-0.5">
                            {res.rank_reasoning}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold text-xs">
                          {res.score_breakdown.hard_requirements}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold text-xs">
                          {res.score_breakdown.domain_depth}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-xs">
                          {res.score_breakdown.verifiable_evidence}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1 font-mono text-base font-extrabold text-white">
                          <span className={getScoreColorClass(res.score)}>{res.score}</span>
                          <span className="text-[10px] text-zinc-500 font-normal">/100</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCandidate(candidate.id);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white border border-white/[0.08]'
                          }`}
                        >
                          <span>{isSelected ? 'Viewing' : 'Inspect'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
