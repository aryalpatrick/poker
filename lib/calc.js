/**
 * lib/calc.js
 * Single source of truth for all monetary calculations in the Poker App.
 * All values are in NPR (Nepalese Rupee).
 * Pure functions — no side effects, no I/O.
 */

/**
 * Compute the total pot value from chip counts and chip values.
 *
 * @param {{ white: number, red: number, green: number, blue: number }} chips
 * @param {{ white: number, red: number, green: number, blue: number }} chipValues
 * @returns {number} Total pot in NPR
 */
function computePot(chips, chipValues) {
  return (
    chips.white * chipValues.white +
    chips.red   * chipValues.red   +
    chips.green * chipValues.green +
    chips.blue  * chipValues.blue
  );
}

/**
 * Compute the rake amount from a pot value and rake percentage.
 *
 * @param {number} potNPR     - Pot value in NPR
 * @param {number} rakePercent - Rake percentage (one of: 1, 2, 2.5, 3, 5)
 * @returns {number} Rake amount in NPR
 */
function computeRake(potNPR, rakePercent) {
  return potNPR * (rakePercent / 100);
}

/**
 * Compute the cashout payout for a player.
 *
 * @param {{ white: number, red: number, green: number, blue: number }} chips
 * @param {{ white: number, red: number, green: number, blue: number }} chipValues
 * @param {number} rakeOwed - Total rake owed by the player in NPR
 * @returns {number} Payout in NPR (chip value minus rake owed)
 */
function computePayout(chips, chipValues, rakeOwed) {
  return computePot(chips, chipValues) - rakeOwed;
}

/**
 * Compute the total rake owed by a specific player across all rounds they won.
 *
 * @param {Array<{ winnerName: string, rakeNPR: number }>} rounds
 * @param {string} playerName
 * @returns {number} Sum of rakeNPR for all rounds won by playerName; 0 if none
 */
function computePlayerRakeOwed(rounds, playerName) {
  return rounds
    .filter(round => round.winnerName === playerName)
    .reduce((sum, round) => sum + round.rakeNPR, 0);
}

/**
 * Compute the total rake collected across all rounds.
 *
 * @param {Array<{ rakeNPR: number }>} rounds
 * @returns {number} Sum of rakeNPR across all rounds; 0 for empty array
 */
function computeTotalRake(rounds) {
  return rounds.reduce((sum, round) => sum + round.rakeNPR, 0);
}

module.exports = {
  computePot,
  computeRake,
  computePayout,
  computePlayerRakeOwed,
  computeTotalRake,
};
