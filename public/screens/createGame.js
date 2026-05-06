/**
 * public/screens/createGame.js
 * Create Game screen — name, players, chip values, rake percent.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { navigate } from '../main.js';

const RAKE_OPTIONS = [1, 2, 2.5, 3, 5];
const DEFAULT_CHIP_VALUES = { white: 5, red: 25, green: 50, blue: 125 };

/**
 * Render the create game screen HTML and attach event listeners.
 *
 * @returns {string} HTML string
 */
export function render() {
  requestAnimationFrame(() => attachListeners());

  return `
    <div class="app-container create-game-screen">
      <div class="screen-header">
        <button id="back-btn" class="btn btn-ghost" aria-label="Go back">← Back</button>
        <h1 class="screen-title">New Game</h1>
      </div>

      <form id="create-game-form" novalidate>

        <!-- Game Name -->
        <section class="form-section">
          <h2 class="section-title">Game Name</h2>
          <div class="form-group">
            <input
              type="text"
              id="game-name"
              name="gameName"
              placeholder="e.g. Friday Night Poker"
              autocomplete="off"
              required
            />
            <span class="field-error" id="game-name-error"></span>
          </div>
        </section>

        <!-- Players -->
        <section class="form-section">
          <h2 class="section-title">Players</h2>
          <div id="players-list">
            <div class="form-group player-row">
              <input type="text" class="player-input" placeholder="Player 1" autocomplete="off" />
            </div>
            <div class="form-group player-row">
              <input type="text" class="player-input" placeholder="Player 2" autocomplete="off" />
            </div>
          </div>
          <button type="button" id="add-player-btn" class="btn btn-secondary btn-full">
            + Add Player
          </button>
          <span class="field-error" id="players-error"></span>
        </section>

        <!-- Chip Values -->
        <section class="form-section">
          <h2 class="section-title">Chip Values (NPR)</h2>
          <div class="chip-values-grid">
            <div class="form-group chip-value-row">
              <label for="chip-white" class="chip-label chip-label--white">White</label>
              <input type="number" id="chip-white" name="chipWhite" value="${DEFAULT_CHIP_VALUES.white}" min="1" inputmode="numeric" />
            </div>
            <div class="form-group chip-value-row">
              <label for="chip-red" class="chip-label chip-label--red">Red</label>
              <input type="number" id="chip-red" name="chipRed" value="${DEFAULT_CHIP_VALUES.red}" min="1" inputmode="numeric" />
            </div>
            <div class="form-group chip-value-row">
              <label for="chip-green" class="chip-label chip-label--green">Green</label>
              <input type="number" id="chip-green" name="chipGreen" value="${DEFAULT_CHIP_VALUES.green}" min="1" inputmode="numeric" />
            </div>
            <div class="form-group chip-value-row">
              <label for="chip-blue" class="chip-label chip-label--blue">Blue</label>
              <input type="number" id="chip-blue" name="chipBlue" value="${DEFAULT_CHIP_VALUES.blue}" min="1" inputmode="numeric" />
            </div>
          </div>
          <span class="field-error" id="chip-values-error"></span>
        </section>

        <!-- Rake Percent -->
        <section class="form-section">
          <h2 class="section-title">Rake Percentage</h2>
          <div class="rake-options" role="radiogroup" aria-label="Rake percentage">
            ${RAKE_OPTIONS.map(pct => `
              <label class="rake-option">
                <input type="radio" name="rakePercent" value="${pct}" ${pct === 3 ? 'checked' : ''} />
                <span class="rake-option-label">${pct}%</span>
              </label>
            `).join('')}
          </div>
          <span class="field-error" id="rake-error"></span>
        </section>

        <!-- Global error -->
        <div id="form-error" class="error-message" role="alert" aria-live="polite"></div>

        <button type="submit" id="create-btn" class="btn btn-primary btn-full">
          Create Game
        </button>
      </form>
    </div>
  `;
}

function attachListeners() {
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => navigate('home'));
  }

  const addPlayerBtn = document.getElementById('add-player-btn');
  if (addPlayerBtn) {
    addPlayerBtn.addEventListener('click', addPlayerInput);
  }

  const form = document.getElementById('create-game-form');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
}

function addPlayerInput() {
  const playersList = document.getElementById('players-list');
  const count = playersList.querySelectorAll('.player-input').length + 1;
  const div = document.createElement('div');
  div.className = 'form-group player-row';
  div.innerHTML = `<input type="text" class="player-input" placeholder="Player ${count}" autocomplete="off" />`;
  playersList.appendChild(div);
  div.querySelector('input').focus();
}

async function handleSubmit(e) {
  e.preventDefault();

  // Clear previous errors
  clearErrors();

  const gameName = document.getElementById('game-name').value.trim();
  const playerInputs = document.querySelectorAll('.player-input');
  const players = Array.from(playerInputs)
    .map(inp => inp.value.trim())
    .filter(name => name.length > 0);

  const chipWhite = Number(document.getElementById('chip-white').value);
  const chipRed   = Number(document.getElementById('chip-red').value);
  const chipGreen = Number(document.getElementById('chip-green').value);
  const chipBlue  = Number(document.getElementById('chip-blue').value);

  const rakeInput = document.querySelector('input[name="rakePercent"]:checked');
  const rakePercent = rakeInput ? Number(rakeInput.value) : null;

  // Client-side validation
  let hasError = false;

  if (!gameName) {
    showFieldError('game-name-error', 'Game name is required.');
    hasError = true;
  }

  if (players.length < 2) {
    showFieldError('players-error', 'At least 2 players are required.');
    hasError = true;
  }

  if (!rakePercent) {
    showFieldError('rake-error', 'Please select a rake percentage.');
    hasError = true;
  }

  if (hasError) return;

  const submitBtn = document.getElementById('create-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';

  const payload = {
    name: gameName,
    players,
    chipValues: {
      white: chipWhite,
      red:   chipRed,
      green: chipGreen,
      blue:  chipBlue,
    },
    rakePercent,
  };

  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const game = await res.json();
      navigate('game', { id: game._id });
    } else if (res.status === 400) {
      const body = await res.json();
      const details = body.details || [];
      if (details.length) {
        showFieldError('form-error', details.join(' '));
      } else {
        showFieldError('form-error', body.error || 'Validation failed.');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Game';
    } else {
      showFieldError('form-error', 'Something went wrong. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Game';
    }
  } catch (err) {
    showFieldError('form-error', 'Network error. Please check your connection.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Game';
  }
}

function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

function clearErrors() {
  document.querySelectorAll('.field-error, .error-message').forEach(el => {
    el.textContent = '';
  });
}
