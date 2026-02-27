// Shared component loader for header and footer
// Handles dynamic loading of reusable layout components

import { fetchCurrentUserProfile, logoutUser, onAuthStateChange } from './supabaseClient.js';
import { toast } from './toast.js';

/**
 * Load header and footer components dynamically
 * Initializes navigation and menu functionality
 */
export async function loadComponents() {
  document.body.classList.add('layout-loading');
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch('/components/Header.html'),
      fetch('/components/Footer.html'),
    ]);

    if (!headerRes.ok) throw new Error(`Header fetch failed: ${headerRes.status}`);
    if (!footerRes.ok) throw new Error(`Footer fetch failed: ${footerRes.status}`);

    const [headerHTML, footerHTML] = await Promise.all([
      headerRes.text(),
      footerRes.text(),
    ]);

    const headerContainer = document.getElementById('header-container');
    if (headerContainer) headerContainer.innerHTML = headerHTML;

    const footerContainer = document.getElementById('footer-container');
    if (footerContainer) footerContainer.innerHTML = footerHTML;

    initializeMobileMenu();
    setActiveNavLink();
    await updateAuthUI();
    updateCartBadge();
    initializeLogoutButton();
  } catch (error) {
    console.error('Error loading components:', error);
  } finally {
    // Use requestAnimationFrame to defer the layout-loading removal
    // This prevents triggering layout calculations before the page is ready
    requestAnimationFrame(() => {
      document.body.classList.remove('layout-loading');
    });
  }
}

/**
 * Update cart badge with current cart count
 */
function updateCartBadge() {
  const CART_STORAGE_KEY = 'incognito_farm_cart';
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY);
    const cartItems = cart ? JSON.parse(cart) : [];
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-badge');
    
    if (badge) {
      if (totalItems > 0) {
        badge.textContent = totalItems;
        badge.classList.remove('d-none');
      } else {
        badge.classList.add('d-none');
      }
    }
  } catch (error) {
    console.error('Error updating cart badge:', error);
  }
}

/**
 * Update header UI based on current auth state.
 * Shows/hides guest vs user nav sections and admin link.
 */
async function updateAuthUI() {
  const navGuest = document.getElementById('nav-guest');
  const navUser = document.getElementById('nav-user');
  const navAdminItem = document.getElementById('nav-admin-item');
  const navUserDisplay = document.getElementById('nav-user-display');

  if (!navGuest || !navUser) return;

  try {
    const profile = await fetchCurrentUserProfile();

    if (profile) {
      // User is logged in
      navGuest.classList.add('d-none');
      navGuest.classList.remove('d-flex');
      navUser.classList.remove('d-none');
      navUser.classList.add('d-flex');

      // Display name
      const displayName = profile.name || 'Потребител';
      navUserDisplay.textContent = displayName;

      // Show admin link if boss
      if (profile.boss && navAdminItem) {
        navAdminItem.classList.remove('d-none');
      }
    } else {
      // Not logged in – show guest nav
      navGuest.classList.remove('d-none');
      navGuest.classList.add('d-flex');
      navUser.classList.add('d-none');
      navUser.classList.remove('d-flex');
      if (navAdminItem) navAdminItem.classList.add('d-none');
    }
  } catch (err) {
    console.error('Error updating auth UI:', err);
  }
}

/**
 * Attach logout handler to the logout button in the header
 */
function initializeLogoutButton() {
  const logoutBtn = document.getElementById('nav-logout-btn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    try {
      await logoutUser();
      toast.success('Успешно излизане!');
      setTimeout(() => {
        window.location.href = '/';
      }, 800);
    } catch (err) {
      console.error('Logout error:', err);
      toast.error('Грешка при излизане.');
    }
  });
}

/**
 * Initialize mobile menu toggle functionality
 * Works with Bootstrap navbar
 */
function initializeMobileMenu() {
  const navbarToggle = document.querySelector('.navbar-toggler');
  const navbarMenu = document.getElementById('navbarMenu');
  if (!navbarToggle || !navbarMenu) return;

  // Close the menu when a link is clicked
  navbarMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (navbarToggle.getAttribute('aria-expanded') === 'true') {
        navbarToggle.click();
      }
    });
  });
}

/**
 * Set active navigation link based on current page
 * Updates nav-link active class to match current route
 */
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href');
    const isActive = href === currentPath || (href !== '/' && currentPath.startsWith(href));
    link.classList.toggle('active', isActive);
  });
}

/**
 * Navigate to a different page
 * @param {string} path - The path to navigate to
 */
export function navigateTo(path) {
  window.location.href = path;
}

/**
 * Get the current page name from URL
 * @returns {string}
 */
export function getCurrentPageName() {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || 'home';
}

