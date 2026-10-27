// ==============================================================================
// BERDUA — Supabase Client Setup (Vanilla ES Modules)
// ==============================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Ganti nilai konstanta di bawah ini dengan Project URL & Anon Key dari Dashboard Supabase Anda:
// Project Settings -> API -> Project URL & Project API keys (anon public)
export const DEFAULT_SUPABASE_URL = 'https://otzynscmqliucdfcnuwb.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90enluc2NtcWxpdWNkZmNudXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTUwNjUsImV4cCI6MjEwODYzMTA2NX0.Sa9zI9bohQLLsBjBkkaYsTgJhKywxNH8D22jIEzbvZA';

export const SUPABASE_URL = 
  window.__ENV__?.SUPABASE_URL || 
  localStorage.getItem('berdua_supabase_url') || 
  DEFAULT_SUPABASE_URL;

export const SUPABASE_ANON_KEY = 
  window.__ENV__?.SUPABASE_ANON_KEY || 
  localStorage.getItem('berdua_supabase_anon_key') || 
  DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = () => {
  const ok = SUPABASE_URL && 
    SUPABASE_URL !== 'https://YOUR_PROJECT_ID.supabase.co' && 
    SUPABASE_ANON_KEY && 
    SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY';
  console.log('[Supabase] isConfigured:', ok, '| URL:', SUPABASE_URL?.substring(0, 40));
  return ok;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
