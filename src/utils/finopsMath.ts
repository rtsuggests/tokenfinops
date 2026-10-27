import type {
  LLMModel,
  InputUnit,
  FinOpsInputs,
  ModelCostBreakdown,
  FinOpsComparisonResult,
} from '../types';

/**
 * Convert user input values (Words, Characters, PDF pages) to LLM tokens.
 */
export function convertToTokens(value: number, unit: InputUnit): number {
  if (value <= 0 || isNaN(value)) return 0;
  switch (unit) {
    case 'tokens':
      return Math.round(value);
    case 'words':
      return Math.ceil(value * 1.33);
    case 'chars':
      return Math.ceil(value / 4);
    case 'pdf-text':
      return Math.ceil(value * 650);
    case 'pdf-ocr':
      return Math.ceil(value * 1200);
    default:
      return Math.round(value);
  }
}

/**
 * Format currency with appropriate precision (2 decimals or micro-cents for tiny values).
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '$0.00';
  if (amount === 0) return '$0.00';
  if (amount >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  if (amount >= 1) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  if (amount >= 0.01) {
    return `$${amount.toFixed(3)}`;
  }
  return `$${amount.toFixed(4)}`;
}

/**
 * Format large token counts (e.g., 1.5M, 250K).
 */
export function formatTokenCount(tokens: number): string {
  if (isNaN(tokens) || tokens === 0) return '0';
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(2)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toLocaleString();
}

/**
 * Calculate multi-turn compounding tokens per session.
 * Formula:
 * Session Input Tokens = (N * S) + sum_{i=1}^N (i * U + (i - 1) * O)
 * Peak Context Tokens = S + (N * U) + ((N - 1) * O)
 * Session Output Tokens = N * O
 */
export function calculateSessionTokens(
  turns: number,
  systemTokens: number,
  userInputTokens: number,
  outputTokens: number
): {
  sessionInputTokens: number;
  sessionOutputTokens: number;
  peakContextTokens: number;
} {
  const N = Math.max(1, Math.round(turns));
  const S = Math.max(0, systemTokens);
  const U = Math.max(0, userInputTokens);
  const O = Math.max(0, outputTokens);

  // sum_{i=1}^N i = N * (N + 1) / 2
  const sumI = (N * (N + 1)) / 2;
  // sum_{i=1}^N (i - 1) = N * (N - 1) / 2
  const sumIMinus1 = (N * (N - 1)) / 2;

  const sessionInputTokens = N * S + sumI * U + sumIMinus1 * O;
  const peakContextTokens = S + N * U + (N - 1) * O;
  const sessionOutputTokens = N * O;

  return {
    sessionInputTokens,
    sessionOutputTokens,
    peakContextTokens,
  };
}

/**
 * Pure calculation for a single model given workload inputs.
 */
