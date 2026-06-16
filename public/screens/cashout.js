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

            <!-- PRIMARY: big settlement banner -->
            <div id="modal-settlement-banner" class="settlement-banner">
              <span class="settlement-label" id="modal-settlement-label">—</span>
              <span class="settlement-amount" id="modal-payout">NPR 0</span>
            </div>

            <!-- SECONDARY: breakdown, dimmed -->
            <details class="calc-details">
              <summary class="calc-details-toggle">Details</summary>
              <div class="calc-breakdown">
                <div class="calc-row">
                  <span class="calc-label">Chips returned</span>
                  <span class="calc-value" id="modal-chip-value">NPR 0</span>
                </div>
                <div class="calc-row calc-row--deduct">
                  <span class="calc-label">− Rake owed</span>
                  <span class="calc-value" id="modal-rake-owed">NPR 0</span>
                </div>
                <div class="calc-row calc-row--deduct" id="modal-lent-row">
                  <span class="calc-label">− Lent (owes you)</span>
                  <span class="calc-value" id="modal-lent">—</span>
                </div>
                <div class="calc-divider"></div>
                <div class="calc-row calc-row--info" id="modal-buyin-row">
                  <span class="calc-label">Bought (paid upfront)</span>
                  <span class="calc-value" id="modal-buyin">—</span>
                </div>
                <div class="calc-row calc-row--net">
                  <span class="calc-label">Player net P&amp;L</span>
                  <span class="calc-value" id="modal-net">—</span>
                </div>
              </div>
            </details>

          </div>

          <!-- Chip value — yellow, live, outside the calcs box -->
          <div class="modal-chip-total" id="modal-chip-total">NPR 0 in chips</div>
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
      <!-- Settlement summary modal -->
      <div id="summary-modal" class="modal-overlay hidden" role="dialog" aria-modal="true">
        <div class="modal-panel summary-modal-panel">
          <div class="modal-header">
            <h2 class="modal-title">Settlement Summary</h2>
            <button id="summary-close-btn" class="btn btn-ghost" aria-label="Close">✕</button>
          </div>
          <div id="summary-content"></div>
        </div>
      </div>

    </div>
  `;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function attachListeners(params) {
  const { gameId } = params;

  document.getElementById('back-btn')?.addEventListener('click', () => {
    navigate('home');
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

  document.getElementById('summary-close-btn')?.addEventListener('click', () => {
    document.getElementById('summary-modal')?.classList.add('hidden');
  });

  document.getElementById('summary-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('summary-modal'))
      document.getElementById('summary-modal').classList.add('hidden');
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
      ${_game.players.map(player => {
        const reg = getRegistry(player);
        let hint = 'Tap to enter chips';
        let hintColor = '';
        if (reg && reg.chips) {
          const chipValue = computePot(reg.chips, _game.chipValues);
          const rakeOwed  = computePlayerRakeOwed(_rounds, player);
          const buyIn     = reg.buyIn || 0;
          const lent      = reg.lent  || 0;
          const cashToPay = chipValue - rakeOwed - lent;
          const playerNet = cashToPay - buyIn;
          const abs       = Math.abs(cashToPay);
          if (cashToPay > 0) {
            hint      = `Pay NPR ${formatNumber(abs)} · they ${playerNet >= 0 ? 'won' : 'lost'} NPR ${formatNumber(Math.abs(playerNet))}`;
            hintColor = 'var(--color-error)';
          } else if (cashToPay < 0) {
            hint      = `Collect NPR ${formatNumber(abs)} · they lost NPR ${formatNumber(Math.abs(playerNet))}`;
            hintColor = 'var(--color-success)';
          } else {
            hint      = 'Settled · NPR 0';
            hintColor = 'var(--color-text-muted)';
          }
        }
        return `
        <div
          class="player-card"
          data-player="${escapeHtml(player)}"
          role="button"
          tabindex="0"
          aria-label="Enter chips for ${escapeHtml(player)}"
        >
          <span class="player-card-name">${escapeHtml(player)}</span>
          <span class="player-card-hint" style="color:${hintColor}">${hint}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="total-rake-row">
      <span class="total-rake-label">Total Rake Collected</span>
      <span class="total-rake-value" id="total-rake-display">NPR ${formatNumber(totalRake)}</span>
    </div>

    <button id="settlement-summary-btn" class="btn btn-primary btn-full settlement-summary-btn">
      Settlement Summary
    </button>
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

  document.getElementById('settlement-summary-btn')?.addEventListener('click', showSettlementSummary);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(playerName) {
  _activePlayer = playerName;

  // Pre-fill history from saved cashout chips if available
  _modalHistory = [];
  const reg = getRegistry(playerName);
  if (reg && reg.chips) {
    CHIP_COLORS.forEach(color => {
      const count = reg.chips[color] || 0;
      for (let i = 0; i < count; i++) _modalHistory.push(color);
    });
  }

  const modal = document.getElementById('cashout-modal');
  const titleEl = document.getElementById('modal-title');

  if (titleEl) titleEl.textContent = `${playerName} — Enter Chips`;
  if (modal) modal.classList.remove('hidden');

  updateModalCalcs();
}

