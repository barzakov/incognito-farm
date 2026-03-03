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

// ─── Discount helpers ────────────────────────────────────────

/**
 * Fetch all discount records from the discount table.
 * @returns {Promise<array>} array of discount objects
 */
export async function fetchAllDiscounts() {
  const { data, error } = await supabase
    .from('discount')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Fetch a single discount by ID.
 * @param {number} discountId
 * @returns {Promise<object|null>}
 */
export async function fetchDiscountById(discountId) {
  const { data, error } = await supabase
    .from('discount')
    .select('*')
    .eq('discount_id', discountId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Create a new discount record.
 * @param {{start_date: string, end_date: string}} discount - date strings (ISO format)
 * @returns {Promise<object>} created discount
 */
export async function createDiscount(discount) {
  const { data, error } = await supabase
    .from('discount')
    .insert([discount])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Update an existing discount record.
 * @param {number} discountId
 * @param {{start_date?: string, end_date?: string}} updates
 * @returns {Promise<object>} updated discount
 */
export async function updateDiscount(discountId, updates) {
  const { data, error } = await supabase
    .from('discount')
    .update(updates)
    .eq('discount_id', discountId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Delete a discount record.
 * @param {number} discountId
 * @returns {Promise<void>}
 */
export async function deleteDiscount(discountId) {
  const { error } = await supabase
    .from('discount')
    .delete()
    .eq('discount_id', discountId);
  if (error) throw error;
}

/**
 * Fetch active group discount for a given product group.
 * Only returns discount if current date is within start_date and end_date.
 * @param {number} groupId
 * @returns {Promise<object|null>} discount object or null
 */
export async function fetchActiveGroupDiscount(groupId) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const { data, error } = await supabase
    .from('product_group')
    .select(`
      group_discount,
      discount!inner(
        discount_id,
        start_date,
        end_date
      )
    `)
    .eq('group_id', groupId)
    .gte('discount.start_date', today)
    .lte('discount.end_date', today)
    .single();
  
  if (error) {
    // If no active discount, just return null
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data?.discount || null;
}

/**
 * Fetch all products with their group discount info.
 * Returns products with nested group and discount data.
 * @returns {Promise<array>} array of products with group/discount info
 */
export async function fetchProductsWithGroupDiscounts() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      product_id,
      images_location,
      description,
      extra,
      group_id,
      price,
      discount,
      availability,
      created_on,
      product_group!inner(
        group_id,
        name,
        group_discount,
        discount!left(
          discount_id,
          start_date,
          end_date
        )
      )
    `);
  
  if (error) throw error;
  return data || [];
}

/**
 * Determine which discount to apply between product-level and group-level.
 * Returns the better (lower final price).
 * @param {number} productPrice - original product price
 * @param {number|null} productDiscount - product-level discount percentage (0-100)
 * @param {object|null} groupDiscount - group discount object with discount_percentage, start_date, end_date
 * @returns {object} { finalPrice, discountApplied, discountSource }
 *   discountSource: 'product', 'group', or 'none'
 */
export function calculateBestDiscount(productPrice, productDiscount, groupDiscount) {
  const basePrice = Number(productPrice) || 0;

  // Validate dates for group discount
  let validGroupDiscount = null;
  if (groupDiscount?.start_date && groupDiscount?.end_date) {
    const today = new Date().toISOString().split('T')[0];
    // Support both "YYYY-MM-DDTHH:mm:ss" and "YYYY-MM-DD HH:mm:ss"
    const startDate = String(groupDiscount.start_date).split('T')[0].split(' ')[0];
    const endDate = String(groupDiscount.end_date).split('T')[0].split(' ')[0];
    if (today >= startDate && today <= endDate) {
      validGroupDiscount = groupDiscount;
    }
  }

  const productDiscountPct = productDiscount != null ? Number(productDiscount) : null;
  const productDiscountFinalPrice =
    productDiscountPct != null && !Number.isNaN(productDiscountPct)
      ? basePrice * (1 - (productDiscountPct / 100))
      : null;

  const groupDiscountPct = validGroupDiscount?.discount_percentage != null
    ? Number(validGroupDiscount.discount_percentage)
    : null;
  const groupDiscountFinalPrice =
    groupDiscountPct != null && !Number.isNaN(groupDiscountPct)
      ? basePrice * (1 - (groupDiscountPct / 100))
      : null;

  // If no discounts apply
  if (productDiscountFinalPrice == null && groupDiscountFinalPrice == null) {
    return {
      finalPrice: basePrice,
      discountApplied: null,
      discountSource: 'none',
    };
  }

  // If only product discount
  if (productDiscountFinalPrice != null && groupDiscountFinalPrice == null) {
    return {
      finalPrice: productDiscountFinalPrice,
      discountApplied: productDiscountPct,
      discountSource: 'product',
    };
  }

  // If only group discount
  if (productDiscountFinalPrice == null && groupDiscountFinalPrice != null) {
    return {
      finalPrice: groupDiscountFinalPrice,
      discountApplied: groupDiscountPct,
      discountSource: 'group',
    };
  }

  // Both discounts exist - pick the lower final price
  if (productDiscountFinalPrice <= groupDiscountFinalPrice) {
    return {
      finalPrice: productDiscountFinalPrice,
      discountApplied: productDiscountPct,
      discountSource: 'product',
    };
  }

  return {
    finalPrice: groupDiscountFinalPrice,
    discountApplied: groupDiscountPct,
    discountSource: 'group',
  };
}
