// Feature: poker-app, Property 14: Responsive layout applies correct breakpoints

/**
 * Property 14: Responsive layout applies correct breakpoints
 *
 * Static analysis test — reads public/styles.css as text and verifies
 * that the correct breakpoint values are present in the CSS rules.
 *
 * Validates: Requirements 11.1, 11.2, 11.6
 */

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, '..', 'styles.css');

describe('Property 14: Responsive layout applies correct breakpoints', () => {
  let cssText;

  beforeAll(() => {
    cssText = fs.readFileSync(CSS_PATH, 'utf8');
  });

  // ----------------------------------------------------------------
  // Helper: extract the content of a specific @media block
  // ----------------------------------------------------------------
  function extractMediaBlock(css, mediaQuery) {
    // Find the @media rule that contains the given query string
    const idx = css.indexOf(mediaQuery);
    if (idx === -1) return null;

    // Walk forward to find the opening brace of the @media block
    let braceStart = css.indexOf('{', idx);
    if (braceStart === -1) return null;

    // Balance braces to find the end of the @media block
    let depth = 0;
    let i = braceStart;
    while (i < css.length) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }

    return css.slice(braceStart, i + 1);
  }

  // ----------------------------------------------------------------
  // Helper: extract the content of a CSS rule block for a selector
  // ----------------------------------------------------------------
  function extractRuleBlock(css, selector) {
    // Find the selector (trim whitespace around it)
    const pattern = new RegExp(
      selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{',
      'g'
    );
    const match = pattern.exec(css);
    if (!match) return null;

    const braceStart = match.index + match[0].length - 1;
    let depth = 0;
    let i = braceStart;
    while (i < css.length) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }

    return css.slice(braceStart + 1, i);
  }

  // ----------------------------------------------------------------
  // Helper: get the value of a CSS property from a rule block string
  // ----------------------------------------------------------------
  function getPropertyValue(ruleBlock, property) {
    const pattern = new RegExp(
      property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*([^;]+);'
    );
    const match = pattern.exec(ruleBlock);
    return match ? match[1].trim() : null;
  }

  // ----------------------------------------------------------------
  // Base styles: .app-container max-width 430px
  // ----------------------------------------------------------------
  describe('Base styles (mobile)', () => {
    test('.app-container has max-width: 430px in base styles', () => {
      // Extract the base (non-media-query) .app-container rule
      // We look for the rule outside any @media block by stripping media blocks first
      const withoutMedia = cssText.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
      const ruleBlock = extractRuleBlock(withoutMedia, '.app-container');

      expect(ruleBlock).not.toBeNull();
      const value = getPropertyValue(ruleBlock, 'max-width');
      expect(value).toBe('430px');
    });

    test('.chip-btn has min-width: 80px in base styles', () => {
      const withoutMedia = cssText.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
      const ruleBlock = extractRuleBlock(withoutMedia, '.chip-btn');

      expect(ruleBlock).not.toBeNull();
      const value = getPropertyValue(ruleBlock, 'min-width');
      expect(value).toBe('80px');
    });

    test('.chip-btn has min-height: 80px in base styles', () => {
      const withoutMedia = cssText.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
      const ruleBlock = extractRuleBlock(withoutMedia, '.chip-btn');

      expect(ruleBlock).not.toBeNull();
      const value = getPropertyValue(ruleBlock, 'min-height');
      expect(value).toBe('80px');
    });
  });

  // ----------------------------------------------------------------
  // Tablet media query: (min-width: 431px) and (max-width: 1024px)
  // ----------------------------------------------------------------
  describe('Tablet media query (min-width: 431px) and (max-width: 1024px)', () => {
    const TABLET_QUERY = '(min-width: 431px) and (max-width: 1024px)';

    test('tablet @media block exists in CSS', () => {
      const mediaBlock = extractMediaBlock(cssText, TABLET_QUERY);
      expect(mediaBlock).not.toBeNull();
    });

    test('.app-container has max-width: 768px inside tablet media query', () => {
      const mediaBlock = extractMediaBlock(cssText, TABLET_QUERY);
      expect(mediaBlock).not.toBeNull();

      const ruleBlock = extractRuleBlock(mediaBlock, '.app-container');
      expect(ruleBlock).not.toBeNull();

      const value = getPropertyValue(ruleBlock, 'max-width');
      expect(value).toBe('768px');
    });

    test('.chip-btn has min-width: 100px inside tablet media query', () => {
      const mediaBlock = extractMediaBlock(cssText, TABLET_QUERY);
      expect(mediaBlock).not.toBeNull();

      const ruleBlock = extractRuleBlock(mediaBlock, '.chip-btn');
      expect(ruleBlock).not.toBeNull();

      const value = getPropertyValue(ruleBlock, 'min-width');
      expect(value).toBe('100px');
    });

    test('.chip-btn has min-height: 100px inside tablet media query', () => {
      const mediaBlock = extractMediaBlock(cssText, TABLET_QUERY);
      expect(mediaBlock).not.toBeNull();

      const ruleBlock = extractRuleBlock(mediaBlock, '.chip-btn');
      expect(ruleBlock).not.toBeNull();

      const value = getPropertyValue(ruleBlock, 'min-height');
      expect(value).toBe('100px');
    });
  });
});