async function closeModal() {
  if (_activePlayer && _game) {
    await saveChips(_activePlayer, getModalCounts());
  }

  _activePlayer = null;
  _modalHistory = [];

  const modal = document.getElementById('cashout-modal');
  if (modal) modal.classList.add('hidden');
}

function updateModalCalcs() {
  if (!_game || !_activePlayer) return;

  const counts    = getModalCounts();
  const chipValue = computePot(counts, _game.chipValues);
  const rakeOwed  = computePlayerRakeOwed(_rounds, _activePlayer);

  const reg   = getRegistry(_activePlayer);
  const buyIn = reg?.buyIn || 0;
  const lent  = reg?.lent  || 0;

  // Cash to pay player:
  // - bought (paid upfront): chips - rake        (cash already received, don't deduct again)
  // - lent (never paid):     chips - rake - lent (settle the debt at cashout)
  const cashToPay = chipValue - rakeOwed - lent;

  // Player net P&L vs what they originally spent (bought)
  const playerNet = cashToPay - buyIn;

  // Update chip counts
  CHIP_COLORS.forEach(color => {
    const el = document.getElementById(`modal-count-${color}`);
    if (el) el.textContent = counts[color];
  });

  const bannerEl    = document.getElementById('modal-settlement-banner');
  const labelEl     = document.getElementById('modal-settlement-label');
  const payoutEl    = document.getElementById('modal-payout');
  const chipTotalEl = document.getElementById('modal-chip-total');
  const chipValueEl = document.getElementById('modal-chip-value');
  const rakeOwedEl  = document.getElementById('modal-rake-owed');
  const buyInEl     = document.getElementById('modal-buyin');
  const lentEl      = document.getElementById('modal-lent');
  const netEl       = document.getElementById('modal-net');

  if (chipTotalEl) chipTotalEl.textContent = `NPR ${formatNumber(chipValue)} in chips`;
  if (chipValueEl) chipValueEl.textContent = `NPR ${formatNumber(chipValue)}`;
  if (rakeOwedEl)  rakeOwedEl.textContent  = `NPR ${formatNumber(rakeOwed)}`;
  if (buyInEl)     buyInEl.textContent     = buyIn > 0 ? `NPR ${formatNumber(buyIn)}` : '—';
  if (lentEl)      lentEl.textContent      = lent  > 0 ? `NPR ${formatNumber(lent)}`  : '—';

  // Settlement banner — from YOUR perspective
  if (payoutEl && labelEl && bannerEl) {
    const abs = Math.abs(cashToPay);
    if (cashToPay > 0) {
      // You pay the player
      labelEl.textContent  = `You pay ${_activePlayer}`;
      payoutEl.textContent = `NPR ${formatNumber(abs)}`;
      bannerEl.className   = 'settlement-banner settlement-banner--pay';
    } else if (cashToPay < 0) {
      // Player owes you (they lost everything + rake)
      labelEl.textContent  = `Collect from ${_activePlayer}`;
      payoutEl.textContent = `NPR ${formatNumber(abs)}`;
      bannerEl.className   = 'settlement-banner settlement-banner--collect';
    } else {
      labelEl.textContent  = 'Settled';
      payoutEl.textContent = 'NPR 0';
      bannerEl.className   = 'settlement-banner settlement-banner--even';
    }
  }

  if (netEl && (buyIn > 0 || lent > 0)) {
    const absNet = Math.abs(playerNet);
    if (playerNet > 0) {
      netEl.textContent = `+NPR ${formatNumber(absNet)} (won)`;
      netEl.style.color = 'var(--color-success)';
    } else if (playerNet < 0) {
      netEl.textContent = `-NPR ${formatNumber(absNet)} (lost)`;
      netEl.style.color = 'var(--color-error)';
    } else {
      netEl.textContent = 'Broke even';
      netEl.style.color = 'var(--color-text-muted)';
    }
  } else if (netEl) {
    netEl.textContent = '—';
    netEl.style.color = 'var(--color-text-muted)';
  }
}

