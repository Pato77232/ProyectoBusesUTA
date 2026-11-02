export function createLoginView(root) {
  const form = root.querySelector('form');
  const fields = form.querySelector('fieldset');
  const status = root.querySelector('#login-status');
  const email = root.querySelector('#login-email');
  const password = root.querySelector('#login-password');
  const check = root.querySelector('#check-session');
  const identity = root.querySelector('#session-email');

  function render({ mode, message, email: userEmail, errorField }) {
    const wasHidden = form.hidden;
    const lostFocus = form.contains(root.activeElement) || check === root.activeElement;
    const busy = mode === 'checking' || mode === 'submitting';
    const showForm = mode === 'form' || mode === 'submitting';
    status.textContent = message;
    form.hidden = !showForm;
    fields.disabled = mode !== 'form';
    form.querySelector('button').disabled = mode !== 'form';
    check.hidden = mode !== 'uncertain';
    identity.hidden = mode !== 'session';
    identity.textContent = mode === 'session' ? userEmail : '';
    root.querySelector('main').setAttribute('aria-busy', String(busy));
    for (const input of [email, password]) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    if (errorField) {
      const input = errorField === 'email' ? email : password;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'login-status');
      input.focus();
    } else if (mode === 'submitting') status.focus();
    else if (mode === 'form' && wasHidden) email.focus();
    else if (!busy && lostFocus) {
      (mode === 'uncertain' ? check : status).focus();
    }
  }

  return {
    render,
    clearPassword: () => {
      password.value = '';
    },
  };
}
