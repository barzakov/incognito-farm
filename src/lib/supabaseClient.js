import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase environment variables. Please check your .env file.');
}

// Initialize Supabase client (null if env vars are missing)
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ─── Auth helpers ────────────────────────────────────────────

/**
 * Register a new user via Supabase Auth.
 * Passes name fields as user_metadata so the DB trigger can pick them up.
 * @param {string} email
 * @param {string} password
 * @param {{ name?: string, second_name?: string, lastname?: string }} meta
 * @returns {Promise<object>} data returned by signUp
 */
export async function registerUser(email, password, meta = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: meta.name || '',
        second_name: meta.second_name || '',
        lastname: meta.lastname || '',
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Login with email + password.
 * @returns {Promise<object>} session / user data
 */
export async function authenticateUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out the current user.
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── User data helpers ───────────────────────────────────────

/**
 * Get the current Supabase Auth user (JWT-verified).
 * @returns {Promise<object|null>} auth user or null
 */
export async function fetchAuthUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the current session (access token, etc.).
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Fetch the public `users` row for a given user_id.
 * @param {number} userId
 */
export async function fetchUserData(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Fetch the public `users` row that matches the current auth user's UUID.
 * This is the main way to get the app-level user profile.
 * @returns {Promise<object|null>}
 */
export async function fetchCurrentUserProfile() {
  const authUser = await fetchAuthUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('supa_user_uuid', authUser.id)
    .is('deleted_on', null)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  return data;
}

/**
 * Check whether the currently logged-in user has boss (admin) privileges.
 * @returns {Promise<boolean>}
 */
export async function isBoss() {
  const profile = await fetchCurrentUserProfile();
  return profile?.boss === true;
}

// ─── Auth state listener ─────────────────────────────────────

/**
 * Subscribe to auth state changes (login, logout, token refresh).
 * @param {function} callback - receives (event, session)
 * @returns {{ data: { subscription } }}
 */
export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange(callback);
}