function getModalCounts() {
  return _modalHistory.reduce(
    (acc, color) => { acc[color]++; return acc; },
    { white: 0, red: 0, green: 0, blue: 0 }
  );
}

function getRegistry(playerName) {
  if (!_game || !_game.registry) return null;
  return _game.registry instanceof Map
    ? _game.registry.get(playerName)
    : _game.registry[playerName];
}

async function saveChips(playerName, chips) {
  const existing = getRegistry(playerName) || {};
  const entry = {
    buyIn: existing.buyIn || 0,
    lent:  existing.lent  || 0,
    chips,
  };

  try {
    const res = await fetch(`/api/games/${_game._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registry: { [playerName]: entry } }),
    });

    if (res.ok) {
      const updated = await res.json();
      _game.registry = updated.registry;
      // Refresh player card hint to show saved chip value
      refreshPlayerCard(playerName);
    }
  } catch {
    // silent — not critical
  }
}

function refreshPlayerCard(playerName) {
  const card = document.querySelector(`.player-card[data-player="${CSS.escape(playerName)}"]`);
  if (!card) return;

  const reg = getRegistry(playerName);
  const hint = card.querySelector('.player-card-hint');
  if (!hint) return;

  if (reg && reg.chips) {
    const chipValue = computePot(reg.chips, _game.chipValues);
    const rakeOwed  = computePlayerRakeOwed(_rounds, playerName);
    const buyIn     = reg.buyIn || 0;
    const lent      = reg.lent  || 0;
    const cashToPay = chipValue - rakeOwed - lent;
    const playerNet = cashToPay - buyIn;
    const abs       = Math.abs(cashToPay);
    let   text, color;
    if (cashToPay > 0) {
      text  = `Pay NPR ${formatNumber(abs)}`;
      color = 'var(--color-error)';
    } else if (cashToPay < 0) {
      text  = `Collect NPR ${formatNumber(abs)}`;
      color = 'var(--color-success)';
    } else {
      text  = 'Settled';
      color = 'var(--color-text-muted)';
    }
    const netSign = playerNet >= 0 ? '+' : '';
    hint.textContent = `${text} · they ${playerNet >= 0 ? 'won' : 'lost'} NPR ${formatNumber(Math.abs(playerNet))}`;
    hint.style.color = color;
  } else {
    hint.textContent = 'Tap to enter chips';
    hint.style.color = '';
  }
}

// ─── Settlement Summary ───────────────────────────────────────────────────────

/**
 * Debt minimization algorithm.
 * Given a map of { person: netBalance } where positive = owed to host, negative = host owes them,
 * but here we treat the host as "YOU" and compute net balances for all players relative to you.
 *
 * Returns a list of { from, to, amount } transactions that settle all debts
 * with the minimum number of transfers, routing through players when it saves a transaction.
 */
function minimizeTransactions(balances) {
  // balances: { playerName: number }
  // positive = they owe you, negative = you owe them
  // Convert to a flat creditor/debtor list (all relative to cash flow)
  // We include "YOU" as a participant with balance = -sum(all others)

  const entries = Object.entries(balances).map(([name, bal]) => ({ name, bal }));
  const youBal  = -entries.reduce((s, e) => s + e.bal, 0);
  const all     = [...entries, { name: 'You', bal: youBal }];

  // Greedy: repeatedly match largest debtor with largest creditor
  const debtors  = all.filter(e => e.bal < 0).map(e => ({ ...e, bal: -e.bal })).sort((a,b) => b.bal - a.bal);
  const creditors = all.filter(e => e.bal > 0).sort((a,b) => b.bal - a.bal);

  const txns = [];
  let di = 0, ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const amount = Math.min(d.bal, c.bal);

    if (amount > 0.005) { // ignore floating point dust
      txns.push({ from: d.name, to: c.name, amount: Math.round(amount * 100) / 100 });
    }

    d.bal -= amount;
    c.bal -= amount;

    if (d.bal < 0.005) di++;
    if (c.bal < 0.005) ci++;
  }

  return txns;
}

function showSettlementSummary() {
  const modal   = document.getElementById('summary-modal');
  const content = document.getElementById('summary-content');
  if (!modal || !content || !_game) return;

  // Build per-player cashToPay (positive = you pay them, negative = they pay you)
  const missing = [];
  const balances = {}; // { player: amount they owe you } positive = they owe you

  for (const player of _game.players) {
    const reg = getRegistry(player);
    if (!reg || !reg.chips) { missing.push(player); continue; }

    const chipValue = computePot(reg.chips, _game.chipValues);
    const rakeOwed  = computePlayerRakeOwed(_rounds, player);
    const lent      = reg?.lent  || 0;
    const cashToPay = chipValue - rakeOwed - lent; // positive = you pay them

    // From your perspective: positive cashToPay = you owe them = negative balance for you
    balances[player] = -cashToPay; // positive = they owe you
  }

  if (Object.keys(balances).length === 0) {
    content.innerHTML = `<p class="empty-state">Enter chips for at least one player first.</p>`;
    modal.classList.remove('hidden');
    return;
  }

  const txns = minimizeTransactions(balances);

  // Net for you
  const youNet = Object.values(balances).reduce((s, b) => s + b, 0);

  const netBanner = youNet > 0
    ? `<div class="summary-net summary-net--receive">You net receive <strong>NPR ${formatNumber(Math.round(youNet * 100)/100)}</strong></div>`
    : youNet < 0
    ? `<div class="summary-net summary-net--pay">You net pay <strong>NPR ${formatNumber(Math.round(Math.abs(youNet) * 100)/100)}</strong></div>`
    : `<div class="summary-net summary-net--even">All settled — NPR 0 net</div>`;

  const txnRows = txns.map(t => {
    const fromIsYou = t.from === 'You';
    const toIsYou   = t.to   === 'You';
    const fromClass = fromIsYou ? 'summary-you' : 'summary-player';
    const toClass   = toIsYou   ? 'summary-you' : 'summary-player';
    const rowClass  = fromIsYou ? 'summary-row summary-row--pay'
                    : toIsYou   ? 'summary-row summary-row--collect'
                    : 'summary-row summary-row--indirect';
    return `
      <div class="${rowClass}">
        <div class="summary-txn-players">
          <span class="${fromClass}">${escapeHtml(t.from)}</span>
          <span class="summary-arrow">→</span>
          <span class="${toClass}">${escapeHtml(t.to)}</span>
        </div>
        <span class="summary-amount ${fromIsYou ? 'summary-amount--pay' : toIsYou ? 'summary-amount--collect' : 'summary-amount--indirect'}">
          NPR ${formatNumber(t.amount)}
        </span>
      </div>`;
  }).join('');

  const missingNote = missing.length
    ? `<p class="summary-missing">⚠ Not entered yet: ${missing.map(s => escapeHtml(s)).join(', ')}</p>`
    : '';

  content.innerHTML = `
    ${netBanner}
    <div class="summary-section-title">${txns.length} transaction${txns.length !== 1 ? 's' : ''} to settle</div>
    <div class="summary-list">${txnRows}</div>
    ${missingNote}
  `;

  modal.classList.remove('hidden');
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
