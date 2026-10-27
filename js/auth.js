// ==============================================================================
// BERDUA — Authentication & Session Guard (Supabase Auth)
// ==============================================================================

import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { showToast, shakeElement } from './fx.js';

/**
 * Mendapatkan sesi aktif saat ini
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }
  return session;
}

/**
 * Mendapatkan profil pengguna yang sedang login beserta couple_id dan partner
 */
export async function getCurrentProfile() {
  const session = await getSession();
  if (!session?.user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, couples(*)')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  // Ambil profil pasangan bila couple_id ada
  let partner = null;
  if (profile.couple_id) {
    const { data: partnerData } = await supabase
      .from('profiles')
      .select('*')
      .eq('couple_id', profile.couple_id)
      .neq('id', profile.id)
      .maybeSingle();

    partner = partnerData;
  }

  return { ...profile, partner };
}

/**
 * Login dengan Email dan Password
 */
export async function login(email, password) {
  if (!isSupabaseConfigured()) {
    showToast('Konfigurasi Supabase belum diisi di supabaseClient.js');
    return { error: new Error('Supabase belum dikonfigurasi') };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: password
  });

  if (error) {
    console.warn('Login gagal:', error.message);
    return { error };
  }

  return { data };
}

/**
 * Logout dari aplikasi
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

/**
 * Kirim email reset password
 */
export async function sendPasswordReset(email) {
  if (!email) {
    showToast('Masukkan alamat email kamu');
    return { error: new Error('Email kosong') };
  }

  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin + '/login.html'
  });

  if (error) {
    return { error };
  }
  return { data };
}

/**
 * Session Guard untuk index.html: Lempar ke login.html jika belum login
 */
export async function requireAuth() {
  if (!isSupabaseConfigured()) {
    console.error('[Auth] Supabase belum dikonfigurasi!');
    return null;
  }
  const session = await getSession();
  console.log('[Auth] Session:', session ? `Ada (${session.user?.email})` : 'Tidak ada');
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

/**
 * Session Guard untuk login.html: Lempar ke index.html jika sudah login
 */
export async function redirectIfAuth() {
  if (!isSupabaseConfigured()) {
    return false;
  }
  const session = await getSession();
  console.log('[Auth] redirectIfAuth - Session:', session ? `Ada (${session.user?.email})` : 'Tidak ada');
  if (session) {
    window.location.href = 'index.html';
    return true;
  }
  return false;
}
