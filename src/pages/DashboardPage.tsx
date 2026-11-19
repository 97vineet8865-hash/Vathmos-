import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Header } from '../components/Header';
import { RubricInfo } from '../components/RubricInfo';
import { JobDescriptionEditor } from '../components/JobDescriptionEditor';
import { ResumeEditor } from '../components/ResumeEditor';
import { ScorecardView } from '../components/ScorecardView';
import { LeaderboardView } from '../components/LeaderboardView';
import { JsonOutputModal } from '../components/JsonOutputModal';
import { SideDrawer } from '../components/SideDrawer';
import { evaluateWithHeuristicRubric, sanitizeEvaluationResult } from '../utils/clientRubricEvaluator';
import { ProfileModal } from '../components/ProfileModal';
import { LegalCharterModal } from '../components/LegalCharterModal';
import { InterviewGeneratorView } from '../components/InterviewGeneratorView';
import { QuickReviewPrompt } from '../components/QuickReviewPrompt';
import { CandidateItem, EvaluationResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Shield, ArrowLeft, ExternalLink, HelpCircle, Mic, FileText, Zap, CheckCircle2 } from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';
import { trackEvent } from '../utils/analytics';

function normalizeResumeFingerprint(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isGenericCandidateName(name?: string): boolean {
  const clean = String(name || '').trim();
  return !clean || /^candidate(\s*\d+|\s*\(\d+\))?$/i.test(clean);
}

function toTitleCase(str: string): string {
  if (!str) return '';
  // Preserve any disambiguation suffix like (2), (3)
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

function getUniqueCandidateName(
  baseName: string,
  existingCandidates: CandidateItem[],
  excludeId?: string,
  _fileName?: string
): string {
  const safeList = Array.isArray(existingCandidates) ? existingCandidates : [];
  const raw = (baseName || "").trim();
  const cleanBase = raw.replace(/\s*\(\d+\)$/, "").replace(/\s+/g, ' ').trim();
  const norm = (val?: string) => (val || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // If baseName is generic like "Candidate" or empty
  const isGeneric = !cleanBase || /^candidate(\s*\d+|\s*\(\d+\))?$/i.test(cleanBase);

  if (isGeneric) {
    let num = 1;
    let candidateName = `Candidate ${num}`;
    while (
      safeList.some(
        (c) => c && c.id !== excludeId && norm(c.name) === candidateName.toLowerCase()
      )
    ) {
      num++;
      candidateName = `Candidate ${num}`;
    }
    return candidateName;
  }

  // Check if a candidate with this exact name already exists in the list
  const hasCollision = safeList.some(
    (c) => c && c.id !== excludeId && norm(c.name) === cleanBase.toLowerCase()
  );

  if (!hasCollision) {
    return cleanBase;
  }

  // If a collision occurs:
  // Disambiguate using clean sequential numbering: "Aditya Sharma", "Aditya Sharma (2)"
  let suffix = 2;
  let candidateName = `${cleanBase} (${suffix})`;
  while (
    safeList.some(
      (c) => c && c.id !== excludeId && norm(c.name) === candidateName.toLowerCase()
    )
  ) {
    suffix++;
    candidateName = `${cleanBase} (${suffix})`;
  }
  return candidateName;
}

export const DashboardPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser, isAuthenticated, recordEvaluationUsed, token, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'evaluation' | 'interview_studio'>('evaluation');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [candidates, setCandidates] = useState<CandidateItem[]>([
    {
      id: 'cand-1',
      name: 'Candidate 1',
      resumeText: '',
      status: 'idle',
    },
  ]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('cand-1');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [candidateCounter, setCandidateCounter] = useState<number>(2);
  const evalCacheRef = React.useRef<Map<string, EvaluationResult>>(new Map());

  // Side Drawer configurations
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [strictnessMode, setStrictnessMode] = useState<'standard' | 'strict' | 'lenient'>(() => {
    try {
      const saved = localStorage.getItem('vathmos_strictness_mode');
      if (saved === 'standard' || saved === 'strict' || saved === 'lenient') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'standard'; // Default to Standard 100-point balanced rubric
  });

  // Automatically enforce Standard mode if current user is on Starter tier
  React.useEffect(() => {
    if (currentUser?.tier === 'starter' && strictnessMode !== 'standard') {
      setStrictnessMode('standard');
      try {
        localStorage.setItem('vathmos_strictness_mode', 'standard');
      } catch {
        // safe fallback
      }
    }
  }, [currentUser?.tier, strictnessMode]);

  const handleStrictnessModeChange = (mode: 'standard' | 'strict' | 'lenient') => {
    if (currentUser?.tier === 'starter' && mode !== 'standard') {
      setStrictnessMode('standard');
      return;
    }
    setStrictnessMode(mode);
    try {
      localStorage.setItem('vathmos_strictness_mode', mode);
    } catch {
      // safe fallback
    }
  };

  const [autoExtractName, setAutoExtractName] = useState<boolean>(true);

  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);

  const selectedCandidate =
    candidates.find((c) => c.id === selectedCandidateId) || candidates[0];

  const hasAnyData = Boolean(
    jobDescription.trim() || candidates.some((c) => c.resumeText.trim())
  );

  // Trigger celebratory confetti for strong candidates
  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#4f46e5', '#10b981', '#6366f1', '#3b82f6'],
      });
    } catch {
      // safe fallback
    }
  };

  // Evaluate a specific candidate
  const handleEvaluateCandidate = async (candidateId?: string) => {
    const targetId = candidateId || selectedCandidateId;
    const candidate = candidates.find((c) => c.id === targetId);

    if (!candidate || !jobDescription.trim() || !candidate.resumeText.trim()) {
      return;
    }

    if (!isAuthenticated || !currentUser || !token) {
      setWorkspaceNotice(
        'Create a free Vathmos account (Google or Email) to unlock your 5 free candidate evaluations and 5 AI interview guides.'
      );
      openAuthModal('signup');
      return;
    }

    const evalsLimit = currentUser?.evaluationsLimit ?? 5;
    const evalsUsed = currentUser?.evaluationsUsed ?? 0;
    const evalsRemaining = Math.max(0, evalsLimit - evalsUsed);

    if (evalsRemaining < 1) {
      setErrorMessage(
        `You have used all ${evalsLimit} candidate evaluations on your ${
          currentUser?.tier ? currentUser.tier.toUpperCase() : 'FREE'
        } tier. Please upgrade to Starter (150 candidates), Pro (400 candidates), or Agency (1,000 candidates) to evaluate more candidates.`
      );
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    // Update status to evaluating
    setCandidates((prev) =>
      prev.map((c) => (c.id === targetId ? { ...c, status: 'evaluating' } : c))
    );

    try {
      const cacheKey = `${normalizeResumeFingerprint(jobDescription)}||${normalizeResumeFingerprint(candidate.resumeText)}||${strictnessMode}`;
      const cachedResult = evalCacheRef.current.get(cacheKey);
      let result: EvaluationResult;
      let usedCache = false;

      if (cachedResult) {
        result = cachedResult;
        usedCache = true;
      } else {
        try {
          const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              jobDescription,
              resumeText: candidate.resumeText,
              candidateName: candidate.name,
              strictnessMode,
            }),
          });

          if (response.ok) {
            const rawResult = await response.json();
            result = sanitizeEvaluationResult(rawResult, jobDescription, candidate.resumeText, candidate.name, strictnessMode);
          } else if (response.status === 401) {
            const errData = await response.json().catch(() => ({}));
            openAuthModal('signup');
            const authErr: any = new Error(errData.error || 'Please sign up or sign in to run candidate evaluations.');
            authErr.isHardStop = true;
            throw authErr;
          } else if (response.status === 403) {
            const errData = await response.json().catch(() => ({}));
            const limitErr: any = new Error(errData.error || 'Evaluation limit reached. Please upgrade your plan.');
            limitErr.isHardStop = true;
            throw limitErr;
          } else {
            // If server returns 5xx when already authenticated & within quota, fall back to calibrated multi-domain client evaluation
            result = evaluateWithHeuristicRubric(jobDescription, candidate.resumeText, candidate.name, strictnessMode) as unknown as EvaluationResult;
          }
        } catch (fetchErr: any) {
          if (fetchErr?.isHardStop) {
            throw fetchErr;
          }
          // Network error or offline (already authenticated & quota verified) - evaluate locally
          result = evaluateWithHeuristicRubric(jobDescription, candidate.resumeText, candidate.name, strictnessMode) as unknown as EvaluationResult;
        }
        evalCacheRef.current.set(cacheKey, result);
      }

      // Accurately update candidate name if parsed from resume text and existing name is generic
      const rawName = (result.candidate_name || '').trim();
      const isPlaceholder =
        !rawName ||
        ['candidate', 'jane doe', 'john doe', 'alex rivera', 'candidate name', 'unknown'].includes(
          rawName.toLowerCase()
        );
      const keepExistingValidName = !isGenericCandidateName(candidate.name);
      const chosenName = keepExistingValidName || isPlaceholder ? candidate.name : toTitleCase(rawName);

      setCandidates((prev) => {
        const finalName = getUniqueCandidateName(chosenName, prev, targetId);
        const syncedResult: EvaluationResult = { ...result, candidate_name: finalName };
        return prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                name: finalName,
                status: 'completed',
                result: syncedResult,
                error: undefined,
              }
            : c
        );
      });

      if (result.score >= 85) {
        triggerCelebration();
      }

      if (!usedCache) {
        recordEvaluationUsed(1);
        trackEvent('evaluation_run', { count: 1, mode: strictnessMode }, currentUser?.tier || 'free');
      }
    } catch (err: any) {
      console.error('Evaluation failed:', err);
      let rawMsg = err.message || 'Failed to evaluate candidate.';
      if (rawMsg === 'Failed to fetch' || rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
        rawMsg = 'Server connection temporarily interrupted while starting up. Please click Evaluate again.';
      } else if (rawMsg.toLowerCase().includes('quota') || rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
        rawMsg = 'Gemini quota limit reached. Please wait a few moments before trying again.';
      }
      setErrorMessage(rawMsg);
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === targetId ? { ...c, status: 'error', error: rawMsg } : c
        )
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  // Progressive Parallel Batch evaluation with real-time per-candidate updates
  const handleEvaluateAll = async () => {
    if (!jobDescription.trim()) return;

    const targetCandidates = candidates.filter((c) => c.resumeText.trim());
    const totalCount = targetCandidates.length;
    const emptyCount = candidates.length - totalCount;

    if (totalCount === 0) {
      setErrorMessage('Please add at least one candidate resume before evaluating.');
      return;
    }

    if (!isAuthenticated || !currentUser || !token) {
      setWorkspaceNotice(
        'Create a free Vathmos account (Google or Email) to unlock your 5 free candidate evaluations and 5 AI interview guides.'
      );
      openAuthModal('signup');
      return;
    }

    setIsEvaluating(true);
    setErrorMessage(null);

    const evalsLimit = currentUser?.evaluationsLimit ?? 5;
    const evalsUsed = currentUser?.evaluationsUsed ?? 0;
    const evalsRemaining = Math.max(0, evalsLimit - evalsUsed);

    if (evalsRemaining <= 0) {
      setIsEvaluating(false);
      setErrorMessage(
        `You have used all ${evalsLimit} candidate evaluations on your ${
          currentUser?.tier ? currentUser.tier.toUpperCase() : 'FREE'
        } tier. Please upgrade to Starter (150 candidates), Pro (400 candidates), or Agency (1,000 candidates) to continue evaluating candidates.`
      );
      return;
    }

    if (totalCount > evalsRemaining) {
      setIsEvaluating(false);
      setErrorMessage(
        `You have ${evalsRemaining} candidate evaluation${
          evalsRemaining > 1 ? 's' : ''
        } remaining on your ${
          currentUser?.tier ? currentUser.tier.toUpperCase() : 'FREE'
        } tier, but you selected ${totalCount} candidates. Please evaluate ${evalsRemaining} candidate${
          evalsRemaining > 1 ? 's' : ''
        } or upgrade your plan to evaluate all candidates at once.`
      );
      return;
    }

    // Set all target candidates to evaluating immediately
    const targetIds = new Set(targetCandidates.map((c) => c.id));
    setCandidates((prev) =>
      prev.map((c) => (targetIds.has(c.id) ? { ...c, status: 'evaluating', error: undefined } : c))
    );

    setBatchProgress({
      current: 0,
      total: totalCount,
      name: `Evaluating 0 of ${totalCount} candidates${emptyCount > 0 ? ` (${emptyCount} empty slot${emptyCount > 1 ? 's' : ''} skipped)` : ''}...`,
    });

    let completedCount = 0;
    let hasTopCandidate = false;

    // Process candidates with high-speed concurrency pool of 2 for fast, fluid evaluation
    try {
      const concurrency = Math.min(2, targetCandidates.length);
      let candidateIndex = 0;

      const runWorker = async () => {
        while (candidateIndex < targetCandidates.length) {
          const currentIdx = candidateIndex++;
          const candidate = targetCandidates[currentIdx];

          setBatchProgress({
            current: completedCount,
            total: totalCount,
            name: `Evaluating candidate ${currentIdx + 1} of ${totalCount}: ${candidate.name}...`,
          });

          try {
            let response: Response | null = null;
            let fetchErr: any = null;

            // Check client deterministic session cache first so unchanged resumes never fluctuate
            const batchCacheKey = `${normalizeResumeFingerprint(jobDescription)}||${normalizeResumeFingerprint(candidate.resumeText)}||${strictnessMode}`;
            const cachedBatch = evalCacheRef.current.get(batchCacheKey);
            let result: EvaluationResult;

            if (cachedBatch) {
              result = cachedBatch;
            } else {
              try {
                for (let attempt = 1; attempt <= 2; attempt++) {
                  try {
                    response = await fetch('/api/evaluate', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                      body: JSON.stringify({
                        jobDescription,
                        resumeText: candidate.resumeText,
                        candidateName: candidate.name,
                        strictnessMode,
                      }),
                    });
                    if (response && response.ok) break;
                    if (response && response.status === 401) {
                      const errData = await response.json().catch(() => ({}));
                      openAuthModal('signup');
                      const authErr: any = new Error(errData.error || 'Please sign up or sign in to run evaluations.');
                      authErr.isHardStop = true;
                      throw authErr;
                    }
                    if (response && response.status === 403) {
                      const errData = await response.json().catch(() => ({}));
                      const limitErr: any = new Error(errData.error || 'Evaluation limit reached. Please upgrade your plan.');
                      limitErr.isHardStop = true;
                      throw limitErr;
                    }
                  } catch (e: any) {
                    if (e?.isHardStop) throw e;
                    fetchErr = e;
                    if (attempt === 1) await new Promise((res) => setTimeout(res, 300));
                  }
                }

                if (response && response.ok) {
                  const rawBatchResult = await response.json();
                  result = sanitizeEvaluationResult(rawBatchResult, jobDescription, candidate.resumeText, candidate.name, strictnessMode);
                } else if (response && response.status === 401) {
                  const errData = await response.json().catch(() => ({}));
                  openAuthModal('signup');
                  const authErr: any = new Error(errData.error || 'Please sign up or sign in to run evaluations.');
                  authErr.isHardStop = true;
                  throw authErr;
                } else if (response && response.status === 403) {
                  const errData = await response.json().catch(() => ({}));
                  const limitErr: any = new Error(errData.error || 'Evaluation limit reached. Please upgrade your plan.');
                  limitErr.isHardStop = true;
                  throw limitErr;
                } else {
                  result = evaluateWithHeuristicRubric(jobDescription, candidate.resumeText, candidate.name, strictnessMode) as unknown as EvaluationResult;
                }
              } catch (evalErr: any) {
                if (
                  evalErr?.isHardStop ||
                  evalErr?.message?.includes('Evaluation limit') ||
                  evalErr?.message?.includes('limit reached') ||
                  evalErr?.message?.includes('sign up') ||
                  evalErr?.message?.includes('sign in')
                ) {
                  throw evalErr;
                }
                result = evaluateWithHeuristicRubric(jobDescription, candidate.resumeText, candidate.name, strictnessMode) as unknown as EvaluationResult;
              }
              evalCacheRef.current.set(batchCacheKey, result);
              freshlyEvaluatedCount++;
            }

            const rawName = (result.candidate_name || '').trim();
            const isPlaceholder =
              !rawName ||
              ['candidate', 'jane doe', 'john doe', 'alex rivera', 'candidate name', 'unknown'].includes(
                rawName.toLowerCase()
              );
            const keepExistingValidName = !isGenericCandidateName(candidate.name);
            const chosenName = keepExistingValidName || isPlaceholder ? candidate.name : toTitleCase(rawName);

            if (result.score >= 85) {
              hasTopCandidate = true;
            }

            setCandidates((prev) => {
              const finalName = getUniqueCandidateName(chosenName, prev, candidate.id);
              const syncedResult: EvaluationResult = { ...result, candidate_name: finalName };
              return prev.map((c) =>
                c.id === candidate.id
                  ? {
                      ...c,
                      name: finalName,
                      status: 'completed',
                      result: syncedResult,
                      error: undefined,
                    }
                  : c
              );
            });
          } catch (err: any) {
            console.log('Evaluation error for candidate item:', err?.message || err);
            let rawMsg = err.message || 'Evaluation error';
            if (rawMsg === 'Failed to fetch' || rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
              rawMsg = 'Server connection temporarily interrupted. Please click Evaluate again.';
            } else if (
              rawMsg.toLowerCase().includes('quota') ||
              rawMsg.includes('RESOURCE_EXHAUSTED') ||
              rawMsg.includes('429')
            ) {
              rawMsg = 'Gemini quota limit reached. Please wait a moment before retrying.';
            }
            setCandidates((prev) =>
              prev.map((c) =>
                c.id === candidate.id
                  ? { ...c, status: 'error', error: rawMsg }
                  : c
              )
            );
          } finally {
            completedCount++;
            setBatchProgress({
              current: completedCount,
              total: totalCount,
              name: `Evaluated ${completedCount} of ${totalCount} candidates`,
            });
          }
        }
      };

      let freshlyEvaluatedCount = 0;
      const workers = Array.from({ length: concurrency }, () => runWorker());
      await Promise.all(workers);

      if (freshlyEvaluatedCount > 0) {
        recordEvaluationUsed(freshlyEvaluatedCount);
        trackEvent(
          'evaluation_run',
          { count: freshlyEvaluatedCount, mode: strictnessMode },
          currentUser?.tier || 'free'
        );
      }

      if (hasTopCandidate) {
        triggerCelebration();
      }

      if (emptyCount > 0) {
        setErrorMessage(`Evaluated all ${totalCount} candidate${totalCount > 1 ? 's' : ''} with resumes. (${emptyCount} empty slot${emptyCount > 1 ? 's were' : ' was'} skipped — paste text or remove slot).`);
      }
    } catch (globalErr: any) {
      console.log('Batch execution error:', globalErr);
      setErrorMessage(globalErr?.message || 'Batch evaluation encountered an issue.');
    } finally {
      setIsEvaluating(false);
      setTimeout(() => {
        setBatchProgress(null);
      }, 1500);
    }
  };

  // Add a single blank candidate
  const handleAddCandidate = () => {
    const newId = `cand-${Date.now()}`;
    setCandidates((prev) => {
      const baseName = `Candidate ${candidateCounter}`;
      const uniqueName = getUniqueCandidateName(baseName, prev);
      const newCandidate: CandidateItem = {
        id: newId,
        name: uniqueName,
        resumeText: '',
        status: 'idle',
      };
      setCandidateCounter((c) => c + 1);
      return [...prev, newCandidate];
    });
    setSelectedCandidateId(newId);
  };

  // Add 10 candidate slots at once
  const handleAdd10Slots = () => {
    setCandidates((prev) => {
      const existingCount = prev.length;
      const targetCount = 10;
      if (existingCount >= targetCount) return prev;
      const countToAdd = targetCount - existingCount;

      const newSlots: CandidateItem[] = [];
      let tempCandidates = [...prev];
      let tempCounter = candidateCounter;

      for (let i = 0; i < countToAdd; i++) {
        const baseName = `Candidate ${tempCounter}`;
        const uniqueName = getUniqueCandidateName(baseName, tempCandidates);
        const newSlot: CandidateItem = {
          id: `cand-slot-${Date.now()}-${i}`,
          name: uniqueName,
          resumeText: '',
          status: 'idle',
        };
        newSlots.push(newSlot);
        tempCandidates.push(newSlot);
        tempCounter++;
      }

      setCandidateCounter(tempCounter);
      return tempCandidates;
    });
  };

  // Bulk add candidates from multi-file upload with automatic duplicate resume deduplication
  const handleBulkAddCandidates = (
    newFiles: Array<{ name: string; resumeText: string; fileName: string }>
  ) => {
    if (newFiles.length === 0) return;
    setWorkspaceNotice(null);

    const timestamp = Date.now();
    const existingWithText = candidates.filter((c) => c.resumeText && c.resumeText.trim().length > 0);
    const finalList = [...existingWithText];

    const fingerprintMap = new Map<string, { id: string; name: string }>();
    for (const c of existingWithText) {
      const textFp = normalizeResumeFingerprint(c.resumeText);
      const fp =
        textFp.length >= 40
          ? textFp
          : `file:${(c.fileName || c.name).toLowerCase()}:${textFp}`;
      fingerprintMap.set(fp, { id: c.id, name: c.name });
    }

    let firstAddedId: string | null = null;
    let addedCount = 0;
    const skippedDuplicates: Array<{ existingId: string; existingName: string; fileName: string }> = [];

    newFiles.forEach((file, idx) => {
      const rawText = file.resumeText || '';
      const textFp = normalizeResumeFingerprint(rawText);
      const fp =
        textFp.length >= 40
          ? textFp
          : `file:${(file.fileName || `resume_${idx + 1}.pdf`).toLowerCase()}:${textFp}`;

      const existingDup = fingerprintMap.get(fp);
      if (existingDup) {
        skippedDuplicates.push({
          existingId: existingDup.id,
          existingName: existingDup.name,
          fileName: file.fileName || file.name,
        });
        return;
      }

      let cleanName = (file.name || '').trim();
      if (!cleanName) {
        cleanName = `Candidate ${finalList.length + 1}`;
      }

      const finalName = getUniqueCandidateName(cleanName, finalList, undefined, file.fileName);
      const newId = `cand-${timestamp}-${idx}`;
      const newCand: CandidateItem = {
        id: newId,
        name: finalName,
        resumeText: rawText,
        fileName: file.fileName || `resume_${idx + 1}.pdf`,
        status: 'idle',
      };

      finalList.push(newCand);
      fingerprintMap.set(fp, { id: newId, name: finalName });
      if (!firstAddedId) firstAddedId = newId;
      addedCount++;
    });

    if (finalList.length > 0) {
      setCandidates(finalList);
      if (addedCount > 0) {
        setCandidateCounter((c) => c + addedCount);
      }
      if (firstAddedId) {
        setSelectedCandidateId(firstAddedId);
      } else if (skippedDuplicates.length > 0) {
        setSelectedCandidateId(skippedDuplicates[0].existingId);
      }
    }

    if (skippedDuplicates.length > 0) {
      if (addedCount === 0) {
        setWorkspaceNotice(
          `Skipped ${skippedDuplicates.length} duplicate resume${skippedDuplicates.length > 1 ? 's' : ''} already loaded (matched "${skippedDuplicates[0].existingName}").`
        );
      } else {
        setWorkspaceNotice(
          `Added ${addedCount} unique resume${addedCount > 1 ? 's' : ''} and skipped ${skippedDuplicates.length} duplicate upload${skippedDuplicates.length > 1 ? 's' : ''} (${skippedDuplicates.map((d) => d.fileName).slice(0, 2).join(', ')}).`
        );
      }
    }
  };

  const handleClearAllCandidates = () => {
    const initialId = `cand-${Date.now()}`;
    setCandidates([
      {
        id: initialId,
        name: "Candidate 1",
        resumeText: "",
        status: "idle",
      },
    ]);
    setSelectedCandidateId(initialId);
  };

  const handleRemoveCandidate = (id: string) => {
    if (candidates.length <= 1) return;
    const remaining = candidates.filter((c) => c.id !== id);
    setCandidates(remaining);
    if (selectedCandidateId === id) {
      setSelectedCandidateId(remaining[0].id);
    }
  };

  // Update candidate
  const handleUpdateCandidate = (id: string, updates: Partial<CandidateItem>) => {
    setCandidates((prev) => {
      return prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
    });
  };

  // Reset workspace completely to blank slate
  const handleReset = () => {
    const initialId = `cand-${Date.now()}`;
    setJobDescription('');
    setCandidates([
      {
        id: initialId,
        name: 'Candidate 1',
        resumeText: '',
        status: 'idle',
      },
    ]);
    setSelectedCandidateId(initialId);
    setErrorMessage(null);
    setBatchProgress(null);
  };

  const canEvaluateCurrent = Boolean(
    jobDescription.trim() && selectedCandidate?.resumeText.trim()
  );
  const populatedCandidatesCount = candidates.filter(
    (c) => c.resumeText && c.resumeText.trim().length > 0
  ).length;
  const canEvaluateAll = Boolean(
    jobDescription.trim() && populatedCandidatesCount > 0
  );

  return (
    <div className="min-h-screen bg-transparent text-[#F3F4F6] flex flex-col font-sans">
      {/* Top Header */}
      <Header
        onReset={handleReset}
        onOpenSettings={() => setIsSideDrawerOpen(true)}
        onOpenLegalModal={() => setIsLegalModalOpen(true)}
        isEvaluating={isEvaluating}
        hasData={hasAnyData}
      />

      {/* Main App Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Rubric Definition Banner */}
        <RubricInfo />

        {/* Batch Evaluation Live Progress Banner */}
        {batchProgress && (
          <div className="p-4 rounded-2xl bg-[#12151E]/80 backdrop-blur-md border border-white/[0.08] text-[#F3F4F6] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                  <span>Batch Pool Evaluation in Progress:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-500/30 font-mono text-xs">
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Currently auditing candidate: <strong className="font-semibold text-white">{batchProgress.name}</strong>
                </p>
              </div>
            </div>
            <div className="w-full sm:w-48 bg-white/[0.06] rounded-full h-2 overflow-hidden border border-white/[0.06]">
              <div
                className="bg-sky-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Workspace Duplicate / Info Notice Banner */}
        {workspaceNotice && (
          <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-700/50 text-sky-200 text-xs sm:text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
            <div className="flex-1">
              <span>{workspaceNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setWorkspaceNotice(null)}
              className="text-sky-400 hover:text-sky-200 font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Global Error Banner if API error occurs */}
        {errorMessage && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <span className="font-bold">Evaluation Error: </span>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-200 font-bold px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429')) && (
              <div className="p-5 rounded-xl bg-indigo-950/25 border border-indigo-800/40 text-indigo-200 text-xs sm:text-sm space-y-2">
                <h4 className="font-bold text-indigo-300 text-sm sm:text-base flex items-center gap-2">
                  <span>🚀 Partner's Guide to AI Quotas</span>
                </h4>
                <p className="leading-relaxed">
                  Hey partner, you hit the Google AI Studio free tier rate limit! This is a **fantastic sign** that you are testing heavily and preparing Vathmos for a true launch.
                </p>
                <p className="leading-relaxed font-semibold text-[#FAFAFA]">
                  Here is what you can do next:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-indigo-300">
                  <li><strong>Wait 60 seconds:</strong> The free tier limits are calculated per-minute (RPM). Simply wait a minute, and your free limit will reset automatically!</li>
                  <li><strong>Enable Pay-As-You-Go (For launch):</strong> When you are ready to launch in 2026/2027, you can sit down with your parents and link a Google Cloud billing account. You get massive rate limits, and the pay-per-token pricing is incredibly cheap (and free for low volumes)!</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Navigation Section Tabs: 100-Point Candidate Evaluation vs Interview Generator */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-b border-white/[0.08] pb-3">
          <button
            type="button"
            id="tab-candidate-evaluation"
            onClick={() => setActiveTab('evaluation')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'evaluation'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>100-Point Candidate Evaluation</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-300">
              {isAuthenticated
                ? `${Math.max(0, (currentUser?.evaluationsLimit ?? 5) - (currentUser?.evaluationsUsed ?? 0))} evals left`
                : 'Sign up: 5 free'}
            </span>
          </button>

          <button
            type="button"
            id="tab-interview-studio"
            onClick={() => setActiveTab('interview_studio')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeTab === 'interview_studio'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>AI Interview Question Generator (3 Questions)</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
              {isAuthenticated
                ? `${Math.max(0, (currentUser?.interviewQuestionsLimit ?? 5) - (currentUser?.interviewQuestionsUsed ?? 0))} guides left`
                : 'Sign up: 5 free'}
            </span>
          </button>
        </div>

        {activeTab === 'interview_studio' ? (
          <InterviewGeneratorView
            candidates={candidates}
            jobDescription={jobDescription}
            onOpenUpgradeModal={() => navigate('/#pricing')}
          />
        ) : (
          <>
            {/* Input Workstations: Job Description vs Candidate Resume */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <JobDescriptionEditor
                value={jobDescription}
                onChange={setJobDescription}
                disabled={isEvaluating}
              />

          <ResumeEditor
            candidates={candidates}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={setSelectedCandidateId}
            onAddCandidate={handleAddCandidate}
            onAdd10Slots={handleAdd10Slots}
            onBulkAddCandidates={handleBulkAddCandidates}
            onClearAllCandidates={handleClearAllCandidates}
            onRemoveCandidate={handleRemoveCandidate}
            onUpdateCandidate={handleUpdateCandidate}
            onEvaluateCurrent={() => handleEvaluateCandidate(selectedCandidateId)}
            onEvaluateAll={handleEvaluateAll}
            isEvaluating={isEvaluating}
            canEvaluate={canEvaluateCurrent}
            canEvaluateAll={canEvaluateAll}
            strictnessMode={strictnessMode}
            onStrictnessModeChange={handleStrictnessModeChange}
            minScoreFilter={minScoreFilter}
            autoExtractName={autoExtractName}
            onNotifyDuplicate={(msg) => setWorkspaceNotice(msg)}
          />
        </div>

        {/* Multi-Candidate Comparison Leaderboard if >= 2 candidates evaluated */}
        {candidates.filter((c) => c.result).length >= 2 && (
          <LeaderboardView
            candidates={candidates}
            selectedCandidateId={selectedCandidateId}
            onSelectCandidate={setSelectedCandidateId}
            minScoreFilter={minScoreFilter}
            onMinScoreFilterChange={setMinScoreFilter}
            strictnessMode={strictnessMode}
          />
        )}

        {/* Active Candidate Scorecard */}
        {selectedCandidate?.result ? (
          <div id="active-candidate-scorecard" className="pt-2">
            <ScorecardView
              result={selectedCandidate.result}
              candidateName={selectedCandidate.name}
              candidateId={selectedCandidate.id}
              candidateResumeText={selectedCandidate.resumeText}
              jobDescription={jobDescription}
              onOpenJsonModal={() => setIsJsonModalOpen(true)}
              onOpenLegalModal={() => setIsLegalModalOpen(true)}
              onUpdateCandidateResult={(cId, updatedResult) => {
                setCandidates((prev) =>
                  prev.map((c) => (c.id === cId ? { ...c, result: updatedResult } : c))
                );
              }}
            />
          </div>
        ) : selectedCandidate?.status === 'evaluating' ? (
          <div className="bg-[#12151E]/80 backdrop-blur-md border border-white/[0.08] rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 shadow-sm animate-pulse">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-3 border-sky-500/25 border-t-sky-400 animate-spin" />
              <div className="absolute w-6 h-6 rounded-full bg-sky-500/15 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-tight">
                Auditing {selectedCandidate.name} on 100-Point Rubric
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Validating textual proof across Hard Requirements (0-40), Role & Domain Depth (0-30), and Verifiable Evidence (0-30).
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg pt-2 text-left">
              <div className="p-3 rounded-xl bg-[#0E1018]/80 border border-white/[0.06] text-xs">
                <p className="text-[10px] text-zinc-400 font-mono uppercase">Category 1</p>
                <p className="font-semibold text-white mt-0.5">Hard Requirements</p>
                <p className="text-[11px] text-sky-400">40 Points Max</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0E1018]/80 border border-white/[0.06] text-xs">
                <p className="text-[10px] text-zinc-400 font-mono uppercase">Category 2</p>
                <p className="font-semibold text-white mt-0.5">Domain Depth</p>
                <p className="text-[11px] text-indigo-300">30 Points Max</p>
              </div>
              <div className="p-3 rounded-xl bg-[#0E1018]/80 border border-white/[0.06] text-xs">
                <p className="text-[10px] text-zinc-400 font-mono uppercase">Category 3</p>
                <p className="font-semibold text-white mt-0.5">Verifiable Evidence</p>
                <p className="text-[11px] text-emerald-400">30 Points Max</p>
              </div>
            </div>
          </div>
        ) : selectedCandidate?.status === 'error' ? (
          <div className="bg-rose-950/30 backdrop-blur-md border border-rose-800/40 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-rose-900/40 flex items-center justify-center text-rose-300 ring-2 ring-rose-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-rose-200">
                Evaluation Failed for {selectedCandidate.name}
              </h3>
              <p className="text-xs text-rose-300 max-w-md mx-auto">
                {selectedCandidate.error || 'Temporary API connection error.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleEvaluateCandidate(selectedCandidate.id)}
              disabled={isEvaluating}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs disabled:opacity-50 min-h-[40px]"
            >
              Retry Evaluation
            </button>
          </div>
        ) : null}

        {/* Lightweight 10-second post-evaluation review prompt */}
        <QuickReviewPrompt
          hasCompletedEvaluation={candidates.some((c) => Boolean(c.result))}
        />
          </>
        )}

        {/* Global Bottom Advisory / Disclaimer & Compliance Nav */}
        <footer className="pt-6 pb-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-semibold py-1 px-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Marketing Home</span>
            </Link>
            <p className="text-slate-400">
              <span className="text-slate-200 font-semibold">Vathmos Technologies:</span> Objective decision-support system.
            </p>
            <button
              type="button"
              id="footer-legal-charter-btn"
              onClick={() => setIsLegalModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Quick Charter</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-slate-400 flex-wrap text-[11px]">
            <Link href="/privacy" className="hover:text-cyan-400 transition">Privacy Policy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-cyan-400 transition">Terms of Service</Link>
            <span>•</span>
            <Link href="/refund" className="hover:text-cyan-400 transition">Refund Policy</Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-cyan-400 transition">Contact Us</Link>
          </div>
        </footer>
      </main>

      {/* JSON Output Modal */}
      <JsonOutputModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        result={selectedCandidate?.result || null}
        candidateName={selectedCandidate?.name || 'Candidate'}
      />

      {/* Side Slide Drawer for Settings, Extensions & Pipeline Modules */}
      <SideDrawer
        isOpen={isSideDrawerOpen}
        onClose={() => setIsSideDrawerOpen(false)}
        minScoreFilter={minScoreFilter}
        onMinScoreFilterChange={setMinScoreFilter}
        strictnessMode={strictnessMode}
        onStrictnessModeChange={handleStrictnessModeChange}
        autoExtractName={autoExtractName}
        onToggleAutoExtractName={setAutoExtractName}
      />

      {/* Legal, Privacy & Compliance Charter Modal */}
      <LegalCharterModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
      />

      {/* Recruiter Profile Modal */}
      <ProfileModal candidates={candidates} jobDescription={jobDescription} />
    </div>
  );
}
export default DashboardPage;
