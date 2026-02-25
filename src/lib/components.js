// Shared component loader for header and footer
// Handles dynamic loading of reusable layout components

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

