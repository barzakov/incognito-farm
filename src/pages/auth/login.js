import { authenticateUser, fetchCurrentUserProfile, getSession } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';
import { validateForm, isValidEmail } from '../../lib/formValidation.js';

async function redirectIfAuthenticated() {
  try {
    const session = await getSession();
    if (!session) return;

    const profile = await fetchCurrentUserProfile();
    const redirectTo = profile?.boss ? '/admin/' : '/';
    window.location.replace(redirectTo);
  } catch (error) {
    console.error('Auth redirect check failed:', error);
  }
}

// Handle login form submission
function initializeLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Зареждане...';

    try {
      // Validate form
      if (!validateForm(form)) {
        toast.error('Моля, попълнете всички полета правилно');
        return;
      }

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      // Validate email format
      if (!isValidEmail(email)) {
        toast.error('Невалиден формат на имейла');
        return;
      }

      // Authenticate user
      const authData = await authenticateUser(email, password);
      
      if (authData) {
        toast.success('Успешен вход!');

        // Fetch profile to check boss status
        const profile = await fetchCurrentUserProfile();
        const redirectTo = profile?.boss ? '/admin/' : '/';

        setTimeout(() => {
          window.location.href = redirectTo;
        }, 1000);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Грешка при вход. Проверете своите данни.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  redirectIfAuthenticated();
  initializeLoginForm();
});
