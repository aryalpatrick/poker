/**
 * public/screens/activeGame.js
 * Active Game screen — round log, rake selector, new round, end game.
 * Registry modal: tap player → tap chips → Bought / Lent buttons.
 */

import { navigate } from '../main.js';
import { computePot } from '../lib/calc.js';

const RAKE_OPTIONS  = [1, 2, 2.5, 3, 5];
const CHIP_COLORS   = ['white', 'red', 'green', 'blue'];

let _game   = null;
let _rounds = [];

// Registry modal state
let _regPlayer  = null;   // which player is open
let _regHistory = [];     // chip taps

// ─── Render shell ─────────────────────────────────────────────────────────────

export function render(params) {
  requestAnimationFrame(() => attachListeners(params));

  return `
    <div class="app-container active-game-screen">

      <!-- Header: Back | Game Name (center) | Registry -->
      <div class="screen-header game-header">
        <button id="back-btn" class="btn btn-ghost" aria-label="Go back">← Back</button>
        <h1 class="screen-title game-header-title" id="game-title">Loading…</h1>
        <button id="registry-btn" class="btn btn-secondary btn-sm">Registry</button>
      </div>

      <div id="game-content" class="game-content">
        <p class="loading-text">Loading game…</p>
      </div>

      <!-- Registry modal -->
      <div id="registry-modal" class="modal-overlay hidden" role="dialog" aria-modal="true">
        <div class="modal-panel registry-modal-panel">
          <div class="modal-header">
            <h2 class="modal-title">Registry</h2>
            <button id="registry-close-btn" class="btn btn-ghost" aria-label="Close">✕</button>
          </div>

          <!-- Step 1: player list -->
          <div id="reg-player-list"></div>

          <!-- Step 2: chip entry for selected player (hidden until player chosen) -->
          <div id="reg-chip-entry" class="hidden">
            <div class="reg-back-row">
              <button id="reg-back-player-btn" class="btn btn-ghost btn-sm">← Players</button>
              <span id="reg-player-name" class="reg-player-name-title"></span>
            </div>

            <!-- Saved summary for this player -->
            <div id="reg-saved-summary" class="reg-saved-summary hidden"></div>

            <!-- Live total -->
            <div class="reg-total" id="reg-total">NPR 0</div>

            <!-- Chip counts -->
            <div class="chip-counts" id="reg-chip-counts">
              ${CHIP_COLORS.map(c => `
                <div class="chip-count chip-count--${c}">
                  <span class="chip-count-label">${capitalize(c)}</span>
                  <span class="chip-count-value" id="reg-count-${c}">0</span>
                </div>`).join('')}
            </div>

            <!-- Chip buttons -->
            <div class="chip-buttons" role="group">
              ${CHIP_COLORS.map(c => `
                <button class="chip-btn chip-btn--${c} reg-chip-btn" data-color="${c}"
                  aria-label="Add ${c} chip">${capitalize(c)}</button>`).join('')}
            </div>

            <!-- Undo / Clear -->
            <div class="chip-controls">
              <button id="reg-undo-btn" class="btn btn-secondary">Undo</button>
              <button id="reg-clear-btn" class="btn btn-secondary">Clear</button>
            </div>

            <!-- Action buttons -->
            <div class="reg-action-btns">
              <button id="reg-bought-btn" class="btn btn-primary">Bought</button>
              <button id="reg-lent-btn"   class="btn btn-secondary">Lent</button>
            </div>
            <div id="reg-save-status" class="registry-status"></div>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function attachListeners(params) {
  const { id } = params;
  if (!id) return;

  document.getElementById('back-btn')?.addEventListener('click', () => navigate('home'));
  document.getElementById('registry-btn')?.addEventListener('click', openRegistryModal);
  document.getElementById('registry-close-btn')?.addEventListener('click', closeRegistryModal);

  // Close on overlay click
  document.getElementById('registry-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('registry-modal')) closeRegistryModal();
  });

  await loadGame(id);
}

async function loadGame(id) {
  try {
    const [gameRes, roundsRes] = await Promise.all([
      fetch(`/api/games/${id}`),
      fetch(`/api/games/${id}/rounds`),
    ]);
    if (!gameRes.ok) { showError('Failed to load game.'); return; }
    _game   = await gameRes.json();
    _rounds = roundsRes.ok ? await roundsRes.json() : [];
    renderGameContent();
  } catch {
    showError('Network error. Please try again.');
  }
}

// ─── Main content ─────────────────────────────────────────────────────────────

function renderGameContent() {
  const titleEl = document.getElementById('game-title');
  if (titleEl) titleEl.textContent = _game.name;

  const contentEl = document.getElementById('game-content');
  if (!contentEl) return;

  const sortedRounds = [..._rounds].sort((a, b) => b.roundNumber - a.roundNumber);

  const roundRows = sortedRounds.length
    ? sortedRounds.map(r => `
        <div class="round-row">
          <div class="round-row-info">
            <span class="round-number">#${r.roundNumber}</span>
            <span class="round-winner">${escapeHtml(r.winnerName)}</span>
          </div>
          <div class="round-row-values">
            <span class="round-pot">NPR ${formatNumber(r.potNPR)}</span>
            <span class="round-rake">Rake: NPR ${formatNumber(r.rakeNPR)}</span>
          </div>
          <button class="btn btn-ghost btn-sm edit-round-btn"
            data-round-id="${r._id}" aria-label="Edit round ${r.roundNumber}">Edit</button>
        </div>`).join('')
    : '<p class="empty-state">No rounds yet. Start the first round!</p>';

  const rakeOptions = RAKE_OPTIONS.map(pct =>
    `<option value="${pct}" ${_game.rakePercent === pct ? 'selected' : ''}>${pct}%</option>`
  ).join('');

  contentEl.innerHTML = `
    <div class="game-top-bar">
      <button id="new-round-btn" class="btn btn-primary btn-full"
        ${_game.status === 'closed' ? 'disabled' : ''}>+ New Round</button>
    </div>

    <div class="round-log-container" id="round-log">${roundRows}</div>

    <div id="action-error" class="error-message" role="alert" aria-live="polite"></div>

    <div class="game-bottom-bar">
      <div class="rake-selector-row">
        <label for="rake-select" class="rake-selector-label">Rake</label>
        <select id="rake-select" class="rake-select"
          ${_game.status === 'closed' ? 'disabled' : ''}>${rakeOptions}</select>
      </div>
      ${_game.status === 'closed'
        ? `<button id="cashout-btn" class="btn btn-primary">View Cashout</button>`
        : `<button id="end-game-btn" class="btn btn-danger">End Game</button>`}
    </div>
  `;

  document.getElementById('new-round-btn')?.addEventListener('click', () =>
    navigate('round-entry', { gameId: _game._id }));
  document.getElementById('end-game-btn')?.addEventListener('click', handleEndGame);
  document.getElementById('cashout-btn')?.addEventListener('click', () =>
    navigate('cashout', { gameId: _game._id }));
  document.getElementById('rake-select')?.addEventListener('change', handleRakeChange);

  document.querySelectorAll('.edit-round-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newHash = `#round-entry/${_game._id}/${btn.dataset.roundId}`;
      if (window.location.hash !== newHash) window.location.hash = newHash;
    });
  });
}

