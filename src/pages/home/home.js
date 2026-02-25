import { supabase } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

// Check authentication status
async function checkAuthStatus() {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      console.log('User logged in:', user.email);
      // Update UI for authenticated user
      updateAuthUI(user);
    } else {
      console.log('No user logged in');
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

// Update UI for authenticated user
function updateAuthUI(user) {
  const authLinks = document.querySelector('.nav-auth');
  if (authLinks) {
    authLinks.innerHTML = `
      <a href="/profile/" class="nav-link">Профил</a>
      <button id="logoutBtn" class="btn btn-danger btn-sm">Изход</button>
    `;

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await supabase.auth.signOut();
          toast.success('Успешно излязохте');
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } catch (error) {
          console.error('Error logging out:', error);
          toast.error('Грешка при изход');
        }
      });
    }
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  checkAuthStatus();
});
