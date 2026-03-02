// Form validation utility
// Provides validation feedback and error handling

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { isValid: boolean, feedback: string }
 */
export function validatePassword(password) {
  if (password.length < 6) {
    return { isValid: false, feedback: 'Паролата трябва да е поне 6 символа' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, feedback: 'Паролата трябва да съдържа главна буква' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, feedback: 'Паролата трябва да съдържа цифра' };
  }
  return { isValid: true, feedback: 'Силна парола' };
}

/**
 * Add validation feedback to a form input
 * @param {HTMLElement} input - The input element
 * @param {boolean} isValid - Whether the input is valid
 * @param {string} feedback - Feedback message
 */
export function setInputFeedback(input, isValid, feedback = '') {
  // Remove existing feedback
  const existingFeedback = input.parentElement.querySelector('.invalid-feedback, .valid-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // Update input classes
  input.classList.remove('is-valid', 'is-invalid');
  input.classList.add(isValid ? 'is-valid' : 'is-invalid');

  // Add feedback message if provided
  if (feedback) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = isValid ? 'valid-feedback' : 'invalid-feedback';
    feedbackDiv.style.display = 'block';
    feedbackDiv.textContent = feedback;
    input.parentElement.appendChild(feedbackDiv);
  }
}

/**
 * Validate entire form
 * @param {HTMLFormElement} form - The form to validate
 * @returns {boolean} - Whether all fields are valid
 */
export function validateForm(form) {
  let isValid = true;
  const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');

  inputs.forEach((input) => {
    if (!input.value.trim()) {
      setInputFeedback(input, false, 'Това поле е задължително');
      isValid = false;
    } else if (input.type === 'email') {
      const emailValid = isValidEmail(input.value);
      setInputFeedback(input, emailValid, emailValid ? '' : 'Невалиден имейл');
      if (!emailValid) isValid = false;
    }
  });

  return isValid;
}

/**
 * Clear all validation feedback from a form
 * @param {HTMLFormElement} form - The form to clear
 */
export function clearFormFeedback(form) {
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    input.classList.remove('is-valid', 'is-invalid');
    const feedback = input.parentElement.querySelector('.invalid-feedback, .valid-feedback');
    if (feedback) {
      feedback.remove();
    }
  });
}