export function calculateModelFinOps(
  model: LLMModel,
  inputs: FinOpsInputs,
  modelsMap?: Map<string, LLMModel>
): ModelCostBreakdown {
  const S = convertToTokens(inputs.systemPromptRaw, inputs.unit);
  const U = convertToTokens(inputs.userInputRaw, inputs.unit);
  const O = convertToTokens(inputs.modelOutputRaw, inputs.unit);

  const { sessionInputTokens, sessionOutputTokens, peakContextTokens } =
    calculateSessionTokens(inputs.turnsPerSession, S, U, O);

  const isCliffTriggered = Boolean(
    model.cliffThreshold !== null && peakContextTokens > model.cliffThreshold
  );
  const isContextExceeded = peakContextTokens > model.contextWindow;

  // Monthly scaling (30 days billing period)
  const monthlySessions = Math.max(0, inputs.dailyRequests) * 30;
  const monthlyInputTokens = sessionInputTokens * monthlySessions;
  const monthlyOutputTokens = sessionOutputTokens * monthlySessions;
  const monthlyTotalTokens = monthlyInputTokens + monthlyOutputTokens;

  // Prompt Caching Split
  const cacheHitRatio = Math.min(95, Math.max(0, inputs.cacheHitPercent)) / 100;
  const monthlyCachedInputTokens = monthlyInputTokens * cacheHitRatio;
  const monthlyFreshInputTokens = monthlyInputTokens - monthlyCachedInputTokens;

  // Rate determination
  const effectiveInputRatePer1M =
    isCliffTriggered && model.longContextInputRatePer1M !== null
      ? model.longContextInputRatePer1M
      : model.inputRatePer1M;

  const effectiveOutputRatePer1M =
    isCliffTriggered && model.longContextOutputRatePer1M !== null
      ? model.longContextOutputRatePer1M
      : model.outputRatePer1M;

  // Input costs
  const monthlyFreshInputCostBeforeBatch =
    (monthlyFreshInputTokens / 1_000_000) * effectiveInputRatePer1M;
  const monthlyCachedInputCostBeforeBatch =
    (monthlyCachedInputTokens / 1_000_000) * model.cachedInputRatePer1M;
  const monthlyTotalInputCostBeforeBatch =
    monthlyFreshInputCostBeforeBatch + monthlyCachedInputCostBeforeBatch;

  // Output cost
  const monthlyOutputCostBeforeBatch =
    (monthlyOutputTokens / 1_000_000) * effectiveOutputRatePer1M;

  // Batch multiplier
  const batchMultiplier = inputs.isBatchMode ? model.batchDiscountMultiplier : 1.0;

  const monthlyFreshInputCost = monthlyFreshInputCostBeforeBatch * batchMultiplier;
  const monthlyCachedInputCost = monthlyCachedInputCostBeforeBatch * batchMultiplier;
  const monthlyTotalInputCost = monthlyTotalInputCostBeforeBatch * batchMultiplier;
  const monthlyOutputCost = monthlyOutputCostBeforeBatch * batchMultiplier;
  const monthlyTotalCost = monthlyTotalInputCost + monthlyOutputCost;

  // Cliff penalty calculation (delta compared to standard rates)
  let cliffPenaltyMonthly = 0;
  if (isCliffTriggered) {
    const costWithoutCliffFresh =
      (monthlyFreshInputTokens / 1_000_000) * model.inputRatePer1M * batchMultiplier;
    const costWithoutCliffOutput =
      (monthlyOutputTokens / 1_000_000) * model.outputRatePer1M * batchMultiplier;
    const costWithoutCliff =
      costWithoutCliffFresh +
      monthlyCachedInputCost +
      costWithoutCliffOutput;
    cliffPenaltyMonthly = Math.max(0, monthlyTotalCost - costWithoutCliff);
  }

  // Cost per 1,000 requests and per session
  const costPerSession = monthlySessions > 0 ? monthlyTotalCost / monthlySessions : 0;
  const costPer1kRequests = costPerSession * 1000;
  const annualRunRate = monthlyTotalCost * 12;

  // Share percentages
  const totalCostDivisor = monthlyTotalCost > 0 ? monthlyTotalCost : 1;
  const freshInputSharePercent = (monthlyFreshInputCost / totalCostDivisor) * 100;
  const cachedInputSharePercent = (monthlyCachedInputCost / totalCostDivisor) * 100;
  const outputSharePercent = (monthlyOutputCost / totalCostDivisor) * 100;

  // Smart Routing Calculation
  let smartRouting: ModelCostBreakdown['smartRouting'];
  if (modelsMap && model.recommendedCheapAlternativeId) {
    const cheapModel = modelsMap.get(model.recommendedCheapAlternativeId);
    if (cheapModel && cheapModel.id !== model.id) {
      const cheapBreakdown = calculateModelFinOps(cheapModel, inputs);
      const routingRatio = (inputs.routingRatioPercent ?? 70) / 100;
      const routedMonthlyCost =
        (1 - routingRatio) * monthlyTotalCost + routingRatio * cheapBreakdown.monthlyTotalCost;
      const monthlySavings = Math.max(0, monthlyTotalCost - routedMonthlyCost);
      const annualSavings = monthlySavings * 12;
      const savingsPercent =
        monthlyTotalCost > 0 ? (monthlySavings / monthlyTotalCost) * 100 : 0;

      smartRouting = {
        cheapModel,
        routedMonthlyCost,
        monthlySavings,
        annualSavings,
        savingsPercent,
        routingPercent: inputs.routingRatioPercent ?? 70,
      };
    }
  }

  return {
    model,
    sessionInputTokens,
    sessionOutputTokens,
    peakContextTokens,
    isCliffTriggered,
    isContextExceeded,
    cliffPenaltyMonthly,
    monthlyInputTokens,
    monthlyOutputTokens,
    monthlyFreshInputTokens,
    monthlyCachedInputTokens,
    monthlyTotalTokens,
    effectiveInputRatePer1M,
    effectiveOutputRatePer1M,
    monthlyFreshInputCost,
    monthlyCachedInputCost,
    monthlyTotalInputCost,
    monthlyOutputCost,
    monthlyTotalCost,
    costPer1kRequests,
    costPerSession,
    annualRunRate,
    freshInputSharePercent,
    cachedInputSharePercent,
    outputSharePercent,
    smartRouting,
  };
}

