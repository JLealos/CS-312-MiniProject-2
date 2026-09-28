// Show feedback only after the browser has validated the submitted form.
document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', () => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Loading...';
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
  });
});
// Restore controls when returning through the browser's back button.
window.addEventListener('pageshow', () => {
  document.querySelectorAll('button[data-original-text]').forEach((button) => {
    button.textContent = button.dataset.originalText;
    button.disabled = false;
    button.closest('form').removeAttribute('aria-busy');
  });
});
