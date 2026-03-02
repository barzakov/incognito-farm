// Toast notification utility
// Provides non-blocking, auto-dismiss toast notifications

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in ms before auto-dismiss (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement('div');
  const toastId = `toast-${Date.now()}`;
  toast.id = toastId;

  // Define toast styles based on type
  const typeStyles = {
    success: {
      bgColor: '#28a745',
      icon: 'bi-check-circle-fill',
    },
    error: {
      bgColor: '#dc3545',
      icon: 'bi-exclamation-circle-fill',
    },
    warning: {
      bgColor: '#ffc107',
      icon: 'bi-exclamation-triangle-fill',
      textColor: '#000',
    },
    info: {
      bgColor: '#17a2b8',
      icon: 'bi-info-circle-fill',
    },
  };

  const style = typeStyles[type] || typeStyles.info;

  toast.innerHTML = `
    <div class="toast-content" style="
      background-color: ${style.bgColor};
      color: ${style.textColor || '#fff'};
      padding: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-in-out;
    ">
      <i class="bi ${style.icon}" style="font-size: 20px;"></i>
      <span style="flex: 1; font-weight: 500;">${message}</span>
      <button class="toast-close" style="
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 20px;
        padding: 0;
        display: flex;
        align-items: center;
      ">
        <i class="bi bi-x"></i>
      </button>
    </div>
  `;

  // Add animation styles if not already added
  if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Add close button functionality
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    removeToast(toastId);
  });

  // Add to container
  toastContainer.appendChild(toast);

  // Auto-dismiss
  const timeoutId = setTimeout(() => {
    removeToast(toastId);
  }, duration);

  // Store timeout ID for manual cancellation if needed
  toast.timeoutId = timeoutId;

  return toastId;
}

/**
 * Remove a toast notification
 * @param {string} toastId - The ID of the toast to remove
 */
function removeToast(toastId) {
  const toast = document.getElementById(toastId);
  if (!toast) return;

  // Clear timeout if exists
  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }

  // Add slide-out animation
  const content = toast.querySelector('.toast-content');
  content.style.animation = 'slideOut 0.3s ease-in-out';

  // Remove after animation
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// Convenience functions
export const toast = {
  success: (msg, duration) => showToast(msg, 'success', duration),
  error: (msg, duration) => showToast(msg, 'error', duration),
  warning: (msg, duration) => showToast(msg, 'warning', duration),
  info: (msg, duration) => showToast(msg, 'info', duration),
};
