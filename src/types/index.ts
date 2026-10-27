export type ModelTier = 'frontier' | 'mid' | 'budget' | 'reasoning';

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  tier: ModelTier;
  inputRatePer1M: number;
  outputRatePer1M: number;
  cachedInputRatePer1M: number;
  cacheWriteRatePer1M: number;
  batchDiscountMultiplier: number;
  contextWindow: number;
  cliffThreshold: number | null;
  longContextInputRatePer1M: number | null;
  longContextOutputRatePer1M: number | null;
  recommendedCheapAlternativeId: string;
}

export interface WorkloadPreset {
  slug: string;
  name: string;
  category: string;
  description: string;
  architecturalAdvice: string;
  defaultModelA: string;
  defaultModelB: string;
  dailyRequests: number;
  systemPromptTokens: number;
  userInputTokens: number;
  modelOutputTokens: number;
  turnsPerSession: number;
  cacheHitPercent: number;
  isBatchMode: boolean;
}

export type InputUnit = 'tokens' | 'words' | 'chars' | 'pdf-text' | 'pdf-ocr';

export interface FinOpsInputs {
  modelId: string;
  comparisonModelId?: string;
  dailyRequests: number;
  systemPromptRaw: number;
  userInputRaw: number;
  modelOutputRaw: number;
  unit: InputUnit;
  turnsPerSession: number;
  cacheHitPercent: number;
  isBatchMode: boolean;
  routingRatioPercent?: number; // default 70
}

export interface ModelCostBreakdown {
  model: LLMModel;
  // Per-session token metrics
  sessionInputTokens: number;
  sessionOutputTokens: number;
  peakContextTokens: number;
  isCliffTriggered: boolean;
  isContextExceeded: boolean;
  cliffPenaltyMonthly: number;
  
  // Total tokens (Monthly)
  monthlyInputTokens: number;
  monthlyOutputTokens: number;
  monthlyFreshInputTokens: number;
  monthlyCachedInputTokens: number;
  monthlyTotalTokens: number;
  
  // Rates applied
  effectiveInputRatePer1M: number;
  effectiveOutputRatePer1M: number;
  
  // Costs (Monthly)
  monthlyFreshInputCost: number;
  monthlyCachedInputCost: number;
  monthlyTotalInputCost: number;
  monthlyOutputCost: number;
  monthlyTotalCost: number;
  
  // Normalization KPIs
  costPer1kRequests: number;
  costPerSession: number;
  annualRunRate: number;
  
  // Cost breakdown percentages (for stacked bars)
  freshInputSharePercent: number;
  cachedInputSharePercent: number;
  outputSharePercent: number;
  
  // Smart routing vs cheap alternative
  smartRouting?: {
    cheapModel: LLMModel;
    routedMonthlyCost: number;
    monthlySavings: number;
    annualSavings: number;
    savingsPercent: number;
    routingPercent: number;
  };
}

export interface FinOpsComparisonResult {
  primary: ModelCostBreakdown;
  comparison?: ModelCostBreakdown;
  monthlyDelta: number; // primary - comparison
  annualDelta: number;
  percentCheaper: number;
  cheaperModelId?: string;
}
