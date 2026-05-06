'use strict';

/**
 * Unit tests for game validation logic.
 * These tests do NOT require a database — they test the validateGameFields helper directly.
 * Requirements: 2.2, 2.5
 */

// Mock the Game and Round models so no DB connection is needed
jest.mock('../models/Game');
jest.mock('../models/Round');

const { validateGameFields, VALID_RAKE_PERCENTS } = require('./games');

describe('validateGameFields', () => {
  describe('game name validation', () => {
    test('rejects empty string name', () => {
      const errors = validateGameFields({ name: '', players: ['Alice', 'Bob'], rakePercent: 2 });
      expect(errors).toContain('Game name must be a non-empty string');
    });

    test('rejects whitespace-only name', () => {
      const errors = validateGameFields({ name: '   ', players: ['Alice', 'Bob'], rakePercent: 2 });
      expect(errors).toContain('Game name must be a non-empty string');
    });

    test('accepts valid name', () => {
      const errors = validateGameFields({ name: 'Friday Night Poker', players: ['Alice', 'Bob'], rakePercent: 2 });
      expect(errors).toHaveLength(0);
    });
  });

  describe('players validation', () => {
    test('rejects fewer than 2 players — empty array', () => {
      const errors = validateGameFields({ name: 'Game', players: [], rakePercent: 2 });
      expect(errors).toContain('At least 2 players required');
    });

    test('rejects fewer than 2 players — single player', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice'], rakePercent: 2 });
      expect(errors).toContain('At least 2 players required');
    });

    test('rejects non-array players', () => {
      const errors = validateGameFields({ name: 'Game', players: 'Alice', rakePercent: 2 });
      expect(errors).toContain('At least 2 players required');
    });

    test('accepts exactly 2 players', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob'], rakePercent: 2 });
      expect(errors).toHaveLength(0);
    });

    test('accepts more than 2 players', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob', 'Charlie'], rakePercent: 2 });
      expect(errors).toHaveLength(0);
    });

    test('rejects empty string player name', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', ''], rakePercent: 2 });
      expect(errors.some((e) => e.includes('index 1'))).toBe(true);
    });

    test('rejects whitespace-only player name', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', '   '], rakePercent: 2 });
      expect(errors.some((e) => e.includes('index 1'))).toBe(true);
    });

    test('rejects multiple whitespace-only player names', () => {
      const errors = validateGameFields({ name: 'Game', players: [' ', '\t', 'Bob'], rakePercent: 2 });
      expect(errors.some((e) => e.includes('index 0'))).toBe(true);
      expect(errors.some((e) => e.includes('index 1'))).toBe(true);
    });

    test('rejects tab-only player name', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', '\t'], rakePercent: 2 });
      expect(errors.some((e) => e.includes('index 1'))).toBe(true);
    });

    test('rejects newline-only player name', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', '\n'], rakePercent: 2 });
      expect(errors.some((e) => e.includes('index 1'))).toBe(true);
    });
  });

  describe('rakePercent validation', () => {
    test.each(VALID_RAKE_PERCENTS)('accepts valid rake percent %s', (rakePercent) => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob'], rakePercent });
      expect(errors).toHaveLength(0);
    });

    test('rejects rake percent 0', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob'], rakePercent: 0 });
      expect(errors.some((e) => e.includes('rakePercent'))).toBe(true);
    });

    test('rejects rake percent 4', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob'], rakePercent: 4 });
      expect(errors.some((e) => e.includes('rakePercent'))).toBe(true);
    });

    test('rejects rake percent 10', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob'], rakePercent: 10 });
      expect(errors.some((e) => e.includes('rakePercent'))).toBe(true);
    });

    test('rejects string rake percent', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob'], rakePercent: '2' });
      expect(errors.some((e) => e.includes('rakePercent'))).toBe(true);
    });
  });

  describe('multiple validation errors', () => {
    test('returns multiple errors when multiple fields are invalid', () => {
      const errors = validateGameFields({ name: '', players: ['Alice'], rakePercent: 99 });
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('partial validation (undefined fields are skipped)', () => {
    test('skips name validation when name is undefined', () => {
      const errors = validateGameFields({ players: ['Alice', 'Bob'], rakePercent: 2 });
      expect(errors.every((e) => !e.includes('name'))).toBe(true);
    });

    test('skips players validation when players is undefined', () => {
      const errors = validateGameFields({ name: 'Game', rakePercent: 2 });
      expect(errors.every((e) => !e.includes('player'))).toBe(true);
    });

    test('skips rakePercent validation when rakePercent is undefined', () => {
      const errors = validateGameFields({ name: 'Game', players: ['Alice', 'Bob'] });
      expect(errors.every((e) => !e.includes('rakePercent'))).toBe(true);
    });
  });
});