// ─── Registry modal ───────────────────────────────────────────────────────────

function getEntry(player) {
  if (!_game?.registry) return null;
  return _game.registry instanceof Map
    ? _game.registry.get(player)
    : _game.registry[player];
}

function openRegistryModal() {
  _regPlayer  = null;
  _regHistory = [];
  renderPlayerList();
  document.getElementById('reg-chip-entry')?.classList.add('hidden');
  document.getElementById('reg-player-list')?.classList.remove('hidden');
  document.getElementById('registry-modal')?.classList.remove('hidden');
}

function closeRegistryModal() {
  document.getElementById('registry-modal')?.classList.add('hidden');
}

function renderPlayerList() {
  const listEl = document.getElementById('reg-player-list');
  if (!listEl) return;

  listEl.innerHTML = `
    <p class="registry-subtitle">Tap a player to record chips bought or lent</p>
    <div class="registry-player-list">
      ${_game.players.map(player => {
        const entry  = getEntry(player);
        const buyIn  = entry?.buyIn || 0;
        const lent   = entry?.lent  || 0;
        const hasSaved = buyIn > 0 || lent > 0;
        return `
        <div class="reg-player-row" data-player="${escapeHtml(player)}" role="button" tabindex="0">
          <span class="reg-player-row-name">${escapeHtml(player)}</span>
          <span class="reg-player-row-meta">
            ${hasSaved
              ? `<span class="reg-tag reg-tag--bought">Bought NPR ${formatNumber(buyIn)}</span>
                 ${lent > 0 ? `<span class="reg-tag reg-tag--lent">Lent NPR ${formatNumber(lent)}</span>` : ''}`
              : `<span class="reg-tag reg-tag--empty">Not set</span>`}
          </span>
        </div>`;
      }).join('')}
    </div>
  `;

  listEl.querySelectorAll('.reg-player-row').forEach(row => {
    const open = () => openPlayerChips(row.dataset.player);
    row.addEventListener('click', open);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
  });
}