/**
 * Compare two models side by side.
 */
export function compareModelsFinOps(
  primaryModel: LLMModel,
  comparisonModel: LLMModel | undefined,
  inputs: FinOpsInputs,
  modelsMap?: Map<string, LLMModel>
): FinOpsComparisonResult {
  const primary = calculateModelFinOps(primaryModel, inputs, modelsMap);

  if (!comparisonModel) {
    return {
      primary,
      monthlyDelta: 0,
      annualDelta: 0,
      percentCheaper: 0,
    };
  }

  const comparison = calculateModelFinOps(comparisonModel, inputs, modelsMap);
  const monthlyDelta = primary.monthlyTotalCost - comparison.monthlyTotalCost;
  const annualDelta = monthlyDelta * 12;

  let percentCheaper = 0;
  let cheaperModelId: string | undefined;

  if (primary.monthlyTotalCost > comparison.monthlyTotalCost) {
    cheaperModelId = comparison.model.id;
    percentCheaper =
      primary.monthlyTotalCost > 0
        ? ((primary.monthlyTotalCost - comparison.monthlyTotalCost) /
            primary.monthlyTotalCost) *
          100
        : 0;
  } else if (comparison.monthlyTotalCost > primary.monthlyTotalCost) {
    cheaperModelId = primary.model.id;
    percentCheaper =
      comparison.monthlyTotalCost > 0
        ? ((comparison.monthlyTotalCost - primary.monthlyTotalCost) /
            comparison.monthlyTotalCost) *
          100
        : 0;
  }

  return {
    primary,
    comparison,
    monthlyDelta,
    annualDelta,
    percentCheaper,
    cheaperModelId,
  };
}

/**
 * Generate CSV string for export.
 */
