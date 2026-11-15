import React, { useRef, useState } from 'react';
import { Briefcase, FileText, Check, AlertCircle, Upload, Loader2, X } from 'lucide-react';
import { extractTextFromPdf } from '../utils/pdfParser';

interface JobDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const JobDescriptionEditor: React.FC<JobDescriptionEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsingFileName, setParsingFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  const processPdfFile = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      // If it's a plain text file, read directly as text
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        try {
          const text = await file.text();
          onChange(text);
          setParseError(null);
          return;
        } catch {
          setParseError('Unable to read text file.');
          return;
        }
      }
      setParseError('Please upload a PDF or text file (.pdf, .txt, .md).');
      return;
    }

    setIsParsing(true);
    setParsingFileName(file.name);
    setParseError(null);

    try {
      const extractedText = await extractTextFromPdf(file);
      if (extractedText && extractedText.trim().length > 0) {
        onChange(extractedText);
      } else {
        setParseError("Couldn't extract text from this PDF — try copying and pasting instead");
      }
    } catch (err: any) {
      console.error('JD PDF extraction error:', err);
      setParseError(
        err?.message || "Couldn't read this PDF — try copying the text manually instead"
      );
    } finally {
      setIsParsing(false);
      setParsingFileName('');
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processPdfFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (disabled || isParsing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processPdfFile(file);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !isParsing) setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
      }}
      onDrop={handleDrop}
      className={`bg-[#12151E]/80 backdrop-blur-xl border rounded-2xl p-4 sm:p-5 flex flex-col h-full shadow-xs transition-all relative ${
        isDraggingOver
          ? 'border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20'
          : 'border-white/[0.08]'
      }`}
    >
      {/* Hidden File Input for PDF */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain"
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled || isParsing}
      />

      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center shadow-2xs">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Job Description (JD)</h3>
            <p className="text-xs text-zinc-400">Benchmark criteria & required qualifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Upload JD PDF Button */}
          <button
            type="button"
            id="upload-jd-pdf-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isParsing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] text-zinc-200 hover:text-white border border-white/[0.08] transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[34px] shadow-2xs"
            title="Upload Job Description as PDF or document"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>Reading PDF...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Upload JD PDF</span>
              </>
            )}
          </button>
          <span className="text-xs font-mono text-zinc-400 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 rounded-lg">
            {wordCount} words
          </span>
        </div>
      </div>

      {/* Parse Error Alert */}
      {parseError && (
        <div className="mb-3 p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span>{parseError}</span>
          </div>
          <button
            type="button"
            onClick={() => setParseError(null)}
            className="text-rose-400 hover:text-rose-200 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Textarea with Drag Overlay */}
      <div className="flex-1 flex flex-col min-h-[260px] relative">
        <textarea
          id="job-description-textarea"
          value={value}
          onChange={(e) => {
            if (parseError) setParseError(null);
            onChange(e.target.value);
          }}
          disabled={disabled || isParsing}
          placeholder="Paste the target Job Description here, or click 'Upload JD PDF' / drag & drop a PDF file..."
          className="w-full flex-1 p-3.5 text-xs sm:text-sm font-sans leading-relaxed text-zinc-100 placeholder-zinc-500 bg-[#0E1018]/80 border border-white/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/40 resize-none transition-all"
        />

        {/* Parsing Indicator Overlay */}
        {isParsing && (
          <div className="absolute inset-0 bg-[#0E1018]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 rounded-xl z-10">
            <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            <p className="text-xs font-medium text-white">Extracting Job Description from PDF...</p>
            {parsingFileName && (
              <p className="text-[11px] text-zinc-400 font-mono">{parsingFileName}</p>
            )}
          </div>
        )}

        {/* Drag Over Overlay */}
        {isDraggingOver && !isParsing && (
          <div className="absolute inset-0 bg-sky-500/10 border-2 border-dashed border-sky-400 rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none z-10">
            <Upload className="w-8 h-8 text-sky-400 animate-bounce" />
            <p className="text-sm font-medium text-white">Drop Job Description PDF here</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-zinc-400" />
          <span>Supports text paste, .pdf upload, or drag-and-drop</span>
        </span>
        {value.trim().length > 50 ? (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <Check className="w-3.5 h-3.5" /> Ready for evaluation
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-300">
            <AlertCircle className="w-3.5 h-3.5" /> Please add full job requirements
          </span>
        )}
      </div>
    </div>
  );
};
