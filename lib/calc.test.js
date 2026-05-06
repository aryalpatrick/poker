'use strict';

const {
  computePot,
  computeRake,
  computePayout,
  computePlayerRakeOwed,
  computeTotalRake,
} = require('./calc');

// ---------------------------------------------------------------------------
// computePot
// ---------------------------------------------------------------------------
describe('computePot', () => {
  const defaultValues = { white: 5, red: 25, green: 50, blue: 125 };

  test('returns 0 when all chip counts are zero', () => {
    expect(computePot({ white: 0, red: 0, green: 0, blue: 0 }, defaultValues)).toBe(0);
  });

  test('computes pot for a single white chip', () => {
    expect(computePot({ white: 1, red: 0, green: 0, blue: 0 }, defaultValues)).toBe(5);
  });

  test('computes pot for a single red chip', () => {
    expect(computePot({ white: 0, red: 1, green: 0, blue: 0 }, defaultValues)).toBe(25);
  });

  test('computes pot for a single green chip', () => {
    expect(computePot({ white: 0, red: 0, green: 1, blue: 0 }, defaultValues)).toBe(50);
  });

  test('computes pot for a single blue chip', () => {
    expect(computePot({ white: 0, red: 0, green: 0, blue: 1 }, defaultValues)).toBe(125);
  });

  test('computes pot for all four chip colors combined', () => {
    // 2*5 + 3*25 + 1*50 + 4*125 = 10 + 75 + 50 + 500 = 635
    expect(computePot({ white: 2, red: 3, green: 1, blue: 4 }, defaultValues)).toBe(635);
  });

  test('computes pot with large chip counts', () => {
    // 100*5 + 100*25 + 100*50 + 100*125 = 500 + 2500 + 5000 + 12500 = 20500
    expect(computePot({ white: 100, red: 100, green: 100, blue: 100 }, defaultValues)).toBe(20500);
  });

  test('computes pot with custom chip values', () => {
    const customValues = { white: 10, red: 50, green: 100, blue: 500 };
    // 1*10 + 2*50 + 3*100 + 4*500 = 10 + 100 + 300 + 2000 = 2410
    expect(computePot({ white: 1, red: 2, green: 3, blue: 4 }, customValues)).toBe(2410);
  });
});

// ---------------------------------------------------------------------------
// computeRake
// ---------------------------------------------------------------------------
describe('computeRake', () => {
  test('returns 0 for a zero pot regardless of rake percent', () => {
    expect(computeRake(0, 1)).toBe(0);
    expect(computeRake(0, 5)).toBe(0);
  });

  test('computes rake at 1%', () => {
    expect(computeRake(1000, 1)).toBe(10);
  });

  test('computes rake at 2%', () => {
    expect(computeRake(1000, 2)).toBe(20);
  });

  test('computes rake at 2.5%', () => {
    expect(computeRake(1000, 2.5)).toBe(25);
  });

  test('computes rake at 3%', () => {
    expect(computeRake(1000, 3)).toBe(30);
  });

  test('computes rake at 5%', () => {
    expect(computeRake(1000, 5)).toBe(50);
  });

  test('computes rake for a large pot', () => {
    // 50000 * 2.5 / 100 = 1250
    expect(computeRake(50000, 2.5)).toBe(1250);
  });
});

// ---------------------------------------------------------------------------
// computePayout
// ---------------------------------------------------------------------------
describe('computePayout', () => {
  const chipValues = { white: 5, red: 25, green: 50, blue: 125 };

  test('payout equals chip value minus rake owed', () => {
    // pot = 1*5 + 0 + 0 + 0 = 5; rake = 2; payout = 3
    expect(computePayout({ white: 1, red: 0, green: 0, blue: 0 }, chipValues, 2)).toBe(3);
  });

  test('payout equals chip value when rake owed is zero', () => {
    // pot = 2*5 + 1*25 = 35; rake = 0; payout = 35
    expect(computePayout({ white: 2, red: 1, green: 0, blue: 0 }, chipValues, 0)).toBe(35);
  });

  test('payout can be negative when rake exceeds chip value', () => {
    // pot = 0; rake = 100; payout = -100
    expect(computePayout({ white: 0, red: 0, green: 0, blue: 0 }, chipValues, 100)).toBe(-100);
  });

  test('payout for a realistic cashout scenario', () => {
    // pot = 4*5 + 2*25 + 1*50 + 1*125 = 20 + 50 + 50 + 125 = 245; rake = 12.25; payout = 232.75
    expect(computePayout({ white: 4, red: 2, green: 1, blue: 1 }, chipValues, 12.25)).toBeCloseTo(232.75);
  });
});

// ---------------------------------------------------------------------------
// computePlayerRakeOwed
// ---------------------------------------------------------------------------
describe('computePlayerRakeOwed', () => {
  test('returns 0 for an empty rounds array', () => {
    expect(computePlayerRakeOwed([], 'Alice')).toBe(0);
  });

  test('returns 0 when player has no winning rounds', () => {
    const rounds = [
      { winnerName: 'Bob', rakeNPR: 50 },
      { winnerName: 'Charlie', rakeNPR: 75 },
    ];
    expect(computePlayerRakeOwed(rounds, 'Alice')).toBe(0);
  });

  test('returns rake for a single winning round', () => {
    const rounds = [{ winnerName: 'Alice', rakeNPR: 100 }];
    expect(computePlayerRakeOwed(rounds, 'Alice')).toBe(100);
  });

  test('sums rake across multiple winning rounds', () => {
    const rounds = [
      { winnerName: 'Alice', rakeNPR: 100 },
      { winnerName: 'Bob',   rakeNPR: 50  },
      { winnerName: 'Alice', rakeNPR: 200 },
      { winnerName: 'Alice', rakeNPR: 75  },
    ];
    expect(computePlayerRakeOwed(rounds, 'Alice')).toBe(375);
  });

  test('is case-sensitive for player names', () => {
    const rounds = [{ winnerName: 'alice', rakeNPR: 100 }];
    expect(computePlayerRakeOwed(rounds, 'Alice')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeTotalRake
// ---------------------------------------------------------------------------
describe('computeTotalRake', () => {
  test('returns 0 for an empty rounds array', () => {
    expect(computeTotalRake([])).toBe(0);
  });

  test('returns rake for a single round', () => {
    expect(computeTotalRake([{ rakeNPR: 150 }])).toBe(150);
  });

  test('sums rake across multiple rounds', () => {
    const rounds = [
      { winnerName: 'Alice', rakeNPR: 100 },
      { winnerName: 'Bob',   rakeNPR: 50  },
      { winnerName: 'Alice', rakeNPR: 200 },
    ];
    expect(computeTotalRake(rounds)).toBe(350);
  });

  test('handles rounds with zero rake', () => {
    const rounds = [
      { rakeNPR: 0   },
      { rakeNPR: 100 },
      { rakeNPR: 0   },
    ];
    expect(computeTotalRake(rounds)).toBe(100);
  });
});
