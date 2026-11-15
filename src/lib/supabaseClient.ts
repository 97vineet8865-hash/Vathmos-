import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Public browser credentials (safe for client-side use with Row Level Security)
const DEFAULT_SUPABASE_URL = 'https://vzekrvpgxyjjnmkfwgot.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_2Q9oAS24CQnSgAWvdgyk6w_cSA2yDrr';

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_PUBLISHABLE_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl.startsWith('https://') &&
      !supabaseUrl.includes('your-project')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface SupabaseProfile {
  id: string;
  email: string;
  full_name?: string;
  company_name?: string;
  role_title?: string;
  white_label?: any;
  created_at?: string;
  updated_at?: string;
}

/**
 * Checks whether the backend Supabase Secret Key is also configured on Vercel / server.
 */
export async function checkBackendSupabaseStatus(): Promise<{
  configured: boolean;
  clientConfigured: boolean;
}> {
  const clientConfigured = isSupabaseConfigured();
  try {
    const res = await fetch('/api/profile-sync?status=1');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      return {
        configured: Boolean(data?.configured),
        clientConfigured,
      };
    }
  } catch {
    // ignore
  }
  return { configured: false, clientConfigured };
}

/**
 * Synchronize user profile & white-label branding into Supabase via secure server route.
 * Falls back gracefully without throwing if secret key isn't configured yet.
 */
export async function syncProfileToSupabase(user: {
  id: string;
  email: string;
  name?: string;
  companyName?: string;
  role?: string;
  avatarColor?: string;
  tier?: string;
  evaluationsLimit?: number;
  evaluationsUsed?: number;
  interviewQuestionsLimit?: number;
  interviewQuestionsUsed?: number;
  whiteLabel?: any;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/profile-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data?.success) {
        return { success: true };
      }
      if (data?.error) {
        return { success: false, error: data.error };
      }
    }
  } catch (err: any) {
    console.warn('[Supabase Server Sync Notice]:', err?.message || err);
  }

  return { success: false, error: 'Server sync pending SUPABASE_SECRET_KEY' };
}

/**
 * Fetch profile from Supabase via server endpoint if connected.
 */
export async function fetchProfileFromSupabase(email: string): Promise<SupabaseProfile | null> {
  if (!email) return null;

  try {
    const res = await fetch(`/api/profile-sync?email=${encodeURIComponent(email)}`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data?.profile) {
        return data.profile as SupabaseProfile;
      }
    }
  } catch {
    // ignore
  }

  return null;
}
