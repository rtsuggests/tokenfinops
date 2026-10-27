import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { LLMModel, WorkloadPreset, InputUnit, FinOpsInputs } from '../types';
import {
  calculateModelFinOps,
  compareModelsFinOps,
  formatCurrency,
  formatTokenCount,
  generateFinOpsCsv,
} from '../utils/finopsMath';
import modelsDataRaw from '../data/models.json';
import workloadsDataRaw from '../data/workloads.json';
import {
  Share2,
  Download,
  AlertTriangle,
  TrendingDown,
  Layers,
  Zap,
  Check,
  Sparkles,
  Cpu,
  ShieldAlert,
} from 'lucide-react';

const allModels = modelsDataRaw as LLMModel[];
const allWorkloads = workloadsDataRaw as WorkloadPreset[];
const modelsMap = new Map<string, LLMModel>(allModels.map((m) => [m.id, m]));

export interface FinOpsCalculatorProps {
  initialModelA?: string;
  initialModelB?: string;
  initialWorkloadSlug?: string;
  initialDailyRequests?: number;
  initialSystemTokens?: number;
  initialUserTokens?: number;
  initialOutputTokens?: number;
  initialTurns?: number;
  initialCacheHit?: number;
  initialBatch?: boolean;
}

export default function FinOpsCalculator({
  initialModelA = 'claude-3-5-sonnet',
  initialModelB = 'gpt-4o',
  initialWorkloadSlug,
  initialDailyRequests,
  initialSystemTokens,
  initialUserTokens,
  initialOutputTokens,
  initialTurns,
  initialCacheHit,
  initialBatch,
}: FinOpsCalculatorProps) {
  // State management
  const [modelAId, setModelAId] = useState<string>(initialModelA);
  const [modelBId, setModelBId] = useState<string>(initialModelB);
  const [selectedWorkload, setSelectedWorkload] = useState<string>(initialWorkloadSlug || '');
  const [unit, setUnit] = useState<InputUnit>('tokens');

  const [dailyRequests, setDailyRequests] = useState<number>(initialDailyRequests ?? 25000);
  const [systemPromptRaw, setSystemPromptRaw] = useState<number>(initialSystemTokens ?? 4000);
  const [userInputRaw, setUserInputRaw] = useState<number>(initialUserTokens ?? 350);
  const [modelOutputRaw, setModelOutputRaw] = useState<number>(initialOutputTokens ?? 600);
  const [turnsPerSession, setTurnsPerSession] = useState<number>(initialTurns ?? 2);
  const [cacheHitPercent, setCacheHitPercent] = useState<number>(initialCacheHit ?? 60);
  const [isBatchMode, setIsBatchMode] = useState<boolean>(initialBatch ?? false);
  const [routingPercent, setRoutingPercent] = useState<number>(70);

  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Initialize from URL search params on client mount if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    const qModelA = params.get('modelA');
    if (qModelA && modelsMap.has(qModelA)) setModelAId(qModelA);

    const qModelB = params.get('modelB');
    if (qModelB && modelsMap.has(qModelB)) setModelBId(qModelB);

    const qDau = params.get('dau') || params.get('requests');
    if (qDau && !isNaN(Number(qDau))) setDailyRequests(Math.max(1, Number(qDau)));

    const qTurns = params.get('turns');
    if (qTurns && !isNaN(Number(qTurns))) setTurnsPerSession(Math.max(1, Number(qTurns)));

    const qCache = params.get('cache');
    if (qCache && !isNaN(Number(qCache))) setCacheHitPercent(Math.min(95, Math.max(0, Number(qCache))));

    const qBatch = params.get('batch');
    if (qBatch !== null) setIsBatchMode(qBatch === 'true' || qBatch === '1');

    const qSystem = params.get('system');
    if (qSystem && !isNaN(Number(qSystem))) setSystemPromptRaw(Number(qSystem));

    const qUser = params.get('user');
    if (qUser && !isNaN(Number(qUser))) setUserInputRaw(Number(qUser));

    const qOutput = params.get('output');
    if (qOutput && !isNaN(Number(qOutput))) setModelOutputRaw(Number(qOutput));

    const qWorkload = params.get('workload');
    if (qWorkload) setSelectedWorkload(qWorkload);
  }, []);

  // Sync state to URL without reloading
  const updateUrlParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('modelA', modelAId);
    url.searchParams.set('modelB', modelBId);
    url.searchParams.set('requests', dailyRequests.toString());
    url.searchParams.set('system', systemPromptRaw.toString());
    url.searchParams.set('user', userInputRaw.toString());
    url.searchParams.set('output', modelOutputRaw.toString());
    url.searchParams.set('turns', turnsPerSession.toString());
    url.searchParams.set('cache', cacheHitPercent.toString());
    url.searchParams.set('batch', isBatchMode ? 'true' : 'false');
    if (selectedWorkload) {
      url.searchParams.set('workload', selectedWorkload);
    } else {
      url.searchParams.delete('workload');
    }
    window.history.replaceState({}, '', url.toString());
  }, [
    modelAId,
    modelBId,
    dailyRequests,
    systemPromptRaw,
    userInputRaw,
    modelOutputRaw,
    turnsPerSession,
    cacheHitPercent,
    isBatchMode,
    selectedWorkload,
  ]);

  useEffect(() => {
    updateUrlParams();
  }, [updateUrlParams]);

  // Apply workload preset
  const handleSelectWorkload = (slug: string) => {
    setSelectedWorkload(slug);
    if (!slug) return;
    const preset = allWorkloads.find((w) => w.slug === slug);
    if (!preset) return;

    if (modelsMap.has(preset.defaultModelA)) setModelAId(preset.defaultModelA);
    if (modelsMap.has(preset.defaultModelB)) setModelBId(preset.defaultModelB);
    setDailyRequests(preset.dailyRequests);
    setSystemPromptRaw(preset.systemPromptTokens);
    setUserInputRaw(preset.userInputTokens);
    setModelOutputRaw(preset.modelOutputTokens);
    setTurnsPerSession(preset.turnsPerSession);
    setCacheHitPercent(preset.cacheHitPercent);
    setIsBatchMode(preset.isBatchMode);
    setUnit('tokens');
  };

  // Copy shareable link
  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Models lookup
  const modelA = modelsMap.get(modelAId) || allModels[0];
  const modelB = modelsMap.get(modelBId) || allModels[1];

  // Inputs bundle
  const finOpsInputs: FinOpsInputs = useMemo(
    () => ({
      modelId: modelAId,
      comparisonModelId: modelBId,
      dailyRequests,
      systemPromptRaw,
      userInputRaw,
      modelOutputRaw,
      unit,
      turnsPerSession,
      cacheHitPercent,
      isBatchMode,
      routingRatioPercent: routingPercent,
    }),
    [
      modelAId,
      modelBId,
      dailyRequests,
      systemPromptRaw,
      userInputRaw,
      modelOutputRaw,
      unit,
      turnsPerSession,
      cacheHitPercent,
      isBatchMode,
      routingPercent,
    ]
  );

  // Calculations
  const comparisonResult = useMemo(
    () => compareModelsFinOps(modelA, modelB, finOpsInputs, modelsMap),
    [modelA, modelB, finOpsInputs]
  );

  const { primary, comparison, monthlyDelta, annualDelta, percentCheaper, cheaperModelId } =
    comparisonResult;

  // CSV Export handler
  const handleExportCsv = () => {
    const csvContent = generateFinOpsCsv(primary, comparison, finOpsInputs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `tokenfinops-${primary.model.id}-vs-${comparison?.model.id || 'single'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="calculator" class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Bar: Workload Presets + Action Buttons */}
      <div class="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-lg">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Sparkles class="w-4 h-4 text-emerald-400" />
            <span>Preset Architecture:</span>
          </div>
          <select
            value={selectedWorkload}
            onChange={(e) => handleSelectWorkload(e.target.value)}
            class="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            aria-label="Select B2B Workload Preset"
          >
            <option value="">Custom Workload</option>
            {allWorkloads.map((w) => (
              <option key={w.slug} value={w.slug}>
                {w.name} ({w.category})
              </option>
            ))}
          </select>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            onClick={handleCopyLink}
            type="button"
            class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition"
            title="Copy shareable link with current configuration parameters"
          >
            {copiedLink ? (
              <>
                <Check class="w-3.5 h-3.5 text-emerald-400" />
                <span class="text-emerald-400 font-semibold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 class="w-3.5 h-3.5 text-slate-400" />
                <span>Share Slack/Jira Link</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCsv}
            type="button"
            class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-sm shadow-emerald-500/20"
            title="Download CSV breakdown for FinOps budget report"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Column Inputs vs Right Column FinOps Output */}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ============================================================ */}
        {/* LEFT COLUMN: FinOps Production Variables (5 cols on lg) */}
        {/* ============================================================ */}
        <div class="lg:col-span-5 space-y-6">
          <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-xl space-y-5">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Cpu class="w-4 h-4 text-emerald-400" />
                <span>Model Selection</span>
              </h2>
              <span class="text-[11px] font-mono text-slate-400">Side-by-Side</span>
            </div>

            {/* Model A Selector */}
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Primary Model (A)</span>
                <span class="text-[10px] font-mono text-emerald-400 uppercase">{modelA.tier}</span>
              </label>
              <select
                value={modelAId}
                onChange={(e) => setModelAId(e.target.value)}
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {allModels.map((m) => (
                  <option key={`a-${m.id}`} value={m.id}>
                    {m.name} ({m.provider}) - ${m.inputRatePer1M.toFixed(2)} in / ${m.outputRatePer1M.toFixed(2)} out
                  </option>
                ))}
              </select>
            </div>

            {/* Model B Selector */}
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Comparison Model (B)</span>
                <span class="text-[10px] font-mono text-cyan-400 uppercase">{modelB.tier}</span>
              </label>
              <select
                value={modelBId}
                onChange={(e) => setModelBId(e.target.value)}
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {allModels.map((m) => (
                  <option key={`b-${m.id}`} value={m.id}>
                    {m.name} ({m.provider}) - ${m.inputRatePer1M.toFixed(2)} in / ${m.outputRatePer1M.toFixed(2)} out
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Converter Switcher */}
            <div class="pt-2 border-t border-slate-800/80">
              <label class="block text-xs font-medium text-slate-300 mb-2">Input Sizing Unit</label>
              <div class="grid grid-cols-5 gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 text-center">
                {(
                  [
                    { id: 'tokens', label: 'Tokens' },
                    { id: 'words', label: 'Words' },
                    { id: 'chars', label: 'Chars' },
                    { id: 'pdf-text', label: 'PDF Text' },
                    { id: 'pdf-ocr', label: 'PDF OCR' },
                  ] as { id: InputUnit; label: string }[]
                ).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUnit(u.id)}
                    class={`py-1 text-[11px] font-medium rounded transition ${
                      unit === u.id
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              <p class="text-[10px] font-mono text-slate-500 mt-1.5">
                {unit === 'tokens' && '1 Token ≈ standard BPE tokenizer token'}
                {unit === 'words' && '1 Word ≈ 1.33 tokens'}
                {unit === 'chars' && '4 Characters ≈ 1 token'}
                {unit === 'pdf-text' && '1 Page ≈ 650 tokens (clean text)'}
                {unit === 'pdf-ocr' && '1 Page ≈ 1,200 tokens (OCR / Vision scan)'}
              </p>
            </div>
          </div>

          {/* Workload Inputs Sliders */}
          <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-xl space-y-5">
            <h2 class="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layers class="w-4 h-4 text-emerald-400" />
              <span>Volume & Architecture Sliders</span>
            </h2>

            {/* Daily Requests Slider */}
            <div>
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-medium text-slate-300">Daily Requests / Sessions</span>
                <span class="font-mono text-emerald-400 font-semibold">{dailyRequests.toLocaleString()} / day</span>
              </div>
              <input
                type="range"
                min="10"
                max="500000"
                step="500"
                value={dailyRequests}
                onChange={(e) => setDailyRequests(Number(e.target.value))}
                class="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
              <div class="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>10 req/day</span>
                <span>{(dailyRequests * 30).toLocaleString()} req/mo</span>
                <span>500k req/day</span>
              </div>
            </div>

            {/* System Prompt & RAG Context */}
            <div>
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-medium text-slate-300">System Prompt + RAG Context</span>
                <span class="font-mono text-slate-200 font-semibold">
                  {systemPromptRaw.toLocaleString()} {unit}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100000"
                step="250"
                value={systemPromptRaw}
                onChange={(e) => setSystemPromptRaw(Number(e.target.value))}
                class="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
              <div class="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>0</span>
                <span>Pinned Prefix</span>
                <span>100,000</span>
              </div>
            </div>

            {/* User Input Per Turn */}
            <div>
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-medium text-slate-300">User Input per Turn</span>
                <span class="font-mono text-slate-200 font-semibold">
                  {userInputRaw.toLocaleString()} {unit}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="25000"
                step="50"
                value={userInputRaw}
                onChange={(e) => setUserInputRaw(Number(e.target.value))}
                class="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
            </div>

            {/* Model Output Per Turn */}
            <div>
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-medium text-slate-300">Model Output per Turn</span>
                <span class="font-mono text-slate-200 font-semibold">
                  {modelOutputRaw.toLocaleString()} {unit}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="8000"
                step="50"
                value={modelOutputRaw}
                onChange={(e) => setModelOutputRaw(Number(e.target.value))}
                class="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
            </div>

            {/* Conversation Turns per Session */}
            <div>
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-medium text-slate-300">Conversation Turns per Session</span>
                <span class="font-mono text-indigo-400 font-semibold">
                  {turnsPerSession} {turnsPerSession === 1 ? 'Turn (Single-Shot)' : 'Turns (Compounding)'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="1"
                value={turnsPerSession}
                onChange={(e) => setTurnsPerSession(Number(e.target.value))}
                class="w-full accent-indigo-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
              <p class="text-[10px] font-mono text-slate-500 mt-1">
                Multi-turn compounding re-sends conversation history each turn: cumulative context grows quadratically.
              </p>
            </div>

            {/* Prompt Cache Hit Rate */}
            <div>
              <div class="flex justify-between items-center text-xs mb-1">
                <span class="font-medium text-slate-300">Prompt Cache Hit Rate</span>
                <span class="font-mono text-emerald-400 font-semibold">{cacheHitPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="95"
                step="5"
                value={cacheHitPercent}
                onChange={(e) => setCacheHitPercent(Number(e.target.value))}
                class="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
              <div class="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>0% (No Cache)</span>
                <span>50%</span>
                <span>95% Max SLA</span>
              </div>
            </div>

            {/* Batch API Toggle */}
            <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span class="text-xs font-semibold text-slate-200 block">Batch API (24h Async Queue)</span>
                <span class="text-[10px] text-slate-400 block font-mono">
                  50% discount on supported models (OpenAI, Anthropic, Google)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchMode(!isBatchMode)}
                class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isBatchMode ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
                role="switch"
                aria-checked={isBatchMode}
              >
                <span
                  class={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isBatchMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: FinOps Cost Breakdown & Intelligence (7 cols) */}
        {/* ============================================================ */}
        <div class="lg:col-span-7 space-y-6">
          {/* Context Cliff Warning Alert Banner */}
          {primary.isCliffTriggered && (
            <div class="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 flex items-start gap-3 shadow-lg">
              <ShieldAlert class="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div class="text-xs space-y-1">
                <div class="font-bold text-rose-300 flex items-center gap-2">
                  <span>Context-Cliff Surcharge Triggered!</span>
                  <span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-mono">
                    +{formatCurrency(primary.cliffPenaltyMonthly)}/mo Penalty
                  </span>
                </div>
                <p class="leading-relaxed text-rose-200/90">
                  Peak Context of <strong>{primary.peakContextTokens.toLocaleString()} tokens</strong> crossed the{' '}
                  <strong>{primary.model.cliffThreshold?.toLocaleString()} tokens</strong> cliff threshold for{' '}
                  {primary.model.name}. Input rates doubled to{' '}
                  <strong>${primary.effectiveInputRatePer1M.toFixed(2)}/1M</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Context Window Overflow Alert */}
          {primary.isContextExceeded && (
            <div class="p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-200 flex items-start gap-3 shadow-lg">
              <AlertTriangle class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div class="text-xs space-y-1">
                <div class="font-bold text-amber-300">Exceeds Model Context Window</div>
                <p class="leading-relaxed">
                  Peak turn context ({primary.peakContextTokens.toLocaleString()} tokens) exceeds{' '}
                  {primary.model.name}&apos;s hard limit ({primary.model.contextWindow.toLocaleString()} tokens). Requests
                  will throw HTTP 400 Bad Request errors.
                </p>
              </div>
            </div>
          )}

          {/* Main Monthly Cost Side-by-Side Cards */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Model Card */}
            <div class="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-xl relative overflow-hidden">
              <div class="absolute top-0 right-0 px-3 py-1 bg-emerald-500/10 border-b border-l border-emerald-500/30 rounded-bl-xl text-[10px] font-mono font-bold text-emerald-400 uppercase">
                Primary Model A
              </div>
              <div class="text-xs text-slate-400 font-medium">{primary.model.provider}</div>
              <h3 class="text-lg font-bold text-white truncate pr-20">{primary.model.name}</h3>

              <div class="mt-4 mb-2">
                <div class="text-3xl font-extrabold text-white tracking-tight">
                  {formatCurrency(primary.monthlyTotalCost)}
                  <span class="text-xs font-normal text-slate-400 ml-1">/ month</span>
                </div>
                <div class="text-xs font-mono text-slate-400 mt-1">
                  Run-Rate: <span class="text-slate-200 font-semibold">{formatCurrency(primary.annualRunRate)}/yr</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800 text-xs">
                <div>
                  <span class="text-slate-400 block text-[11px]">Cost / 1k Reqs</span>
                  <span class="font-mono font-semibold text-slate-200">${primary.costPer1kRequests.toFixed(3)}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[11px]">Peak Context</span>
                  <span class="font-mono font-semibold text-slate-200">{formatTokenCount(primary.peakContextTokens)} tokens</span>
                </div>
              </div>
            </div>

            {/* Comparison Model Card */}
            {comparison && (
              <div class="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-xl relative overflow-hidden">
                <div class="absolute top-0 right-0 px-3 py-1 bg-cyan-500/10 border-b border-l border-cyan-500/30 rounded-bl-xl text-[10px] font-mono font-bold text-cyan-400 uppercase">
                  Comparison Model B
                </div>
                <div class="text-xs text-slate-400 font-medium">{comparison.model.provider}</div>
                <h3 class="text-lg font-bold text-white truncate pr-20">{comparison.model.name}</h3>

                <div class="mt-4 mb-2">
                  <div class="text-3xl font-extrabold text-white tracking-tight">
                    {formatCurrency(comparison.monthlyTotalCost)}
                    <span class="text-xs font-normal text-slate-400 ml-1">/ month</span>
                  </div>
                  <div class="text-xs font-mono text-slate-400 mt-1">
                    Run-Rate: <span class="text-slate-200 font-semibold">{formatCurrency(comparison.annualRunRate)}/yr</span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800 text-xs">
                  <div>
                    <span class="text-slate-400 block text-[11px]">Cost / 1k Reqs</span>
                    <span class="font-mono font-semibold text-slate-200">${comparison.costPer1kRequests.toFixed(3)}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block text-[11px]">Peak Context</span>
                    <span class="font-mono font-semibold text-slate-200">{formatTokenCount(comparison.peakContextTokens)} tokens</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Comparison Delta Callout Banner */}
          {comparison && (
            <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div
                  class={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    cheaperModelId === primary.model.id
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  <TrendingDown class="w-4 h-4" />
                </div>
                <div>
                  <div class="text-xs font-semibold text-white">
                    {cheaperModelId === primary.model.id
                      ? `${primary.model.name} is ${percentCheaper.toFixed(1)}% cheaper`
                      : `${comparison.model.name} is ${percentCheaper.toFixed(1)}% cheaper`}
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono">
                    Net Delta: {formatCurrency(Math.abs(monthlyDelta))}/mo ({formatCurrency(Math.abs(annualDelta))}/year)
                  </div>
                </div>
              </div>
              <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                {percentCheaper.toFixed(1)}% Margin Impact
              </span>
            </div>
          )}

          {/* Visual Stacked Progress Bar Cost Breakdown */}
          <div class="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Zap class="w-4 h-4 text-emerald-400" />
                <span>Token Spend Composition ({primary.model.name})</span>
              </h3>
              <span class="text-[11px] font-mono text-slate-400">
                Total {formatTokenCount(primary.monthlyTotalTokens)} tokens/mo
              </span>
            </div>

            {/* The Stacked Bar */}
            <div class="w-full h-4 rounded-full bg-slate-950 overflow-hidden flex shadow-inner border border-slate-800">
              <div
                style={{ width: `${Math.max(1, primary.freshInputSharePercent)}%` }}
                class="bg-cyan-500 transition-all duration-300 relative group"
                title={`Fresh Input: ${primary.freshInputSharePercent.toFixed(1)}%`}
              />
              <div
                style={{ width: `${Math.max(1, primary.cachedInputSharePercent)}%` }}
                class="bg-emerald-400 transition-all duration-300 relative group"
                title={`Cached Input: ${primary.cachedInputSharePercent.toFixed(1)}%`}
              />
              <div
                style={{ width: `${Math.max(1, primary.outputSharePercent)}%` }}
                class="bg-indigo-500 transition-all duration-300 relative group"
                title={`Model Output: ${primary.outputSharePercent.toFixed(1)}%`}
              />
            </div>

            {/* Legend & Dollar Breakdown */}
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div class="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                  <span class="text-slate-400">Fresh Input</span>
                </div>
                <div class="font-mono font-bold text-white">{formatCurrency(primary.monthlyFreshInputCost)}</div>
                <div class="text-[10px] font-mono text-slate-500">
                  {formatTokenCount(primary.monthlyFreshInputTokens)} toks ({primary.freshInputSharePercent.toFixed(0)}%)
                </div>
              </div>

              <div class="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span class="text-slate-400">Cached Input</span>
                </div>
                <div class="font-mono font-bold text-emerald-400">{formatCurrency(primary.monthlyCachedInputCost)}</div>
                <div class="text-[10px] font-mono text-slate-500">
                  {formatTokenCount(primary.monthlyCachedInputTokens)} toks ({primary.cachedInputSharePercent.toFixed(0)}%)
                </div>
              </div>

              <div class="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  <span class="text-slate-400">Model Output</span>
                </div>
                <div class="font-mono font-bold text-white">{formatCurrency(primary.monthlyOutputCost)}</div>
                <div class="text-[10px] font-mono text-slate-500">
                  {formatTokenCount(primary.monthlyOutputTokens)} toks ({primary.outputSharePercent.toFixed(0)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Smart Model Routing ("FinOps Savings Recommender") */}
          {primary.smartRouting && (
            <div class="p-6 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 shadow-xl space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Sparkles class="w-4 h-4" />
                  </div>
                  <h3 class="text-sm font-bold text-emerald-300">
                    FinOps Smart Routing Recommendation
                  </h3>
                </div>
                <span class="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Save {primary.smartRouting.savingsPercent.toFixed(0)}%
                </span>
              </div>

              <p class="text-xs text-slate-300 leading-relaxed">
                By routing <strong class="text-emerald-400">{routingPercent}% of high-volume queries</strong> (simple
                intents, classification, and extraction) to{' '}
                <strong class="text-white">{primary.smartRouting.cheapModel.name}</strong> while keeping{' '}
                {100 - routingPercent}% on <strong class="text-white">{primary.model.name}</strong>:
              </p>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/20">
                <div>
                  <span class="text-[10px] uppercase font-mono text-slate-400 block">Monthly Savings</span>
                  <span class="text-xl font-black text-emerald-400">
                    {formatCurrency(primary.smartRouting.monthlySavings)}
                  </span>
                </div>
                <div>
                  <span class="text-[10px] uppercase font-mono text-slate-400 block">Annualized Run-Rate</span>
                  <span class="text-xl font-black text-emerald-400">
                    {formatCurrency(primary.smartRouting.annualSavings)}
                  </span>
                </div>
                <div class="col-span-2 sm:col-span-1">
                  <span class="text-[10px] uppercase font-mono text-slate-400 block">Blended Monthly Bill</span>
                  <span class="text-xl font-black text-white">
                    {formatCurrency(primary.smartRouting.routedMonthlyCost)}
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-between text-xs pt-1">
                <span class="text-slate-400 font-mono text-[11px]">Adjust Routing Split:</span>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={routingPercent}
                    onChange={(e) => setRoutingPercent(Number(e.target.value))}
                    class="w-32 accent-emerald-500 bg-slate-800 rounded cursor-pointer h-1.5"
                  />
                  <span class="font-mono text-xs text-emerald-400 font-semibold w-8 text-right">
                    {routingPercent}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
