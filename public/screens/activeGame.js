/**
 * public/screens/activeGame.js
 * Active Game screen — round log, rake selector, new round, end game.
 * Requirements: 6.1–6.8, 7.1–7.3, 8.1–8.2
 */

import { navigate } from '../main.js';

const RAKE_OPTIONS = [1, 2, 2.5, 3, 5];

// Module-level state for the current screen instance
let _game = null;
let _rounds = [];

/**
 * Render the active game screen HTML and attach event listeners.
 *
 * @param {{ id: string }} params
 * @returns {string} HTML string
 */
export function render(params) {
  requestAnimationFrame(() => attachListeners(params));

  return `
    <div class="app-container active-game-screen">
      <div class="screen-header">
        <button id="back-btn" class="btn btn-ghost" aria-label="Go back">← Back</button>
        <h1 class="screen-title" id="game-title">Loading…</h1>
      </div>

      <div id="game-content" class="game-content">
        <p class="loading-text">Loading game…</p>
      </div>
    </div>
  `;
}

async function attachListeners(params) {
  const { id } = params;
  if (!id) return;

  await loadGame(id);
}

async function loadGame(id) {
  try {
    const [gameRes, roundsRes] = await Promise.all([
      fetch(`/api/games/${id}`),
      fetch(`/api/games/${id}/rounds`),
    ]);

    if (!gameRes.ok) {
      showError('Failed to load game.');
      return;
    }

    _game = await gameRes.json();
    _rounds = roundsRes.ok ? await roundsRes.json() : [];

    renderGameContent();
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

function renderGameContent() {
  const titleEl = document.getElementById('game-title');
  if (titleEl) titleEl.textContent = _game.name;

  const contentEl = document.getElementById('game-content');
  if (!contentEl) return;

  // Sort rounds most recent first (highest roundNumber first)
  const sortedRounds = [..._rounds].sort((a, b) => b.roundNumber - a.roundNumber);

  const roundRows = sortedRounds.length
    ? sortedRounds.map(round => `
        <div class="round-row">
          <div class="round-row-info">
            <span class="round-number">#${round.roundNumber}</span>
            <span class="round-winner">${escapeHtml(round.winnerName)}</span>
          </div>
          <div class="round-row-values">
            <span class="round-pot">NPR ${formatNumber(round.potNPR)}</span>
            <span class="round-rake">Rake: NPR ${formatNumber(round.rakeNPR)}</span>
          </div>
          <button
            class="btn btn-ghost btn-sm edit-round-btn"
            data-round-id="${round._id}"
            aria-label="Edit round ${round.roundNumber}"
          >Edit</button>
        </div>
      `).join('')
    : '<p class="empty-state">No rounds yet. Start the first round!</p>';

  const rakeOptions = RAKE_OPTIONS.map(pct => `
    <option value="${pct}" ${_game.rakePercent === pct ? 'selected' : ''}>${pct}%</option>
  `).join('');

  contentEl.innerHTML = `
    <!-- Round log -->
    <div class="round-log-container" id="round-log">
      ${roundRows}
    </div>

    <!-- Rake selector -->
    <div class="rake-selector-row">
      <label for="rake-select" class="rake-selector-label">Rake %</label>
      <select id="rake-select" class="rake-select" aria-label="Rake percentage">
        ${rakeOptions}
      </select>
    </div>

    <!-- Action buttons -->
    <div class="game-actions">
      <button id="new-round-btn" class="btn btn-primary btn-full" ${_game.status === 'closed' ? 'disabled' : ''}>
        New Round
      </button>
      <button id="end-game-btn" class="btn btn-danger btn-full" ${_game.status === 'closed' ? 'disabled' : ''}>
        ${_game.status === 'closed' ? 'Game Ended' : 'End Game'}
      </button>
    </div>

    <div id="action-error" class="error-message" role="alert" aria-live="polite"></div>
  `;

  // Attach action listeners
  document.getElementById('new-round-btn')?.addEventListener('click', () => {
    navigate('round-entry', { gameId: _game._id });
  });

  document.getElementById('end-game-btn')?.addEventListener('click', handleEndGame);

  document.getElementById('rake-select')?.addEventListener('change', handleRakeChange);

  document.querySelectorAll('.edit-round-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate('round-entry', { gameId: _game._id, roundId: btn.dataset.roundId });
    });
  });
}

async function handleRakeChange(e) {
  const newRake = Number(e.target.value);
  const errorEl = document.getElementById('action-error');
  if (errorEl) errorEl.textContent = '';

  try {
    const res = await fetch(`/api/games/${_game._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rakePercent: newRake }),
    });

    if (res.ok) {
      _game.rakePercent = newRake;
    } else {
      if (errorEl) errorEl.textContent = 'Failed to update rake percentage.';
      // Revert selector
      e.target.value = _game.rakePercent;
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Network error. Please try again.';
    e.target.value = _game.rakePercent;
  }
}

async function handleEndGame() {
  const errorEl = document.getElementById('action-error');
  if (errorEl) errorEl.textContent = '';

  const btn = document.getElementById('end-game-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Ending…';
  }

  try {
    const res = await fetch(`/api/games/${_game._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });

    if (res.ok) {
      navigate('cashout', { gameId: _game._id });
    } else {
      if (errorEl) errorEl.textContent = 'Failed to end game.';
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'End Game';
      }
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Network error. Please try again.';
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'End Game';
    }
  }
}

function showError(message) {
  const contentEl = document.getElementById('game-content');
  if (contentEl) {
    contentEl.innerHTML = `<p class="error-message">${escapeHtml(message)}</p>`;
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
