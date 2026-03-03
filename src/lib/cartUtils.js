// Cart and product utilities
// Shared functions for cart management and product display across pages

const CART_STORAGE_KEY = 'incognito_farm_cart';

/**
 * Get cart from localStorage
 * @returns {array} Cart items array
 */
export function getCart() {
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY);
    return cart ? JSON.parse(cart) : [];
  } catch (error) {
    console.error('Error reading cart:', error);
    return [];
  }
}

/**
 * Save cart to localStorage
 * @param {array} cart - Cart items array
 */
export function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving cart:', error);
  }
}

/**
 * Add item to cart or increase quantity
 * @param {number} productId - Product ID
 * @param {number} quantity - Quantity to add (default: 1)
 */
export function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const existingItem = cart.find(item => item.productId === productId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  
  saveCart(cart);
}

/**
 * Update cart badge with current cart count
 * Finds the badge element by ID and updates text and visibility
 */
export function updateCartBadge() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cart-badge');
  
  if (badge) {
    if (totalItems > 0) {
      badge.textContent = totalItems;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  }
}

/**
 * Format date for Bulgarian users
 * Converts ISO date format (with or without time) to Bulgarian locale string
 * @param {string} dateValue - Date string in ISO format (YYYY-MM-DD or ISO 8601)
 * @returns {string} Formatted date (DD.MM.YYYY) or original value if invalid
 */
export function formatDateForBulgarianUsers(dateValue) {
  if (!dateValue || typeof dateValue !== 'string') return '–';

  const normalizedValue = dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`;
  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) return dateValue;
  return parsedDate.toLocaleDateString('bg-BG');
}
