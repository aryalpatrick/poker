// Feature: poker-app, Property 12: Undo removes exactly the last added chip
// Feature: poker-app, Property 13: Clear resets all chip counts to zero

/**
 * Property tests for public/lib/chipState.js
 *
 * Because chipState.js uses module-level mutable state, each test must
 * call clear() before use to start from a known empty state.
 */

const fc = require('fast-check');

// chipState.js exports via `if (typeof module !== 'undefined') module.exports = ...`
const { addChip, undo, clear, getCounts } = require('./chipState');

const COLORS = ['white', 'red', 'green', 'blue'];

/** Arbitrary that generates a non-empty array of chip colors */
const chipSequence = fc.array(fc.constantFrom(...COLORS), { minLength: 1, maxLength: 50 });

/** Arbitrary that generates a possibly-empty array of chip colors */
const chipSequenceOrEmpty = fc.array(fc.constantFrom(...COLORS), { minLength: 0, maxLength: 50 });

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Apply a sequence of chip additions to a fresh state and return the counts.
 * Leaves the module state populated (caller must clear() afterwards).
 */
function applySequence(sequence) {
  clear();
  sequence.forEach(color => addChip(color));
}

// ─── Property 12: Undo removes exactly the last added chip ────────────────────

/**
 * Property 12: Undo removes exactly the last added chip
 *
 * For any non-empty sequence of chip additions:
 *   - Record counts after the full sequence
 *   - Call undo()
 *   - The resulting counts must equal the counts after the sequence
 *     minus one chip of the last color added
 *
 * Validates: Requirements 4.5
 */
describe('Property 12: Undo removes exactly the last added chip', () => {
  test('undo restores chip counts to state before last addition', () => {
    fc.assert(
      fc.property(chipSequence, (sequence) => {
        // Build state up to the second-to-last chip
        const prefix = sequence.slice(0, -1);
        const lastColor = sequence[sequence.length - 1];

        // Get expected counts (state before last chip)
        applySequence(prefix);
        const expectedCounts = getCounts();

        // Add the last chip then undo
        addChip(lastColor);
        undo();
        const actualCounts = getCounts();

        // Clean up
        clear();

        // Counts after undo must match counts before the last chip was added
        expect(actualCounts).toEqual(expectedCounts);
      }),
      { numRuns: 50 }
    );
  });

  test('undo on empty history leaves all counts at zero', () => {
    clear();
    undo(); // should be a no-op
    expect(getCounts()).toEqual({ white: 0, red: 0, green: 0, blue: 0 });
    clear();
  });

  test('undo decrements exactly the last color added', () => {
    fc.assert(
      fc.property(
        chipSequence,
        fc.constantFrom(...COLORS),
        (prefix, lastColor) => {
          applySequence(prefix);
          const countsBefore = getCounts();

          addChip(lastColor);
          undo();
          const countsAfter = getCounts();

          clear();

          expect(countsAfter).toEqual(countsBefore);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 13: Clear resets all chip counts to zero ────────────────────────

/**
 * Property 13: Clear resets all chip counts to zero
 *
 * For any sequence of chip additions (including empty):
 *   - Apply the sequence
 *   - Call clear()
 *   - All four chip color counts must be zero
 *
 * Validates: Requirements 4.6
 */
describe('Property 13: Clear resets all chip counts to zero', () => {
  test('clear sets all chip counts to zero after any sequence', () => {
    fc.assert(
      fc.property(chipSequenceOrEmpty, (sequence) => {
        applySequence(sequence);
        clear();
        const counts = getCounts();

        expect(counts).toEqual({ white: 0, red: 0, green: 0, blue: 0 });
      }),
      { numRuns: 50 }
    );
  });

  test('clear on already-empty state returns all zeros', () => {
    clear();
    clear(); // double clear should be safe
    expect(getCounts()).toEqual({ white: 0, red: 0, green: 0, blue: 0 });
  });

  test('clear after mixed operations resets all colors', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...COLORS), { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 0, max: 10 }),
        (sequence, undoCount) => {
          applySequence(sequence);

          // Perform some undos (bounded by sequence length)
          const actualUndos = Math.min(undoCount, sequence.length);
          for (let i = 0; i < actualUndos; i++) {
            undo();
          }

          clear();
          const counts = getCounts();

          expect(counts).toEqual({ white: 0, red: 0, green: 0, blue: 0 });
        }
      ),
      { numRuns: 50 }
    );
  });
});
