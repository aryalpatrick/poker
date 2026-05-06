/**
 * public/screens/home.js
 * Home screen — game list and create new game button.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { navigate } from '../main.js';

/**
 * Format a date string for display.
 *
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Render the home screen HTML and attach event listeners.
 *
 * @returns {string} HTML string
 */
export function render() {
  requestAnimationFrame(() => attachListeners());

  return `
    <div class="app-container home-screen">
      <div class="screen-header">
        <h1 class="screen-title">Games</h1>
        <button id="create-game-btn" class="btn btn-primary">+ New Game</button>
      </div>
      <div id="games-list" class="games-list">
        <p class="loading-text">Loading games…</p>
      </div>
    </div>
  `;
}

async function attachListeners() {
  const createBtn = document.getElementById('create-game-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => navigate('create-game'));
  }

  await loadGames();
}

async function loadGames() {
  const listEl = document.getElementById('games-list');
  if (!listEl) return;

  try {
    const res = await fetch('/api/games');
    if (!res.ok) {
      listEl.innerHTML = '<p class="error-message">Failed to load games.</p>';
      return;
    }

    const games = await res.json();

    if (!games.length) {
      listEl.innerHTML = '<p class="empty-state">No games yet. Create your first game!</p>';
      return;
    }

    listEl.innerHTML = games.map(game => `
      <div class="game-row" data-id="${game._id}" role="button" tabindex="0" aria-label="Open game ${game.name}">
        <div class="game-row-main">
          <span class="game-name">${escapeHtml(game.name)}</span>
          <span class="game-status game-status--${game.status}">${game.status}</span>
        </div>
        <div class="game-row-meta">
          <span class="game-date">${formatDate(game.createdAt)}</span>
          <span class="game-rake">Rake: NPR ${formatNumber(game.totalRake || 0)}</span>
        </div>
      </div>
    `).join('');

    // Attach click listeners to each game row
    listEl.querySelectorAll('.game-row').forEach(row => {
      const handler = () => navigate('game', { id: row.dataset.id });
      row.addEventListener('click', handler);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = '<p class="error-message">Network error. Please try again.</p>';
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(n) {
  return Number(n).toLocaleString();
}
