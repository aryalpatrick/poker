'use strict';

const fc = require('fast-check');
const {
  computePot,
  computeRake,
  computePayout,
  computePlayerRakeOwed,
  computeTotalRake,
} = require('./calc');

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

/** Chip counts: 0–100 per color */
const arbChips = fc.record({
  white: fc.integer({ min: 0, max: 100 }),
  red:   fc.integer({ min: 0, max: 100 }),
  green: fc.integer({ min: 0, max: 100 }),
  blue:  fc.integer({ min: 0, max: 100 }),
});

/** Chip values: 1–1000 NPR per color */
const arbChipValues = fc.record({
  white: fc.integer({ min: 1, max: 1000 }),
  red:   fc.integer({ min: 1, max: 1000 }),
  green: fc.integer({ min: 1, max: 1000 }),
  blue:  fc.integer({ min: 1, max: 1000 }),
});

/** Valid rake percentages as defined in the spec */
const VALID_RAKE_PERCENTS = [1, 2, 2.5, 3, 5];
const arbRakePercent = fc.constantFrom(...VALID_RAKE_PERCENTS);

// ---------------------------------------------------------------------------
// Property 1: Pot computation is the weighted sum of chip counts
// ---------------------------------------------------------------------------
// Feature: poker-app, Property 1: Pot computation is the weighted sum of chip counts
describe('Property 1: Pot computation is the weighted sum of chip counts', () => {
  /**
   * Validates: Requirements 4.3, 9.4, 12.1
   */
  test('computePot equals manual weighted sum for any chip counts and values', () => {
    fc.assert(
      fc.property(arbChips, arbChipValues, (chips, chipValues) => {
        const expected =
          chips.white * chipValues.white +
          chips.red   * chipValues.red   +
          chips.green * chipValues.green +
          chips.blue  * chipValues.blue;
        expect(computePot(chips, chipValues)).toBe(expected);
      }),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Rake computation is a percentage of the pot
// ---------------------------------------------------------------------------
// Feature: poker-app, Property 2: Rake computation is a percentage of the pot
describe('Property 2: Rake computation is a percentage of the pot', () => {
  /**
   * Validates: Requirements 4.9, 5.5, 12.4
   */
  test('computeRake equals pot * percent / 100 for any valid pot and rake percent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        arbRakePercent,
        (potNPR, rakePercent) => {
          const expected = potNPR * (rakePercent / 100);
          expect(computeRake(potNPR, rakePercent)).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Payout equals chip value minus rake owed
// ---------------------------------------------------------------------------
// Feature: poker-app, Property 3: Payout equals chip value minus rake owed
describe('Property 3: Payout equals chip value minus rake owed', () => {
  /**
   * Validates: Requirements 9.6
   */
  test('computePayout equals computePot minus rakeOwed for any inputs', () => {
    fc.assert(
      fc.property(
        arbChips,
        arbChipValues,
        fc.integer({ min: 0, max: 10_000 }),
        (chips, chipValues, rakeOwed) => {
          const expectedPot = computePot(chips, chipValues);
          expect(computePayout(chips, chipValues, rakeOwed)).toBe(expectedPot - rakeOwed);
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Player rake owed is the sum of rake from rounds won
// ---------------------------------------------------------------------------
// Feature: poker-app, Property 4: Player rake owed is the sum of rake from rounds won
describe('Property 4: Player rake owed is the sum of rake from rounds won', () => {
  /**
   * Validates: Requirements 9.5, 12.3
   */

  /** A pool of player names to use as winners */
  const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  const arbPlayerName = fc.constantFrom(...playerNames);

  /** A single round record */
  const arbRound = fc.record({
    winnerName: arbPlayerName,
    rakeNPR:    fc.integer({ min: 0, max: 10_000 }),
  });

  test('computePlayerRakeOwed equals filtered sum of rakeNPR for matching player', () => {
    fc.assert(
      fc.property(
        fc.array(arbRound, { minLength: 0, maxLength: 20 }),
        arbPlayerName,
        (rounds, playerName) => {
          const expected = rounds
            .filter(r => r.winnerName === playerName)
            .reduce((sum, r) => sum + r.rakeNPR, 0);
          expect(computePlayerRakeOwed(rounds, playerName)).toBe(expected);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('returns 0 when player has no winning rounds', () => {
    fc.assert(
      fc.property(
        fc.array(arbRound, { minLength: 0, maxLength: 20 }),
        (rounds) => {
          // 'Zara' is never in the winner pool, so result must always be 0
          expect(computePlayerRakeOwed(rounds, 'Zara')).toBe(0);
        }
      ),
      { numRuns: 25 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Total rake is the sum of all round rake amounts
// ---------------------------------------------------------------------------
// Feature: poker-app, Property 5: Total rake is the sum of all round rake amounts
describe('Property 5: Total rake is the sum of all round rake amounts', () => {
  /**
   * Validates: Requirements 3.3, 9.8, 12.1
   */

  const arbRound = fc.record({
    winnerName: fc.string({ minLength: 1, maxLength: 20 }),
    rakeNPR:    fc.integer({ min: 0, max: 10_000 }),
  });

  test('computeTotalRake equals sum of all rakeNPR values including empty list', () => {
    fc.assert(
      fc.property(
        fc.array(arbRound, { minLength: 0, maxLength: 20 }),
        (rounds) => {
          const expected = rounds.reduce((sum, r) => sum + r.rakeNPR, 0);
          expect(computeTotalRake(rounds)).toBe(expected);
        }
      ),
      { numRuns: 25 }
    );
  });

  test('returns 0 for an empty round list', () => {
    expect(computeTotalRake([])).toBe(0);
  });
});
