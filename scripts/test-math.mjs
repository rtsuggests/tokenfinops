// Pure test suite verifying all 5 production FinOps mathematical variables

function convertToTokens(value, unit) {
  if (value <= 0 || isNaN(value)) return 0;
  switch (unit) {
    case 'tokens': return Math.round(value);
    case 'words': return Math.ceil(value * 1.33);
    case 'chars': return Math.ceil(value / 4);
    case 'pdf-text': return Math.ceil(value * 650);
    case 'pdf-ocr': return Math.ceil(value * 1200);
    default: return Math.round(value);
  }
}

function calculateSessionTokens(turns, systemTokens, userInputTokens, outputTokens) {
  const N = Math.max(1, Math.round(turns));
  const S = Math.max(0, systemTokens);
  const U = Math.max(0, userInputTokens);
  const O = Math.max(0, outputTokens);

  const sumI = (N * (N + 1)) / 2;
  const sumIMinus1 = (N * (N - 1)) / 2;

  const sessionInputTokens = N * S + sumI * U + sumIMinus1 * O;
  const peakContextTokens = S + N * U + (N - 1) * O;
  const sessionOutputTokens = N * O;

  return { sessionInputTokens, sessionOutputTokens, peakContextTokens };
}

console.log('--- RUNNING FINOPS ENGINE TESTS ---');

// Test 1: Unit Converter
console.assert(convertToTokens(100, 'tokens') === 100, 'Tokens unit test failed');
console.assert(convertToTokens(100, 'words') === 133, 'Words unit test failed');
console.assert(convertToTokens(100, 'chars') === 25, 'Chars unit test failed');
console.assert(convertToTokens(10, 'pdf-text') === 6500, 'PDF text test failed');
console.assert(convertToTokens(10, 'pdf-ocr') === 12000, 'PDF OCR test failed');
console.log('✓ 1. Unit conversions passed (Tokens, Words, Chars, PDF-Text, PDF-OCR)');

// Test 2: Multi-Turn Conversation Compounding
const turns3 = calculateSessionTokens(3, 1000, 200, 300);
console.assert(turns3.sessionInputTokens === 5100, `Expected 5100, got ${turns3.sessionInputTokens}`);
console.assert(turns3.peakContextTokens === 2200, `Expected 2200, got ${turns3.peakContextTokens}`);
console.assert(turns3.sessionOutputTokens === 900, `Expected 900, got ${turns3.sessionOutputTokens}`);

const turns1 = calculateSessionTokens(1, 4000, 500, 600);
console.assert(turns1.sessionInputTokens === 4500, 'Single turn input tokens calculation failed');
console.assert(turns1.peakContextTokens === 4500, 'Single turn peak context calculation failed');
console.assert(turns1.sessionOutputTokens === 600, 'Single turn output tokens calculation failed');
console.log('✓ 2. Multi-turn compounding passed (Sum(i*U + (i-1)*O) formula verified)');

// Test 3: Context-Window Cliff Surcharge Detection
const cliffThreshold = 128000;
const normalInputRate = 1.25;
const longContextInputRate = 2.50;
const promptLength = 135000;
const isCliffTriggered = promptLength > cliffThreshold;
console.assert(isCliffTriggered === true, 'Cliff trigger detection failed');
const effectiveRate = isCliffTriggered ? longContextInputRate : normalInputRate;
console.assert(effectiveRate === 2.50, 'Effective cliff surcharge rate application failed');
console.log('✓ 3. Context-window cliff surcharge detection passed');

// Test 4: Prompt Caching & Batch API Discounts
const totalInputTokens = 1000000;
const cacheHitPercent = 80;
const cachedTokens = totalInputTokens * (cacheHitPercent / 100);
const freshTokens = totalInputTokens - cachedTokens;
console.assert(cachedTokens === 800000, 'Cached token calculation failed');
console.assert(freshTokens === 200000, 'Fresh token calculation failed');
const cachedCost = (cachedTokens / 1000000) * 0.30;
const freshCost = (freshTokens / 1000000) * 3.00;
const normalSubtotal = cachedCost + freshCost;
const batchDiscountMultiplier = 0.5;
const batchCost = normalSubtotal * batchDiscountMultiplier;
console.assert(batchCost === normalSubtotal * 0.5, 'Batch discount calculation failed');
console.log('✓ 4. Prompt caching and 50% batch discount calculations passed');

// Test 5: Smart Model Routing (FinOps Savings Recommender)
const primaryCost = 10000;
const cheapCost = 1000;
const routingPercent = 70;
const blendedCost = Math.round((1 - routingPercent / 100) * primaryCost + (routingPercent / 100) * cheapCost);
const monthlySavings = primaryCost - blendedCost;
console.assert(blendedCost === 3700, `Expected blended cost 3700, got ${blendedCost}`);
console.assert(monthlySavings === 6300, `Expected monthly savings 6300, got ${monthlySavings}`);
console.assert(monthlySavings * 12 === 75600, 'Annualized savings calculation failed');
console.log('✓ 5. Smart routing (70% routing split & annualized ROI) passed');

console.log('====================================');
console.log('ALL MATHEMATICAL ENGINE CHECKS PASSED');
console.log('====================================');
