import { registerUser, fetchCurrentUserProfile } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';
import { validatePassword, isValidEmail } from '../../lib/formValidation.js';

function getFieldContainer(input) {
  return input.closest('.mb-3, .mb-4') || input.parentElement;
}

function getFieldFeedback(input) {
  const container = getFieldContainer(input);
  return container ? container.querySelector('.invalid-feedback') : null;
}

function setFieldError(input, message) {
  input.classList.add('is-invalid');
  const feedback = getFieldFeedback(input);
  if (feedback) {
    feedback.textContent = message;
    feedback.style.display = 'block';
  }
}

function clearFieldError(input) {
  input.classList.remove('is-invalid');
  const feedback = getFieldFeedback(input);
  if (feedback) {
    feedback.style.display = 'none';
  }
}

function validateRegisterForm(form) {
  let isValid = true;

  const name = document.getElementById('name');
  const lastname = document.getElementById('lastname');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const passwordConfirm = document.getElementById('password-confirm');

  [name, lastname, email, password, passwordConfirm].forEach((input) => clearFieldError(input));

  if (!name.value.trim()) {
    setFieldError(name, 'Името е задължително');
    isValid = false;
  }

  if (!lastname.value.trim()) {
    setFieldError(lastname, 'Фамилията е задължителна');
    isValid = false;
  }

  if (!email.value.trim() || !isValidEmail(email.value.trim())) {
    setFieldError(email, 'Моля, въведете валиден имейл');
    isValid = false;
  }

  if (!password.value) {
    setFieldError(password, 'Паролата е задължителна');
    isValid = false;
  } else {
    const passwordValidation = validatePassword(password.value);
    if (!passwordValidation.isValid) {
      setFieldError(password, passwordValidation.feedback);
      isValid = false;
    }
  }

  if (!passwordConfirm.value) {
    setFieldError(passwordConfirm, 'Потвърждението на паролата е задължително');
    isValid = false;
  } else if (password.value !== passwordConfirm.value) {
    setFieldError(passwordConfirm, 'Паролите не съвпадат');
    isValid = false;
  }

  return isValid;
}

// Toggle password visibility
function setupPasswordToggle() {
  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('password-confirm');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const togglePasswordConfirmBtn = document.getElementById('togglePasswordConfirm');

  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      const icon = togglePasswordBtn.querySelector('i');
      icon.classList.toggle('bi-eye');
      icon.classList.toggle('bi-eye-slash');
    });
  }

  if (togglePasswordConfirmBtn && passwordConfirmInput) {
    togglePasswordConfirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = passwordConfirmInput.type === 'password';
      passwordConfirmInput.type = isPassword ? 'text' : 'password';
      const icon = togglePasswordConfirmBtn.querySelector('i');
      icon.classList.toggle('bi-eye');
      icon.classList.toggle('bi-eye-slash');
    });
  }
}

// Setup real-time validation feedback clearing
function setupRealTimeValidation() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('password-confirm');

  const inputs = form.querySelectorAll('input[required]');
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      if (input.value.trim()) {
        clearFieldError(input);
      }

      if (input.type === 'email' && input.value.trim()) {
        if (!isValidEmail(input.value.trim())) {
          setFieldError(input, 'Моля, въведете валиден имейл');
        }
      }

      if (passwordInput && passwordConfirmInput && (input === passwordInput || input === passwordConfirmInput)) {
        if (!passwordConfirmInput.value) {
          return;
        }

        if (passwordInput.value === passwordConfirmInput.value) {
          clearFieldError(passwordConfirmInput);
        } else {
          setFieldError(passwordConfirmInput, 'Паролите не съвпадат');
        }
      }
    });
  });
}

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
      if (!validateRegisterForm(form)) {
        toast.error('Моля, попълнете всички полета правилно');
        return;
      }

      const name = document.getElementById('name').value.trim();
      const secondName = document.getElementById('second-name').value.trim();
      const lastname = document.getElementById('lastname').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('password-confirm').value;

      // Register user with name metadata
      const authResult = await registerUser(email, password, {
        name,
        second_name: secondName,
        lastname,
      });
      
      if (authResult) {
        if (authResult.session) {
          toast.success('Успешна регистрация!');
          const profile = await fetchCurrentUserProfile();
          const redirectTo = profile?.boss ? '/admin/' : '/';
          setTimeout(() => {
            window.location.href = redirectTo;
          }, 800);
        } else {
          toast.success('Успешна регистрация! Проверете вашия email за потвърждение.');
          setTimeout(() => {
            window.location.href = '/auth/login/';
          }, 1500);
        }
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
  setupPasswordToggle();
  setupRealTimeValidation();
});
