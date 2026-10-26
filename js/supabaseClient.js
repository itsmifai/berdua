// ==============================================================================
// BERDUA — Supabase Client Setup (Vanilla ES Modules)
// ==============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Ganti nilai konstanta di bawah ini dengan Project URL & Anon Key dari Dashboard Supabase Anda:
// Project Settings -> API -> Project URL & Project API keys (anon public)
export const DEFAULT_SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const SUPABASE_URL = 
  window.__ENV__?.SUPABASE_URL || 
  localStorage.getItem('berdua_supabase_url') || 
  DEFAULT_SUPABASE_URL;

export const SUPABASE_ANON_KEY = 
  window.__ENV__?.SUPABASE_ANON_KEY || 
  localStorage.getItem('berdua_supabase_anon_key') || 
  DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = () => {
  return SUPABASE_URL && 
    SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co' && 
    SUPABASE_ANON_KEY && 
    SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY';
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
