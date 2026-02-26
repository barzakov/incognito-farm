import { supabase, registerUser } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';
import { validateForm, validatePassword, isValidEmail } from '../../lib/formValidation.js';

// Handle register form submission
function initializeRegisterForm() {
  const form = document.getElementById('registerForm');
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

      const name = document.getElementById('name').value.trim();
      const secondName = document.getElementById('second-name').value.trim();
      const lastname = document.getElementById('lastname').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('password-confirm').value;

      // Validate email
      if (!isValidEmail(email)) {
        toast.error('Невалиден формат на имейла');
        return;
      }

      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        toast.error(passwordValidation.feedback);
        return;
      }

      // Check if passwords match
      if (password !== passwordConfirm) {
        toast.error('Паролите не съвпадат!');
        return;
      }

      // Register user with name metadata
      const user = await registerUser(email, password, {
        name,
        second_name: secondName,
        lastname,
      });
      
      if (user) {
        toast.success('Успешна регистрация! Проверете вашия email за потвърждение.');
        setTimeout(() => {
          window.location.href = '/auth/login/';
        }, 1500);
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Грешка при регистрация. Опитайте отново.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  initializeRegisterForm();
});
