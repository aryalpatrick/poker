/**
 * public/screens/cashout.js
 * Cashout screen — player cards, chip entry modal, payout calculation.
 * Requirements: 9.1–9.8
 */

import { navigate } from '../main.js';
import {
  computePot,
  computePlayerRakeOwed,
  computePayout,
  computeTotalRake,
} from '../lib/calc.js';

// ─── Module-level state ───────────────────────────────────────────────────────

let _game = null;
let _rounds = [];

/** @type {string|null} Currently open player name in modal */
let _activePlayer = null;

/** @type {Array<'white'|'red'|'green'|'blue'>} Chip history for modal */
let _modalHistory = [];

const CHIP_COLORS = ['white', 'red', 'green', 'blue'];

// ─── Render ───────────────────────────────────────────────────────────────────

/**
 * Render the cashout screen HTML and attach event listeners.
 *
 * @param {{ gameId: string }} params
 * @returns {string} HTML string
 */
export function render(params) {
  _game = null;
  _rounds = [];
  _activePlayer = null;
  _modalHistory = [];

  requestAnimationFrame(() => attachListeners(params));

  return `
    <div class="app-container cashout-screen">
      <div class="screen-header">
        <button id="back-btn" class="btn btn-ghost" aria-label="Go back">← Back</button>
        <h1 class="screen-title">Cashout</h1>
      </div>

      <div id="cashout-content" class="cashout-content">
        <p class="loading-text">Loading…</p>
      </div>

      <!-- Chip entry modal (hidden by default) -->
      <div id="cashout-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-panel">
          <div class="modal-header">
            <h2 class="modal-title" id="modal-title">Enter Chips</h2>
            <button id="modal-close-btn" class="btn btn-ghost" aria-label="Close modal">✕</button>
          </div>

          <!-- Live calculations -->
          <div class="modal-calcs">
            <div class="calc-row">
              <span class="calc-label">Chip Value</span>
              <span class="calc-value" id="modal-chip-value">NPR 0</span>
            </div>
            <div class="calc-row">
              <span class="calc-label">Rake Owed</span>
              <span class="calc-value" id="modal-rake-owed">NPR 0</span>
            </div>
            <div class="calc-row calc-row--payout">
              <span class="calc-label">Payout</span>
              <span class="calc-value" id="modal-payout">NPR 0</span>
            </div>
          </div>

          <!-- Chip counts display -->
          <div class="chip-counts" id="modal-chip-counts">
            ${CHIP_COLORS.map(color => `
              <div class="chip-count chip-count--${color}">
                <span class="chip-count-label">${capitalize(color)}</span>
                <span class="chip-count-value" id="modal-count-${color}">0</span>
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
            <button id="modal-undo-btn" class="btn btn-secondary" aria-label="Undo last chip">Undo</button>
            <button id="modal-clear-btn" class="btn btn-secondary" aria-label="Clear all chips">Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function attachListeners(params) {
  const { gameId } = params;

  document.getElementById('back-btn')?.addEventListener('click', () => {
    navigate('game', { id: gameId });
  });

  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);

  // Close modal on overlay click (outside panel)
  document.getElementById('cashout-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cashout-modal')) {
      closeModal();
    }
  });

  // Modal chip buttons
  document.querySelectorAll('#cashout-modal .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _modalHistory.push(btn.dataset.color);
      updateModalCalcs();
    });
  });

  document.getElementById('modal-undo-btn')?.addEventListener('click', () => {
    _modalHistory.pop();
    updateModalCalcs();
  });

  document.getElementById('modal-clear-btn')?.addEventListener('click', () => {
    _modalHistory = [];
    updateModalCalcs();
  });

  await loadCashout(gameId);
}

async function loadCashout(gameId) {
  try {
    const [gameRes, roundsRes] = await Promise.all([
      fetch(`/api/games/${gameId}`),
      fetch(`/api/games/${gameId}/rounds`),
    ]);

    if (!gameRes.ok) {
      showError('Failed to load game.');
      return;
    }

    _game = await gameRes.json();
    _rounds = roundsRes.ok ? await roundsRes.json() : [];

    renderCashoutContent();
  } catch (err) {
    showError('Network error. Please try again.');
  }
}

// ─── Main content ─────────────────────────────────────────────────────────────

function renderCashoutContent() {
  const contentEl = document.getElementById('cashout-content');
  if (!contentEl || !_game) return;

  const totalRake = computeTotalRake(_rounds);

  contentEl.innerHTML = `
    <h2 class="section-title">${escapeHtml(_game.name)}</h2>
    <p class="cashout-subtitle">Tap a player to enter their chips</p>

    <div class="player-cards" id="player-cards">
      ${_game.players.map(player => `
        <div
          class="player-card"
          data-player="${escapeHtml(player)}"
          role="button"
          tabindex="0"
          aria-label="Enter chips for ${escapeHtml(player)}"
        >
          <span class="player-card-name">${escapeHtml(player)}</span>
          <span class="player-card-hint">Tap to enter chips</span>
        </div>
      `).join('')}
    </div>

    <div class="total-rake-row">
      <span class="total-rake-label">Total Rake Collected</span>
      <span class="total-rake-value" id="total-rake-display">NPR ${formatNumber(totalRake)}</span>
    </div>
  `;

  // Attach player card listeners
  contentEl.querySelectorAll('.player-card').forEach(card => {
    const handler = () => openModal(card.dataset.player);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(playerName) {
  _activePlayer = playerName;
  _modalHistory = [];

  const modal = document.getElementById('cashout-modal');
  const titleEl = document.getElementById('modal-title');

  if (titleEl) titleEl.textContent = `${playerName} — Enter Chips`;
  if (modal) modal.classList.remove('hidden');

  updateModalCalcs();
}

function closeModal() {
  _activePlayer = null;
  _modalHistory = [];

  const modal = document.getElementById('cashout-modal');
  if (modal) modal.classList.add('hidden');
}

function updateModalCalcs() {
  if (!_game || !_activePlayer) return;

  const counts = getModalCounts();
  const chipValue = computePot(counts, _game.chipValues);
  const rakeOwed = computePlayerRakeOwed(_rounds, _activePlayer);
  const payout = computePayout(counts, _game.chipValues, rakeOwed);

  // Update chip counts
  CHIP_COLORS.forEach(color => {
    const el = document.getElementById(`modal-count-${color}`);
    if (el) el.textContent = counts[color];
  });

  // Update calculations
  const chipValueEl = document.getElementById('modal-chip-value');
  const rakeOwedEl  = document.getElementById('modal-rake-owed');
  const payoutEl    = document.getElementById('modal-payout');

  if (chipValueEl) chipValueEl.textContent = `NPR ${formatNumber(chipValue)}`;
  if (rakeOwedEl)  rakeOwedEl.textContent  = `NPR ${formatNumber(rakeOwed)}`;
  if (payoutEl)    payoutEl.textContent    = `NPR ${formatNumber(payout)}`;
}

function getModalCounts() {
  return _modalHistory.reduce(
    (acc, color) => { acc[color]++; return acc; },
    { white: 0, red: 0, green: 0, blue: 0 }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showError(message) {
  const contentEl = document.getElementById('cashout-content');
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
