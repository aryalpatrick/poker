/**
 * public/screens/roundEntry.js
 * Round Entry screen — chip tap buttons, live pot, winner selection.
 * Supports both new round creation and editing an existing round.
 * Requirements: 4.1–4.8, 5.1–5.4
 *
 * Chip state is managed inline (history array) until task 18 extracts it
 * to public/lib/chipState.js.
 */

import { navigate } from '../main.js';
import { computePot } from '../lib/calc.js';

// ─── Chip state (inline, will be extracted in task 18) ───────────────────────

/** @type {Array<'white'|'red'|'green'|'blue'>} */
let _history = [];

function addChip(color) {
  _history.push(color);
}

function undo() {
  _history.pop();
}

function clear() {
  _history = [];
}

function getCounts() {
  return _history.reduce(
    (acc, color) => { acc[color]++; return acc; },
    { white: 0, red: 0, green: 0, blue: 0 }
  );
}

// ─── Module-level state ───────────────────────────────────────────────────────

let _game = null;
let _existingRound = null; // set when editing

const CHIP_COLORS = ['white', 'red', 'green', 'blue'];

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Render the round entry screen HTML and attach event listeners.
 *
 * @param {{ gameId: string, roundId?: string }} params
 * @returns {string} HTML string
 */
export function render(params) {
  // Reset state on each render
  _history = [];
  _game = null;
  _existingRound = null;

  requestAnimationFrame(() => attachListeners(params));

  return `
    <div class="app-container round-entry-screen">
      <div class="screen-header">
        <button id="back-btn" class="btn btn-ghost" aria-label="Go back">← Back</button>
        <h1 class="screen-title" id="round-title">Loading…</h1>
      </div>

      <div id="round-content" class="round-content">
        <p class="loading-text">Loading…</p>
      </div>
    </div>
  `;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function attachListeners(params) {
  const { gameId, roundId } = params;

  document.getElementById('back-btn')?.addEventListener('click', () => {
    navigate('game', { id: gameId });
  });

  try {
    const gameRes = await fetch(`/api/games/${gameId}`);
    if (!gameRes.ok) {
      showError('Failed to load game.');
      return;
    }
    _game = await gameRes.json();

    if (roundId) {
      // Editing an existing round — fetch it
      const roundsRes = await fetch(`/api/games/${gameId}/rounds`);
      if (roundsRes.ok) {
        const rounds = await roundsRes.json();
        _existingRound = rounds.find(r => r._id === roundId) || null;
      }

      if (_existingRound) {
        // Pre-fill history from existing chip counts
        CHIP_COLORS.forEach(color => {
          const count = _existingRound.chips[color] || 0;
          for (let i = 0; i < count; i++) {
            _history.push(color);
          }
        });
      }
    }

    const titleEl = document.getElementById('round-title');
    if (titleEl) {
      titleEl.textContent = roundId ? 'Edit Round' : 'New Round';
    }

    renderRoundUI();
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

// ─── UI rendering ─────────────────────────────────────────────────────────────

function renderRoundUI() {
  const contentEl = document.getElementById('round-content');
  if (!contentEl || !_game) return;

  const counts = getCounts();
  const pot = computePot(counts, _game.chipValues);
  const hasChips = _history.length > 0;

  // Pre-selected winner when editing
  const preselectedWinner = _existingRound ? _existingRound.winnerName : null;

  contentEl.innerHTML = `
    <!-- Pot display -->
    <div class="pot-display" id="pot-display" aria-live="polite" aria-label="Current pot">
      NPR ${formatNumber(pot)}
    </div>

    <!-- Chip counts -->
    <div class="chip-counts" id="chip-counts">
      ${CHIP_COLORS.map(color => `
        <div class="chip-count chip-count--${color}">
          <span class="chip-count-label">${capitalize(color)}</span>
          <span class="chip-count-value" id="count-${color}">${counts[color]}</span>
        </div>
      `).join('')}
    </div>

    <!-- Chip buttons -->
    <div class="chip-buttons" role="group" aria-label="Add chips">
      ${CHIP_COLORS.map(color => `
        <button
          class="chip-btn chip-btn--${color}"
          data-color="${color}"
          aria-label="Add ${color} chip"
          inputmode="none"
        >${capitalize(color)}</button>
      `).join('')}
    </div>

    <!-- Undo / Clear -->
    <div class="chip-controls">
      <button id="undo-btn" class="btn btn-secondary" aria-label="Undo last chip">Undo</button>
      <button id="clear-btn" class="btn btn-secondary" aria-label="Clear all chips">Clear</button>
    </div>

    <!-- Winner selection (shown when chips > 0) -->
    <div id="winner-section" class="winner-section ${hasChips ? '' : 'hidden'}">
      <h2 class="section-title">Select Winner</h2>
      <div class="winner-buttons" role="group" aria-label="Select winner">
        ${_game.players.map(player => `
          <button
            class="winner-btn ${preselectedWinner === player ? 'winner-btn--selected' : ''}"
            data-player="${escapeHtml(player)}"
            aria-label="Winner: ${escapeHtml(player)}"
            aria-pressed="${preselectedWinner === player ? 'true' : 'false'}"
          >${escapeHtml(player)}</button>
        `).join('')}
      </div>
    </div>

    <div id="round-error" class="error-message" role="alert" aria-live="polite"></div>
  `;

  attachRoundListeners();
}

function attachRoundListeners() {
  // Chip buttons
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addChip(btn.dataset.color);
      updateRoundUI();
    });
  });

  // Undo
  document.getElementById('undo-btn')?.addEventListener('click', () => {
    undo();
    updateRoundUI();
  });

  // Clear
  document.getElementById('clear-btn')?.addEventListener('click', () => {
    clear();
    updateRoundUI();
  });

  // Winner buttons
  document.querySelectorAll('.winner-btn').forEach(btn => {
    btn.addEventListener('click', () => handleWinnerSelected(btn.dataset.player));
  });
}

