/**
 * public/screens/login.js
 * Login screen — username/password form.
 * Requirements: 1.1, 1.2, 1.3
 */

import { navigate } from '../main.js';

/**
 * Render the login screen HTML and attach event listeners.
 *
 * @returns {string} HTML string
 */
export function render() {
  requestAnimationFrame(() => attachListeners());

  return `
    <div class="app-container login-screen">
      <h1 class="app-title">Poker Rake Tracker</h1>
      <form id="login-form" class="login-form" novalidate>
        <div class="form-group">
          <label for="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            autocomplete="username"
            autocapitalize="none"
            required
          />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            autocomplete="current-password"
            required
          />
        </div>
        <div id="login-error" class="error-message" role="alert" aria-live="polite"></div>
        <button type="submit" class="btn btn-primary btn-full" id="login-btn">
          Log In
        </button>
      </form>
    </div>
  `;
}

function attachListeners() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-btn');

    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        navigate('home');
      } else if (res.status === 401) {
        errorEl.textContent = 'Invalid credentials';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
      } else {
        errorEl.textContent = 'Something went wrong. Please try again.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
      }
    } catch (err) {
      errorEl.textContent = 'Network error. Please check your connection.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  });
}