export function generateFinOpsCsv(
  primary: ModelCostBreakdown,
  comparison?: ModelCostBreakdown,
  inputs?: FinOpsInputs
): string {
  const rows = [
    ['TokenFinOps - B2B AI Token Cost & FinOps Report'],
    ['Generated At', new Date().toISOString()],
    [''],
    ['--- INPUT PARAMETERS ---'],
    ['Daily Requests / Sessions', inputs?.dailyRequests ?? 'N/A'],
    ['Turns per Session', inputs?.turnsPerSession ?? 'N/A'],
    ['Cache Hit Rate (%)', `${inputs?.cacheHitPercent ?? 0}%`],
    ['Batch Mode Enabled (24h SLA)', inputs?.isBatchMode ? 'YES' : 'NO'],
    ['Input Unit', inputs?.unit ?? 'tokens'],
    [''],
    ['--- MODEL COMPARISON SUMMARY ---'],
    [
      'Metric',
      `Primary: ${primary.model.name}`,
      comparison ? `Comparison: ${comparison.model.name}` : 'N/A',
      'Difference (Delta)',
    ],
    [
      'Monthly Total Cost ($)',
      primary.monthlyTotalCost.toFixed(2),
      comparison ? comparison.monthlyTotalCost.toFixed(2) : '-',
      comparison
        ? (primary.monthlyTotalCost - comparison.monthlyTotalCost).toFixed(2)
        : '-',
    ],
    [
      'Annual Run Rate ($)',
      primary.annualRunRate.toFixed(2),
      comparison ? comparison.annualRunRate.toFixed(2) : '-',
      comparison
        ? (primary.annualRunRate - comparison.annualRunRate).toFixed(2)
        : '-',
    ],
    [
      'Cost per 1,000 Requests ($)',
      primary.costPer1kRequests.toFixed(4),
      comparison ? comparison.costPer1kRequests.toFixed(4) : '-',
      comparison
        ? (primary.costPer1kRequests - comparison.costPer1kRequests).toFixed(4)
        : '-',
    ],
    [
      'Peak Context Length (Tokens)',
      primary.peakContextTokens.toString(),
      comparison ? comparison.peakContextTokens.toString() : '-',
      '-',
    ],
    [
      'Context Cliff Surcharge Triggered',
      primary.isCliffTriggered ? 'YES' : 'NO',
      comparison ? (comparison.isCliffTriggered ? 'YES' : 'NO') : '-',
      '-',
    ],
    [
      'Monthly Cliff Surcharge Penalty ($)',
      primary.cliffPenaltyMonthly.toFixed(2),
      comparison ? comparison.cliffPenaltyMonthly.toFixed(2) : '-',
      '-',
    ],
    [
      'Monthly Fresh Input Tokens',
      Math.round(primary.monthlyFreshInputTokens).toString(),
      comparison ? Math.round(comparison.monthlyFreshInputTokens).toString() : '-',
      '-',
    ],
    [
      'Monthly Cached Input Tokens',
      Math.round(primary.monthlyCachedInputTokens).toString(),
      comparison ? Math.round(comparison.monthlyCachedInputTokens).toString() : '-',
      '-',
    ],
    [
      'Monthly Output Tokens',
      Math.round(primary.monthlyOutputTokens).toString(),
      comparison ? Math.round(comparison.monthlyOutputTokens).toString() : '-',
      '-',
    ],
    [
      'Monthly Input Cost ($)',
      primary.monthlyTotalInputCost.toFixed(2),
      comparison ? comparison.monthlyTotalInputCost.toFixed(2) : '-',
      '-',
    ],
    [
      'Monthly Output Cost ($)',
      primary.monthlyOutputCost.toFixed(2),
      comparison ? comparison.monthlyOutputCost.toFixed(2) : '-',
      '-',
    ],
  ];

  if (primary.smartRouting) {
    rows.push(['']);
    rows.push(['--- SMART MODEL ROUTING RECOMMENDATION ---']);
    rows.push(['Recommended Cheap Alternative', primary.smartRouting.cheapModel.name]);
    rows.push(['Traffic Routed to Cheap Model', `${primary.smartRouting.routingPercent}%`]);
    rows.push(['Blended Monthly Cost ($)', primary.smartRouting.routedMonthlyCost.toFixed(2)]);
    rows.push(['Monthly Savings ($)', primary.smartRouting.monthlySavings.toFixed(2)]);
    rows.push(['Annualized Savings ($)', primary.smartRouting.annualSavings.toFixed(2)]);
    rows.push(['Cost Reduction (%)', `${primary.smartRouting.savingsPercent.toFixed(1)}%`]);
  }

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const stringCell = String(cell);
          if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
            return `"${stringCell.replace(/"/g, '""')}"`;
          }
          return stringCell;
        })
        .join(',')
    )
    .join('\n');
}