function openPlayerChips(player) {
  _regPlayer  = player;
  _regHistory = [];

  document.getElementById('reg-player-list')?.classList.add('hidden');
  const chipEntry = document.getElementById('reg-chip-entry');
  chipEntry?.classList.remove('hidden');

  // Set player name title
  const nameEl = document.getElementById('reg-player-name');
  if (nameEl) nameEl.textContent = player;

  // Show saved summary if exists
  const entry   = getEntry(player);
  const summaryEl = document.getElementById('reg-saved-summary');
  if (summaryEl) {
    if (entry && (entry.buyIn > 0 || entry.lent > 0)) {
      summaryEl.innerHTML =
        `<span>Current: <strong>Bought NPR ${formatNumber(entry.buyIn || 0)}</strong>` +
        (entry.lent > 0 ? ` · <strong>Lent NPR ${formatNumber(entry.lent || 0)}</strong>` : '') +
        `</span>`;
      summaryEl.classList.remove('hidden');
    } else {
      summaryEl.classList.add('hidden');
    }
  }

  updateRegChipUI();

  // Wire chip buttons
  document.querySelectorAll('.reg-chip-btn').forEach(btn => {
    btn.onclick = () => { _regHistory.push(btn.dataset.color); updateRegChipUI(); };
  });
  document.getElementById('reg-undo-btn').onclick  = () => { _regHistory.pop(); updateRegChipUI(); };
  document.getElementById('reg-clear-btn').onclick = () => { _regHistory = []; updateRegChipUI(); };

  document.getElementById('reg-back-player-btn').onclick = () => {
    document.getElementById('reg-chip-entry')?.classList.add('hidden');
    document.getElementById('reg-player-list')?.classList.remove('hidden');
    renderPlayerList(); // refresh tags
  };

  document.getElementById('reg-bought-btn').onclick = () => saveRegEntry('buyIn');
  document.getElementById('reg-lent-btn').onclick   = () => saveRegEntry('lent');
}

function updateRegChipUI() {
  const counts = _regHistory.reduce(
    (acc, c) => { acc[c]++; return acc; },
    { white: 0, red: 0, green: 0, blue: 0 }
  );
  const total = computePot(counts, _game.chipValues);

  const totalEl = document.getElementById('reg-total');
  if (totalEl) totalEl.textContent = `NPR ${formatNumber(total)}`;

  CHIP_COLORS.forEach(c => {
    const el = document.getElementById(`reg-count-${c}`);
    if (el) el.textContent = counts[c];
  });
}

async function saveRegEntry(field) {
  const counts = _regHistory.reduce(
    (acc, c) => { acc[c]++; return acc; },
    { white: 0, red: 0, green: 0, blue: 0 }
  );
  const total   = computePot(counts, _game.chipValues);
  const existing = getEntry(_regPlayer) || {};

  const entry = {
    buyIn: existing.buyIn || 0,
    lent:  existing.lent  || 0,
    chips: existing.chips || {},
  };
  entry[field] = (entry[field] || 0) + total; // accumulate

  const statusEl = document.getElementById('reg-save-status');

  try {
    const res = await fetch(`/api/games/${_game._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registry: { [_regPlayer]: entry } }),
    });

    if (res.ok) {
      const updated = await res.json();
      _game.registry = updated.registry;
      _regHistory = [];
      updateRegChipUI();

      // Refresh saved summary
      const newEntry = getEntry(_regPlayer);
      const summaryEl = document.getElementById('reg-saved-summary');
      if (summaryEl && newEntry) {
        summaryEl.innerHTML =
          `<span>Current: <strong>Bought NPR ${formatNumber(newEntry.buyIn || 0)}</strong>` +
          (newEntry.lent > 0 ? ` · <strong>Lent NPR ${formatNumber(newEntry.lent || 0)}</strong>` : '') +
          `</span>`;
        summaryEl.classList.remove('hidden');
      }

      if (statusEl) {
        const label = field === 'buyIn' ? 'Bought' : 'Lent';
        statusEl.textContent = `${label} NPR ${formatNumber(total)} saved ✓`;
        statusEl.className = 'registry-status registry-status--ok';
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
      }
    } else {
      if (statusEl) { statusEl.textContent = 'Save failed'; statusEl.className = 'registry-status registry-status--err'; }
    }
  } catch {
    if (statusEl) { statusEl.textContent = 'Network error'; statusEl.className = 'registry-status registry-status--err'; }
  }
}

// ─── Rake / End Game ──────────────────────────────────────────────────────────

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
    if (res.ok) { _game.rakePercent = newRake; }
    else { if (errorEl) errorEl.textContent = 'Failed to update rake.'; e.target.value = _game.rakePercent; }
  } catch {
    if (errorEl) errorEl.textContent = 'Network error.';
    e.target.value = _game.rakePercent;
  }
}

async function handleEndGame() {
  const errorEl = document.getElementById('action-error');
  if (errorEl) errorEl.textContent = '';
  const btn = document.getElementById('end-game-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Ending…'; }
  try {
    const res = await fetch(`/api/games/${_game._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    if (res.ok) { navigate('cashout', { gameId: _game._id }); }
    else {
      if (errorEl) errorEl.textContent = 'Failed to end game.';
      if (btn) { btn.disabled = false; btn.textContent = 'End Game'; }
    }
  } catch {
    if (errorEl) errorEl.textContent = 'Network error.';
    if (btn) { btn.disabled = false; btn.textContent = 'End Game'; }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function showError(msg) {
  const el = document.getElementById('game-content');
  if (el) el.innerHTML = `<p class="error-message">${escapeHtml(msg)}</p>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatNumber(n) { return Number(n).toLocaleString(); }
function capitalize(s)   { return s.charAt(0).toUpperCase() + s.slice(1); }
