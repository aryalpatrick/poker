/**
 * public/main.js
 * Screen router for the Poker App SPA.
 * Uses hash-based routing to map URL hashes to screen modules.
 */

// --- Global 401 intercept ---
// Monkey-patch window.fetch to catch 401 responses and redirect to login.
const _originalFetch = window.fetch.bind(window);
window.fetch = async function (...args) {
  const response = await _originalFetch(...args);
  if (response.status === 401) {
    // Avoid redirect loop if we're already on the login screen
    if (window.location.hash !== '#login') {
      navigate('login');
    }
  }
  return response;
};

/**
 * Parse the current hash into a screen name and params object.
 * Supports patterns like:
 *   #login
 *   #home
 *   #create-game
 *   #game/:id
 *   #round-entry/:gameId
 *   #cashout/:gameId
 *
 * @returns {{ screen: string, params: Object }}
 */
function parseHash() {
  const hash = window.location.hash.slice(1) || 'login'; // strip leading '#'
  const parts = hash.split('/');
  const screen = parts[0];
  const params = {};

  // Map parameterised routes to their param names
  if (screen === 'game' && parts[1]) {
    params.id = parts[1];
  } else if (screen === 'round-entry' && parts[1]) {
    params.gameId = parts[1];
  } else if (screen === 'cashout' && parts[1]) {
    params.gameId = parts[1];
  }

  return { screen, params };
}

/**
 * Map a screen name to its module path.
 *
 * @param {string} screen
 * @returns {string|null} Module path relative to this file, or null if unknown
 */
function screenToModule(screen) {
  const map = {
    'login':        './screens/login.js',
    'home':         './screens/home.js',
    'create-game':  './screens/createGame.js',
    'game':         './screens/activeGame.js',
    'round-entry':  './screens/roundEntry.js',
    'cashout':      './screens/cashout.js',
  };
  return map[screen] || null;
}

/**
 * Navigate to a named screen, optionally setting the URL hash.
 * Dynamically imports the screen module and calls its render(params) function,
 * then sets the result into #app.
 *
 * @param {string} screenName - One of: login, home, create-game, game, round-entry, cashout
 * @param {Object} [params={}]  - Route params (e.g. { id: '...' } for game screen)
 */
export async function navigate(screenName, params = {}) {
  // Update the URL hash to reflect the current screen
  const hashBase = screenName;
  let newHash = '#' + hashBase;
  if (params.id) {
    newHash = `#${hashBase}/${params.id}`;
  } else if (params.gameId) {
    newHash = `#${hashBase}/${params.gameId}`;
  }

  // Only push a new history entry if the hash actually changes
  if (window.location.hash !== newHash) {
    window.location.hash = newHash;
    // The hashchange event will trigger renderCurrentScreen, so we return here
    // to avoid double-rendering.
    return;
  }

  await renderCurrentScreen(screenName, params);
}

/**
 * Load and render the screen module for the given screen name and params.
 *
 * @param {string} screenName
 * @param {Object} params
 */
async function renderCurrentScreen(screenName, params) {
  const modulePath = screenToModule(screenName);
  const appEl = document.getElementById('app');

  if (!modulePath) {
    appEl.innerHTML = `<p class="error">Unknown screen: ${screenName}</p>`;
    return;
  }

  try {
    const module = await import(modulePath);
    const result = await module.render(params);

    if (typeof result === 'string') {
      appEl.innerHTML = result;
    } else if (result instanceof Node) {
      appEl.innerHTML = '';
      appEl.appendChild(result);
    }
  } catch (err) {
    console.error(`Failed to load screen "${screenName}":`, err);
    appEl.innerHTML = `<p class="error">Failed to load screen.</p>`;
  }
}

/**
 * Check whether the user is authenticated.
 * Reads the non-httpOnly `auth_flag` cookie set by the server on login.
 * The actual auth_token is httpOnly and never readable by JS.
 *
 * @returns {boolean}
 */
function isAuthenticated() {
  return document.cookie.split(';').some(c => c.trim().startsWith('auth_flag='));
}

/**
 * Handle hash changes — re-parse the hash and render the appropriate screen.
 */
async function onHashChange() {
  const { screen, params } = parseHash();

  // Guard: redirect to login if not authenticated (except when already going to login)
  if (!isAuthenticated() && screen !== 'login') {
    window.location.hash = '#login';
    return;
  }

  await renderCurrentScreen(screen, params);
}

// Listen for hash changes (back/forward navigation, manual URL edits)
window.addEventListener('hashchange', onHashChange);

// Initial load
(async function init() {
  const { screen, params } = parseHash();

  if (!isAuthenticated() && screen !== 'login') {
    window.location.hash = '#login';
    return;
  }

  await renderCurrentScreen(screen, params);
})();
