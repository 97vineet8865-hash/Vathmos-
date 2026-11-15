// ==========================================
// Vathmos Evaluation Pipeline (TypeScript)
// ==========================================

import { extractTextFromPdf } from './pdfParser';
import { EvaluationResult } from '../types';

// --- 1. INTERFACES ---

export interface Candidate {
  name: string;
  filename?: string; // Added to prevent nameless resumes from being accidentally deleted
  resumeText?: string;
  portfolio?: string;
  [key: string]: any;
}

export interface GeminiEvaluationResult {
  name: string;
  totalScore: number; // Used for sorting the leaderboard
  tier: string;
  hardRequirements: number;
  domainDepth: number;
  verifiableEvidence: number;
  [key: string]: any;
}

// --- 2. IMPLEMENTED LOGIC (Hooked to backend & PDF engine) ---

export async function callGeminiAPI(candidate: Candidate, jd: string): Promise<GeminiEvaluationResult> {
  let authToken: string | null = null;
  try {
    authToken = localStorage.getItem('vathmos_auth_token');
  } catch {}

  const response = await fetch('/api/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      jobDescription: jd,
      resumeText: candidate.resumeText || '',
      candidateName: candidate.name || 'Candidate',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: any = new Error(errorData.error || `Server returned ${response.status}`);
    error.status = response.status;
    error.code = response.status;
    throw error;
  }

  const data: EvaluationResult = await response.json();
  return {
    name: data.candidate_name || candidate.name,
    totalScore: data.score,
    tier: data.recommendation,
    hardRequirements: data.score_breakdown?.hard_requirements || 0,
    domainDepth: data.score_breakdown?.domain_depth || 0,
    verifiableEvidence: data.score_breakdown?.verifiable_evidence || 0,
    score_breakdown: data.score_breakdown,
    matched_skills: data.matched_skills,
    missing_skills: data.missing_skills,
    pros: data.pros,
    cons: data.cons,
    rank_reasoning: data.rank_reasoning,
    rubric_analysis: data.rubric_analysis,
    recommendation: data.recommendation,
    rawResult: data,
  };
}

export async function parsePDFResumes(files: File[]): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  
  for (const file of files) {
    try {
      const text = await extractTextFromPdf(file);
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[._\-]+/g, ' ')
        .replace(/\b(resume|cv|final|portfolio|profile|hiring|evaluation|vathmos|updated|new|draft|latest|2024|2025|2026)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      candidates.push({
        name: cleanName || 'Candidate',
        filename: file.name,
        resumeText: text,
      });
    } catch (err) {
      console.warn('Failed to parse PDF file item:', (err as any)?.message || err);
    }
  }

  return candidates;
}


// --- 3. DEDUPLICATION LOGIC ---

export function deduplicateCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  
  return candidates.filter((candidate) => {
    // FIX: Combine name and filename to create a unique key. 
    // This stops resumes named "Candidate" or empty names from overwriting each other.
    const baseName = candidate.name ? candidate.name.toLowerCase().trim() : 'unknown';
    const fileName = candidate.filename ? candidate.filename.toLowerCase().trim() : 'nofile';
    const key = `${baseName}-${fileName}`;
    
    if (seen.has(key)) {
      console.warn('Duplicate candidate entry detected and filtered.');
      return false; // Skip duplicate
    }
    
    seen.add(key);
    return true;
  });
}


// --- 4. RETRY & RATE LIMIT HANDLING ---

export async function evaluateCandidateWithRetry(
  candidate: Candidate,
  jd: string,
  maxRetries: number = 3
): Promise<GeminiEvaluationResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await callGeminiAPI(candidate, jd);
      return result;
    } catch (error: any) {
      const isRateLimitError = error.code === 429 || error.status === 429;
      
      if (isRateLimitError && attempt < maxRetries - 1) {
        // Fast backoff: 1.5s, 3s
        const waitTime = (attempt + 1) * 1500;
        const waitSeconds = waitTime / 1000;
        
        console.warn(
          `⚠️ Upstream RPM limit reached. Retrying in ${waitSeconds}s (attempt ${attempt + 1}/${maxRetries})...`
        );
        
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else if (isRateLimitError) {
        throw new Error(
          `RPM limit exceeded after ${maxRetries} retries. Free tier daily reset tomorrow. Please try again then.`
        );
      } else {
        throw error; // Throw other non-429 errors immediately
      }
    }
  }
  
  throw new Error(`Failed to evaluate candidate after ${maxRetries} attempts`);
}


// --- 5. BATCH PROCESSING ENGINE ---

export async function batchEvaluateWithDelay(
  resumes: Candidate[],
  jd: string,
  batchSize: number = 5,
  delayBetweenBatches: number = 500 // Smooth high-speed pacing without artificial 30s stalls
): Promise<GeminiEvaluationResult[]> {
  const results: GeminiEvaluationResult[] = [];
  
  for (let i = 0; i < resumes.length; i += batchSize) {
    const batch = resumes.slice(i, i + batchSize);
    console.log(`📊 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} resumes)...`);
    
    try {
      // Evaluate all in this batch in parallel
      const batchResults = await Promise.all(
        batch.map((resume) => evaluateCandidateWithRetry(resume, jd))
      );
      results.push(...batchResults);
      
      // Wait briefly between batches (except after the last one)
      const hasMoreBatches = i + batchSize < resumes.length;
      if (hasMoreBatches) {
        const delaySeconds = delayBetweenBatches / 1000;
        console.log(`⏳ Batch complete. Pacing ${delaySeconds}s before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    } catch (error) {
      console.error(`❌ Batch processing failed:`, error);
      throw error;
    }
  }
  
  console.log(`✅ All batches processed. Total candidates evaluated: ${results.length}`);
  return results;
}


// --- 6. MASTER ORCHESTRATOR ---
// Call this function from your frontend React component

export async function handleCandidateEvaluation(
  files: File[],
  jd: string
): Promise<GeminiEvaluationResult[]> {
  try {
    // Step 1: Parse PDFs
    console.log("📄 Parsing PDF resumes...");
    let candidates = await parsePDFResumes(files);
    
    // Step 2: Deduplicate
    console.log("🧹 Removing duplicate candidates...");
    candidates = deduplicateCandidates(candidates);
    console.log(`✅ Unique candidates remaining: ${candidates.length}`);
    
    // Step 3: Evaluate with batching and retry logic
    console.log("🤖 Starting evaluation with Gemini...");
    const results = await batchEvaluateWithDelay(candidates, jd);
    
    // Step 4: Return mathematically ranked results (Highest score first)
    const ranked = results.sort((a, b) => b.totalScore - a.totalScore);
    return ranked;
    
  } catch (error) {
    console.error("Evaluation pipeline failed:", error);
    throw error;
  }
}
