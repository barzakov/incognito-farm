import { loadComponents } from '../../lib/components.js';

// Handle form submission
function initializeForm() {
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Handle form submission
      console.log('Form submitted');
      alert('Благодарим за съобщението! Ще се свържем с вас скоро.');
      form.reset();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  initializeForm();
});
