import React, { useRef, useState } from 'react';
import { User, Upload, Plus, Trash2, CheckCircle2, Play, Sparkles, AlertCircle, Files, FileText, Loader2, X, Lock } from 'lucide-react';
import { CandidateItem } from '../types';
import { extractTextFromPdf } from '../utils/pdfParser';
import { useAuth } from '../context/AuthContext';

interface ResumeEditorProps {
  candidates: CandidateItem[];
  selectedCandidateId: string;
  onSelectCandidate: (id: string) => void;
  onAddCandidate: () => void;
  onAdd10Slots?: () => void;
  onBulkAddCandidates?: (
    newCandidates: Array<{ name: string; resumeText: string; fileName: string }>
  ) => void;
  onRemoveCandidate: (id: string) => void;
  onClearAllCandidates?: () => void;
  onUpdateCandidate: (id: string, updates: Partial<CandidateItem>) => void;
  onEvaluateCurrent: () => void;
  onEvaluateAll: () => void;
  isEvaluating: boolean;
  canEvaluate: boolean;
  canEvaluateAll?: boolean;
  strictnessMode?: 'standard' | 'strict' | 'lenient';
  onStrictnessModeChange?: (mode: 'standard' | 'strict' | 'lenient') => void;
  minScoreFilter?: number;
  autoExtractName?: boolean;
}