// ─── Live update (no full re-render) ─────────────────────────────────────────

function updateRoundUI() {
  if (!_game) return;

  const counts = getCounts();
  const pot = computePot(counts, _game.chipValues);
  const hasChips = _history.length > 0;

  // Update pot display
  const potEl = document.getElementById('pot-display');
  if (potEl) potEl.textContent = `NPR ${formatNumber(pot)}`;

  // Update chip counts
  CHIP_COLORS.forEach(color => {
    const el = document.getElementById(`count-${color}`);
    if (el) el.textContent = counts[color];
  });

  // Show/hide winner section
  const winnerSection = document.getElementById('winner-section');
  if (winnerSection) {
    winnerSection.classList.toggle('hidden', !hasChips);
  }
}

// ─── Save round ───────────────────────────────────────────────────────────────

async function handleWinnerSelected(playerName) {
  const errorEl = document.getElementById('round-error');
  if (errorEl) errorEl.textContent = '';

  const counts = getCounts();
  const isEdit = !!_existingRound;
  const gameId = _game._id;

  // Disable all winner buttons to prevent double-tap
  document.querySelectorAll('.winner-btn').forEach(b => { b.disabled = true; });

  const payload = {
    chips: counts,
    winnerName: playerName,
  };

  try {
    let res;
    if (isEdit) {
      res = await fetch(`/api/games/${gameId}/rounds/${_existingRound._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`/api/games/${gameId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    if (res.ok) {
      navigate('game', { id: gameId });
    } else {
      const body = await res.json().catch(() => ({}));
      if (errorEl) errorEl.textContent = body.error || 'Failed to save round.';
      document.querySelectorAll('.winner-btn').forEach(b => { b.disabled = false; });
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Network error. Please try again.';
    document.querySelectorAll('.winner-btn').forEach(b => { b.disabled = false; });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showError(message) {
  const contentEl = document.getElementById('round-content');
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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
