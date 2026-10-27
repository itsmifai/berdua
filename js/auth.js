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

  console.log('[Profile] Fetching profile for user ID:', session.user.id);

  // Coba ambil profil pengguna saat ini
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('[Profile] Error fetch profile:', error.message, error.details);
    return null;
  }

  if (!profile) {
    console.warn('[Profile] Profil belum ada di DB untuk UID:', session.user.id, '. Pastikan seed.sql sudah dijalankan!');
    return null;
  }

  console.log('[Profile] Berhasil load:', profile.display_name, '| couple_id:', profile.couple_id);

  // Ambil profil pasangan bila couple_id ada
  let partner = null;
  if (profile.couple_id) {
    const { data: partnerData, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('couple_id', profile.couple_id)
      .neq('id', profile.id)
      .maybeSingle();

    if (pErr) console.warn('[Profile] Gagal fetch partner:', pErr.message);
    partner = partnerData;
    console.log('[Profile] Partner:', partner?.display_name || 'tidak ditemukan');
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
 * Session Guard untuk login.html: Lempar ke index.html hanya jika sudah login DAN punya profil valid
 */
export async function redirectIfAuth() {
  if (!isSupabaseConfigured()) {
    return false;
  }
  const session = await getSession();
  console.log('[Auth] redirectIfAuth - Session:', session ? `Ada (${session.user?.email})` : 'Tidak ada');
  if (session) {
    const profile = await getCurrentProfile();
    if (profile && profile.couple_id) {
      window.location.href = 'index.html';
      return true;
    } else {
      console.warn('[Auth] Session aktif tapi profil belum diset di Supabase. Tidak auto-redirect.');
      return false;
    }
  }
  return false;
}