function cleanCandidateDisplay(str: string): string {
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

// Helper to clean up file names to produce clean candidate names
function cleanFileNameToName(fileName: string, fallbackIndex?: number): string {
  // Remove extension
  let base = fileName.replace(/\.[^/.]+$/, '').trim();

  // Normalize patterns like "code.1", "code_1", "code-1", "code (1)", "code 1"
  const trailingNumMatch = base.match(/[._\-\s(]+(\d+)\s*\)?$/);
  const trailingNum = trailingNumMatch ? trailingNumMatch[1] : '';

  // Strip trailing number from base for cleanup
  if (trailingNum) {
    base = base.replace(/[._\-\s(]+(\d+)\s*\)?$/, '').trim();
  }

  // Replace underscores, hyphens, and dots with spaces
  base = base.replace(/[._\-]+/g, ' ');
  // Remove common generic resume file words
  base = base.replace(/\b(resume|cv|candidate|final|portfolio|profile|hiring|evaluation|vathmos|updated|new|draft|latest|2024|2025|2026)\b/gi, '');
  base = base.replace(/\s+/g, ' ').trim();

  // If base was just "code", "file", "candidate", or empty after removing generic words
  if (!base || base.toLowerCase() === 'code' || base.toLowerCase() === 'file' || base.toLowerCase() === 'candidate') {
    const num = trailingNum || (fallbackIndex !== undefined ? String(fallbackIndex + 1) : '');
    return num ? `Candidate ${num}` : (fallbackIndex !== undefined ? `Candidate ${fallbackIndex + 1}` : 'Candidate');
  }

  const titleCased = base
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return trailingNum ? `${titleCased} ${trailingNum}` : titleCased;
}

// Helper to identify standard job titles, locations, degrees, code keywords, and non-name phrases from candidate resume headers
function isJobTitleOrHeader(str: string): boolean {
  const lowercase = str.toLowerCase();
  const keywords = [
    'engineer', 'developer', 'designer', 'manager', 'lead', 'architect', 
    'analyst', 'consultant', 'specialist', 'expert', 'administrator', 
    'programmer', 'representative', 'practitioner', 'coordinator', 
    'intern', 'student', 'fellow', 'founder', 'co-founder', 'director', 
    'president', 'vice', 'officer', 'executive', 'chief', 'head',
    'full stack', 'frontend', 'backend', 'data scientist', 'machine learning',
    'devops', 'cloud', 'security', 'product', 'project', 'program',
    'sales', 'marketing', 'human resources', 'recruitment', 'recruiter',
    'test', 'quality', 'qa', 'automation', 'database', 'system', 'systems',
    'network', 'support', 'technical', 'technology', 'operations', 'science',
    'scientific', 'research', 'researcher', 'academic', 'professor', 'teacher',
    'phone', 'email', 'mobile', 'address', 'contact', 'location', 'github', 
    'linkedin', 'website', 'skills', 'education', 'objective', 'page', 
    'curriculum', 'vitae', 'personal', 'details', 'information', 'profile', 
    'about', 'me', 'work', 'history', 'employment', 'experience', 'summary',
    'university', 'college', 'school', 'institute', 'certifications', 'certification',
    // Locations, cities, states, countries
    'united states', 'usa', 'canada', 'united kingdom', 'uk', 'germany', 'france',
    'india', 'australia', 'san francisco', 'new york', 'los angeles', 'chicago',
    'austin', 'seattle', 'boston', 'london', 'toronto', 'remote', 'hybrid', 'relocate',
    'street', 'avenue', 'boulevard', 'road', 'drive', 'lane', 'suite', 'apt',
    // Degree / Education titles
    'bachelor', 'master', 'doctorate', 'phd', 'degree', 'gpa', 'cum laude', 'honors',
    'computer science', 'information technology', 'software engineering',
    // Code keywords to prevent parsing code statements as personal human names
    'import', 'export', 'function', 'class', 'interface', 'const', 'let', 'var',
    'type', 'module', 'package', 'pipeline', 'evaluation', 'script', 'system',
    'model', 'props', 'component', 'return', 'async', 'await', 'cascade', 'helper',
    'server', 'client', 'route', 'handler', 'endpoint', 'string', 'number', 'boolean'
  ];
  return keywords.some((keyword) => lowercase.includes(keyword));
}

// Helper to auto-extract candidate name from first non-empty line of resume text
function extractNameFromText(text: string): string | null {
  if (!text || !text.trim()) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  for (const line of lines.slice(0, 6)) {
    // Clean up standard markdown/bullet prefixes
    let cleaned = line.replace(/^[#*\-•\s]+/, '').trim();
    if (!cleaned) continue;

    // Remove labels like "Name:", "Candidate Name:"
    cleaned = cleaned.replace(/^(name|candidate name|full name)\s*[:\-]\s*/i, '').trim();

    // Check if line contains contact info delimiters, split to isolate the name part
    if (cleaned.includes('|')) {
      cleaned = cleaned.split('|')[0].trim();
    }
    if (cleaned.includes(',')) {
      cleaned = cleaned.split(',')[0].trim();
    }
    // If there is an email, remove it and everything after it
    if (cleaned.includes('@')) {
      const parts = cleaned.split(/\s+/);
      const emailIdx = parts.findIndex(p => p.includes('@'));
      if (emailIdx !== -1) {
        cleaned = parts.slice(0, emailIdx).join(' ').trim();
      }
    }

    // Now check if what remains looks like a name (usually 2 to 4 words)
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2 && words.length <= 4) {
      const candidatesName = words.join(' ');
      if (
        candidatesName.length >= 3 &&
        candidatesName.length <= 35 &&
        !candidatesName.includes('http') &&
        !candidatesName.includes(':') &&
        !candidatesName.includes('/') &&
        !candidatesName.toLowerCase().includes('resume') &&
        !candidatesName.toLowerCase().includes('curriculum') &&
        !candidatesName.toLowerCase().includes('summary') &&
        !candidatesName.toLowerCase().includes('experience') &&
        !candidatesName.toLowerCase().includes('vathmos') &&
        !candidatesName.toLowerCase().includes('evaluation') &&
        !candidatesName.toLowerCase().includes('candidate') &&
        !isJobTitleOrHeader(candidatesName) &&
        /^[A-Za-z\s.'-]+$/.test(candidatesName)
      ) {
        // Title case the returned name beautifully
        return candidatesName
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
    }
  }
  return null;
}

export const ResumeEditor: React.FC<ResumeEditorProps> = ({
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onAddCandidate,
  onAdd10Slots,
  onBulkAddCandidates,
  onRemoveCandidate,
  onClearAllCandidates,
  onUpdateCandidate,
  onEvaluateCurrent,
  onEvaluateAll,
  isEvaluating,
  canEvaluate,
  canEvaluateAll,
  strictnessMode = 'standard',
  onStrictnessModeChange,
  minScoreFilter = 0,
  autoExtractName = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { currentUser, openOnboardingModal } = useAuth();
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsingFileName, setParsingFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [starterLockNotice, setStarterLockNotice] = useState<string | null>(null);

  const isStarterTier = currentUser?.tier === 'starter';

  const currentCandidate =
    candidates.find((c) => c.id === selectedCandidateId) || candidates[0];

  const readFileContent = async (
    file: File,
    fallbackIndex?: number
  ): Promise<{ content: string; fileName: string; name: string }> => {
    const isPdf =
      file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    let content = '';

    if (isPdf) {
      try {
        content = await extractTextFromPdf(file);
      } catch (pdfErr) {
        console.warn('PDF extraction failed for uploaded file item:', (pdfErr as any)?.message || pdfErr);
        // Fallback: Never drop the file! Set helpful placeholder text so the user sees all resumes!
        content = `[Resume document: ${file.name}\nScanned document or non-extractable text layer. Please paste resume text directly here or evaluate against target JD.]`;
      }
    } else {
      content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve((event.target?.result as string) || '');
        reader.onerror = () => reject(new Error('Failed to read file text'));
        reader.readAsText(file);
      });
    }

    const fileCleanedName = cleanFileNameToName(file.name, fallbackIndex);
    const detectedName = autoExtractName ? extractNameFromText(content) : null;
    // Use the auto-extracted name if valid, otherwise fallback to the cleaned file name
    const name = detectedName || fileCleanedName;

    return { content, fileName: file.name, name };
  };

  const processUploadedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setParseError(null);

    // Convert incoming FileList to array without dropping any files
    const files = Array.from(fileList);
    if (files.length === 0) return;

    if (files.length === 1 && currentCandidate) {
      const file = files[0];
      const isPdf =
        file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

      try {
        if (isPdf) {
          setIsParsing(true);
          setParsingFileName(file.name);
        }

        const candidateIdx = candidates.findIndex((c) => c.id === currentCandidate.id);
        const { content, fileName, name } = await readFileContent(
          file,
          candidateIdx >= 0 ? candidateIdx : undefined
        );

        // Always update to the extracted real name from the resume or file
        const finalName = name || currentCandidate.name || 'Candidate';

        // When uploading a single file for the current candidate (or clicking "Replace with PDF"),
        // ALWAYS update/replace the current candidate directly. Never create an accidental duplicate tab!
        onUpdateCandidate(currentCandidate.id, {
          resumeText: content,
          fileName,
          name: finalName,
          status: 'idle',
          result: undefined, // Clear any previous score so it is fresh for evaluation
        });
      } catch (err: any) {
        console.error('File parsing failed:', err);
        setParseError(
          isPdf
            ? "Couldn't read this PDF — try copying the text manually instead"
            : 'Failed to read file. Please try pasting the text manually.'
        );
      } finally {
        setIsParsing(false);
        setParsingFileName('');
      }
    } else if (files.length > 1 && onBulkAddCandidates) {
      setIsParsing(true);

      try {
        let hadPdfFailure = false;
        const results = [];

        // Guaranteed non-dropping sequential parsing: exactly files.length results produced
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setParsingFileName(`[${i + 1}/${files.length}] ${file.name}`);
          
          try {
            const { content, fileName, name } = await readFileContent(file, i);
            results.push({
              name,
              resumeText: content && content.trim().length > 0 ? content : `[Resume document: ${file.name}\n(Text extraction incomplete - please verify text or evaluate directly)]`,
              fileName,
            });
            
            // Add a very small pacing delay if there is another file, to safeguard rate limiters
            if (i < files.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 60));
            }
          } catch (fileErr) {
            console.log('Error parsing candidate file index', i, ':', (fileErr as any)?.message || fileErr);
            const fallbackName = cleanFileNameToName(file.name, i);
            results.push({
              name: fallbackName,
              resumeText: `[Document: ${file.name} - scanned or non-extractable text layer. Please paste text here or evaluate directly.]`,
              fileName: file.name,
            });
          }
        }

        // CRITICAL: ALWAYS send all processed candidates. Never drop any uploaded resume.
        if (results.length > 0) {
          onBulkAddCandidates(results);
        }

        if (hadPdfFailure && results.length === 0) {
          setParseError("Couldn't read this PDF — try copying the text manually instead");
        }
      } catch (bulkErr) {
        console.log('Bulk parsing error:', bulkErr);
        setParseError("Couldn't read this PDF — try copying the text manually instead");
      } finally {
        setIsParsing(false);
        setParsingFileName('');
      }
    }
  };

  const handleResumeTextChange = (text: string) => {
    if (!currentCandidate) return;
    if (parseError) setParseError(null);
    const updates: Partial<CandidateItem> = { resumeText: text };

    // If candidate name is still generic like "Candidate 1", try auto-detecting real name
    if (
      autoExtractName &&
      (currentCandidate.name.startsWith('Candidate') || !currentCandidate.name.trim())
    ) {
      const detected = extractNameFromText(text);
      if (detected) {
        updates.name = detected;
      }
    }

    onUpdateCandidate(currentCandidate.id, updates);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processUploadedFiles(e.target.files);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processUploadedFiles(e.target.files);
    // Reset pdf input
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (isEvaluating || isParsing) return;
    await processUploadedFiles(e.dataTransfer.files);
  };

  const wordCount = currentCandidate?.resumeText.trim()
    ? currentCandidate.resumeText.trim().split(/\s+/).length
    : 0;

  return (
    <div className="bg-[#12151E]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col h-full shadow-xs">
      {/* Candidate Tabs Bar */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/[0.06] overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex items-center gap-1.5 shrink-0">
          {candidates.map((c, index) => {
            const isSelected = c.id === currentCandidate?.id;
            const isEvaluatingCandidate = c.status === 'evaluating';
            const hasScore = c.result?.score !== undefined;
            const score = c.result?.score || 0;
            const scoreColorClass =
              score >= 80
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                : score >= 50
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/25';

            return (
              <button
                key={c.id}
                type="button"
                id={`candidate-tab-${c.id}`}
                onClick={() => onSelectCandidate(c.id)}
                className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap active:scale-[0.98] min-h-[38px] ${
                  isSelected
                    ? 'bg-sky-500/15 text-sky-200 shadow-2xs ring-1 ring-sky-500/35 font-semibold'
                    : 'bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-white border border-white/[0.04]'
                }`}
              >
                <span className="opacity-60 text-[10px] font-mono">#{index + 1}</span>
                <span className="max-w-[120px] truncate">
                  {cleanCandidateDisplay(c.name) || `Candidate ${index + 1}`}
                </span>

                {/* Empty slot indicator */}
                {!c.resumeText.trim() && !isEvaluatingCandidate && !hasScore && (
                  <span className="text-[9px] text-zinc-500 italic font-mono">empty</span>
                )}

                {/* Loading spinner right in the candidate tab */}
                {isEvaluatingCandidate && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
                )}

                {hasScore && !isEvaluatingCandidate && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
                      isSelected ? 'bg-sky-400/20 text-sky-100 border border-sky-400/30' : scoreColorClass
                    }`}
                  >
                    {c.result?.score} pts
                  </span>
                )}

                {candidates.length > 1 && !isEvaluating && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCandidate(c.id);
                    }}
                    className={`p-1 rounded-md hover:bg-rose-500/20 hover:text-rose-300 ml-0.5 transition-colors cursor-pointer ${
                      isSelected ? 'text-zinc-400 hover:text-rose-300' : 'text-zinc-500 hover:text-rose-400'
                    }`}
                    title="Remove candidate slot"
                  >
                    <Trash2 className="w-3 h-3" />
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            id="add-candidate-tab-btn"
            onClick={onAddCandidate}
            disabled={isEvaluating || candidates.length >= 20}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 bg-white/[0.02] hover:bg-white/[0.06] hover:text-white border border-dashed border-white/[0.1] transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 min-h-[38px]"
            title="Add another candidate resume slot (up to 20)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Slot</span>
          </button>

          {onAdd10Slots && candidates.length <= 10 && (
            <button
              type="button"
              id="add-10-slots-btn"
              onClick={onAdd10Slots}
              disabled={isEvaluating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 min-h-[38px]"
              title="Create 10 candidate resume slots for bulk evaluation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+10 Slots</span>
            </button>
          )}

          {onClearAllCandidates && candidates.length > 1 && !isEvaluating && (
            <button
              type="button"
              id="clear-all-candidates-btn"
              onClick={onClearAllCandidates}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/25 transition-all duration-150 active:scale-[0.98] cursor-pointer shrink-0 min-h-[38px]"
              title="Clear all candidates and reset to 1 clean slot"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

        {/* Hidden File Inputs for Downward Button and Drag-and-Drop */}
        <input
          type="file"
          ref={pdfInputRef}
          onChange={handlePdfUpload}
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
        />
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".pdf,.txt,.md,.text,application/pdf"
          multiple
          className="hidden"
        />

      {/* Parsing Active Banner */}
      {isParsing && (
        <div className="mb-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 text-white text-xs flex items-center gap-2.5 shadow-xs animate-pulse">
          <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
          <div>
            <span className="font-semibold text-sky-400">Extracting PDF text: </span>
            <span className="text-zinc-300">
              Parsing {parsingFileName || 'document'} (handling layout & scanned text)...
            </span>
          </div>
        </div>
      )}

      {/* Parsing Error Banner */}
      {parseError && (
        <div className="mb-3 p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{parseError}</span>
          </div>
          <button
            type="button"
            onClick={() => setParseError(null)}
            className="text-rose-400 hover:text-rose-200 p-0.5 rounded cursor-pointer"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Candidate Name & Metadata Input */}
      {currentCandidate && (
        <div className="mb-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="candidate-name-input"
              value={currentCandidate.name}
              onChange={(e) =>
                onUpdateCandidate(currentCandidate.id, { name: e.target.value })
              }
              placeholder="Candidate Full Name (e.g., Alex Smith)"
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-[#0E1018]/80 border border-white/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/40 placeholder-zinc-500"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-mono text-zinc-400 bg-white/[0.03] px-2.5 py-1.5 rounded-xl border border-white/[0.06]">
            <span>{wordCount} words</span>
            {currentCandidate.fileName && (
              <span className="truncate max-w-[130px] text-zinc-300 font-sans" title={currentCandidate.fileName}>
                📄 {currentCandidate.fileName}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Resume Text Editor with Drag and Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDraggingOver(false);
        }}
        onDrop={handleDrop}
        className={`flex-1 flex flex-col min-h-[260px] relative group rounded-xl transition-all ${
          isDraggingOver ? 'ring-2 ring-sky-500/30 bg-sky-500/5' : ''
        }`}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-20 bg-[#0E1018]/90 border-2 border-dashed border-sky-400 rounded-xl flex flex-col items-center justify-center pointer-events-none p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 mb-2 animate-bounce">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-white">
              Drop PDF or text resumes here
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              Supports native PDFs, scanned PDFs, .txt, and .md
            </p>
          </div>
        )}

        <textarea
          id="candidate-resume-textarea"
          value={currentCandidate?.resumeText || ''}
          onChange={(e) => handleResumeTextChange(e.target.value)}
          disabled={isEvaluating || isParsing}
          placeholder="Paste full Candidate Resume text here, or drag & drop resume files (.pdf, .txt, .md)..."
          className="w-full flex-1 p-3.5 text-xs sm:text-sm font-sans leading-relaxed text-zinc-100 placeholder-zinc-500 bg-[#0E1018]/80 border border-white/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/40 resize-none transition-all disabled:opacity-60"
        />

        {/* Empty state quick helper banner when resume text is empty */}
        {(!currentCandidate?.resumeText || currentCandidate.resumeText.trim().length === 0) && (
          <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-[#12151E]/95 backdrop-blur-md border border-white/[0.08] flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <Upload className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Have a PDF resume file?</span>
            </div>
            <button
              type="button"
              id="select-pdf-downward-btn"
              onClick={() => pdfInputRef.current?.click()}
              disabled={isEvaluating || isParsing}
              className="text-xs text-white font-medium px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Select PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Evaluation Action Controls */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {currentCandidate?.resumeText.trim().length > 50 ? (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Resume populated
              </span>
              <button
                type="button"
                id="replace-pdf-btn"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isEvaluating || isParsing}
                className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                title="Select a different PDF resume file"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Replace with PDF</span>
              </button>
            </div>
          ) : (
            <span className="flex items-center gap-1 text-amber-300">
              <AlertCircle className="w-3.5 h-3.5" /> Paste resume text to evaluate
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Quick Calibration Mode Selector */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#0E1018]/90 border border-white/[0.08] shadow-2xs">
            {(['standard', 'strict', 'lenient'] as const).map((mode) => {
              const isLockedForStarter = isStarterTier && mode !== 'standard';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (isLockedForStarter) {
                      setStarterLockNotice(
                        '3-Mode Calibration (⚡ Strict & Lenient) is locked on Starter ($39 / ₹3,705). Available on Free Trial, Pro ($79 / ₹7,505), and Agency ($119 / ₹11,305).'
                      );
                      return;
                    }
                    setStarterLockNotice(null);
                    onStrictnessModeChange?.(mode);
                  }}
                  disabled={isEvaluating}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                    strictnessMode === mode
                      ? mode === 'strict'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                        : mode === 'standard'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-xs'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs'
                      : isLockedForStarter
                      ? 'text-zinc-500 hover:text-zinc-400 border border-transparent'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                  title={
                    isLockedForStarter
                      ? `${mode === 'strict' ? 'Strict' : 'Lenient'} calibration mode is locked on the Starter tier. Upgrade to Pro ($79 / ₹7,505) or Agency ($119 / ₹11,305) to unlock.`
                      : mode === 'strict'
                      ? 'Strict: Uncompromising auditor discipline (zero tolerance for gaps)'
                      : mode === 'standard'
                      ? 'Standard: Balanced 100-point rubric'
                      : 'Lenient: Benefit of the doubt for adjacent skills'
                  }
                >
                  <span>{mode === 'strict' ? '⚡ Strict' : mode === 'standard' ? 'Standard' : 'Lenient'}</span>
                  {isLockedForStarter && (
                    <Lock className="w-2.5 h-2.5 text-amber-400/90 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {candidates.length > 1 && (
            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
              <button
                type="button"
                id="evaluate-all-candidates-btn"
                onClick={onEvaluateAll}
                disabled={isEvaluating || !(canEvaluateAll ?? (candidates.some((c) => c.resumeText.trim())))}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-100 bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] border border-white/[0.08] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[42px]"
                title={
                  candidates.filter((c) => !c.resumeText.trim()).length > 0
                    ? `Evaluate ${candidates.filter((c) => c.resumeText.trim()).length} candidate resumes (${candidates.filter((c) => !c.resumeText.trim()).length} empty slots skipped)`
                    : 'Evaluate all candidates concurrently'
                }
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>Evaluating Pool...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      Evaluate All ({candidates.filter((c) => c.resumeText.trim()).length}
                      {candidates.filter((c) => !c.resumeText.trim()).length > 0
                        ? `/${candidates.length}`
                        : ''}
                      )
                    </span>
                    <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px] font-mono border border-sky-500/20">
                      Parallel
                    </span>
                  </>
                )}
              </button>
              {candidates.filter((c) => !c.resumeText.trim()).length > 0 && !isEvaluating && (
                <span className="text-[10px] text-zinc-500 mt-1 font-mono">
                  {candidates.filter((c) => c.resumeText.trim()).length} ready ·{' '}
                  {candidates.filter((c) => !c.resumeText.trim()).length} empty
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            id="evaluate-candidate-btn"
            onClick={onEvaluateCurrent}
            disabled={isEvaluating || !canEvaluate}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-xs transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Evaluating 100-Pt Rubric...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Evaluate 100-Pt Rubric</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Legal Decision-Support & Terms Acceptance Notice */}
      <div className="pt-2 text-center sm:text-right">
        <p className="text-[10px] text-zinc-500">
          By running evaluations, you accept Vathmos's{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-cyan-400 underline underline-offset-2">Terms</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-cyan-400 underline underline-offset-2">Privacy Policy</a>
          . Evaluations serve as advisory decision-support only.
        </p>
      </div>
    </div>
  );
};
