/**
 * public/lib/chipState.js
 * Chip entry state module — history-based chip state management.
 * Requirements: 4.5, 4.6
 *
 * Uses a dual-export pattern so the module works both:
 *   - In the browser (as a script or ES module import)
 *   - In Node.js/Jest tests via require()
 */

/** @type {Array<'white'|'red'|'green'|'blue'>} */
let _history = [];

/**
 * Push a chip color onto the history stack.
 * @param {'white'|'red'|'green'|'blue'} color
 */
function addChip(color) {
  _history.push(color);
}

/**
 * Remove the last added chip from the history stack.
 * No-op if history is empty.
 */
function undo() {
  _history.pop();
}

/**
 * Reset the history to an empty array.
 */
function clear() {
  _history = [];
}

/**
 * Derive current chip counts from the history array.
 * @returns {{ white: number, red: number, green: number, blue: number }}
 */
function getCounts() {
  return _history.reduce(
    (acc, color) => {
      acc[color]++;
      return acc;
    },
    { white: 0, red: 0, green: 0, blue: 0 }
  );

}

// CommonJS export for Node.js / Jest
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { addChip, undo, clear, getCounts };
}
