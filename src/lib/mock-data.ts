/**
 * Mock data for the AI Spend Intelligence Dashboard
 * Used for development and demonstration purposes.
 * Replace with real API calls once the backend telemetry endpoints are ready.
 */

import { Classification } from '@/types/telemetry';

// ---------------------------------------------------------------------------
// Agent Cost Data
// ---------------------------------------------------------------------------

export interface AgentCostRow {
  name: string;
  model: string;
  provider: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  requests: number;
  classification: Classification;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export const mockAgentCosts: AgentCostRow[] = [
  {
    name: 'Code Review Agent',
    model: 'claude-opus-4-6',
    provider: 'Anthropic',
    tokens: 1_284_500,
    promptTokens: 842_300,
    completionTokens: 442_200,
    cost: 18.42,
    requests: 347,
    classification: Classification.FIXING_ISSUES,
    trend: 'up',
    trendPercent: 12.3,
  },
  {
    name: 'Spec Writer Agent',
    model: 'claude-sonnet-4-6',
    provider: 'Anthropic',
    tokens: 978_200,
    promptTokens: 612_100,
    completionTokens: 366_100,
    cost: 7.28,
    requests: 215,
    classification: Classification.UPDATING_SPECS,
    trend: 'down',
    trendPercent: 4.1,
  },
  {
    name: 'Brainstorm Agent',
    model: 'gpt-4o',
    provider: 'OpenAI',
    tokens: 654_800,
    promptTokens: 398_500,
    completionTokens: 256_300,
    cost: 6.55,
    requests: 189,
    classification: Classification.BRAINSTORMING,
    trend: 'up',
    trendPercent: 8.7,
  },
  {
    name: 'Dev Assistant',
    model: 'claude-sonnet-4-6',
    provider: 'Anthropic',
    tokens: 2_145_000,
    promptTokens: 1_398_000,
    completionTokens: 747_000,
    cost: 15.97,
    requests: 892,
    classification: Classification.UPDATING_CODE,
    trend: 'up',
    trendPercent: 22.5,
  },
  {
    name: 'Batch Runner',
    model: 'claude-haiku-3-5',
    provider: 'Anthropic',
    tokens: 3_287_400,
    promptTokens: 2_890_000,
    completionTokens: 397_400,
    cost: 4.93,
    requests: 1_247,
    classification: Classification.BATCH_COMMANDS,
    trend: 'stable',
    trendPercent: 0.8,
  },
  {
    name: 'Issue Triage Bot',
    model: 'gpt-4o-mini',
    provider: 'OpenAI',
    tokens: 412_700,
    promptTokens: 298_400,
    completionTokens: 114_300,
    cost: 1.24,
    requests: 534,
    classification: Classification.FIXING_ISSUES,
    trend: 'down',
    trendPercent: 6.2,
  },
];

export const mockTotalCost = mockAgentCosts.reduce((sum, a) => sum + a.cost, 0);
export const mockTotalTokens = mockAgentCosts.reduce((sum, a) => sum + a.tokens, 0);
export const mockTotalRequests = mockAgentCosts.reduce((sum, a) => sum + a.requests, 0);

// ---------------------------------------------------------------------------
// Spend by Category
// ---------------------------------------------------------------------------

export interface CategorySpend {
  name: string;
  label: string;
  value: number;
  tokens: number;
  count: number;
  color: string;
  fill: string;
}

export const mockCategorySpend: CategorySpend[] = [
  {
    name: Classification.UPDATING_SPECS,
    label: 'Updating Specs',
    value: 14.82,
    tokens: 1_890_000,
    count: 312,
    color: '#3B82F6',
    fill: '#3B82F6',
  },
  {
    name: Classification.BRAINSTORMING,
    label: 'Brainstorming',
    value: 11.44,
    tokens: 1_230_000,
    count: 287,
    color: '#A855F7',
    fill: '#A855F7',
  },
  {
    name: Classification.UPDATING_CODE,
    label: 'Updating Code',
    value: 22.31,
    tokens: 2_945_000,
    count: 567,
    color: '#22C55E',
    fill: '#22C55E',
  },
  {
    name: Classification.FIXING_ISSUES,
    label: 'Fixing Issues',
    value: 9.17,
    tokens: 987_000,
    count: 198,
    color: '#F97316',
    fill: '#F97316',
  },
  {
    name: Classification.BATCH_COMMANDS,
    label: 'Batch Commands',
    value: 4.93,
    tokens: 3_287_400,
    count: 1_247,
    color: '#EF4444',
    fill: '#EF4444',
  },
];

// ---------------------------------------------------------------------------
// Cost Trend Data
// ---------------------------------------------------------------------------

export interface CostTrendPoint {
  timestamp: string;
  label: string;
  total: number;
  anthropic: number;
  openai: number;
  tokens: number;
}

export const mockDailyTrend: CostTrendPoint[] = [
  { timestamp: '2026-06-07', label: 'Jun 7', total: 7.23, anthropic: 5.12, openai: 2.11, tokens: 890_000 },
  { timestamp: '2026-06-08', label: 'Jun 8', total: 9.41, anthropic: 6.88, openai: 2.53, tokens: 1_150_000 },
  { timestamp: '2026-06-09', label: 'Jun 9', total: 6.87, anthropic: 4.92, openai: 1.95, tokens: 820_000 },
  { timestamp: '2026-06-10', label: 'Jun 10', total: 11.34, anthropic: 8.11, openai: 3.23, tokens: 1_420_000 },
  { timestamp: '2026-06-11', label: 'Jun 11', total: 14.55, anthropic: 10.24, openai: 4.31, tokens: 1_890_000 },
  { timestamp: '2026-06-12', label: 'Jun 12', total: 8.92, anthropic: 6.45, openai: 2.47, tokens: 1_080_000 },
  { timestamp: '2026-06-13', label: 'Jun 13', total: 12.78, anthropic: 9.34, openai: 3.44, tokens: 1_560_000 },
  { timestamp: '2026-06-14', label: 'Jun 14', total: 10.12, anthropic: 7.23, openai: 2.89, tokens: 1_242_000 },
];

export const mockWeeklyTrend: CostTrendPoint[] = [
  { timestamp: '2026-04-21', label: 'Apr 21', total: 48.23, anthropic: 34.12, openai: 14.11, tokens: 5_890_000 },
  { timestamp: '2026-04-28', label: 'Apr 28', total: 55.41, anthropic: 39.88, openai: 15.53, tokens: 6_950_000 },
  { timestamp: '2026-05-05', label: 'May 5', total: 42.87, anthropic: 30.92, openai: 11.95, tokens: 5_220_000 },
  { timestamp: '2026-05-12', label: 'May 12', total: 61.34, anthropic: 44.11, openai: 17.23, tokens: 7_720_000 },
  { timestamp: '2026-05-19', label: 'May 19', total: 74.55, anthropic: 53.24, openai: 21.31, tokens: 9_390_000 },
  { timestamp: '2026-05-26', label: 'May 26', total: 68.92, anthropic: 49.45, openai: 19.47, tokens: 8_680_000 },
  { timestamp: '2026-06-02', label: 'Jun 2', total: 81.78, anthropic: 58.34, openai: 23.44, tokens: 10_260_000 },
  { timestamp: '2026-06-09', label: 'Jun 9', total: 89.12, anthropic: 63.23, openai: 25.89, tokens: 11_242_000 },
];

export const mockMonthlyTrend: CostTrendPoint[] = [
  { timestamp: '2026-01-01', label: 'Jan', total: 192.34, anthropic: 138.12, openai: 54.22, tokens: 24_890_000 },
  { timestamp: '2026-02-01', label: 'Feb', total: 218.41, anthropic: 157.88, openai: 60.53, tokens: 28_950_000 },
  { timestamp: '2026-03-01', label: 'Mar', total: 245.87, anthropic: 178.92, openai: 66.95, tokens: 32_220_000 },
  { timestamp: '2026-04-01', label: 'Apr', total: 287.34, anthropic: 208.11, openai: 79.23, tokens: 37_720_000 },
  { timestamp: '2026-05-01', label: 'May', total: 321.55, anthropic: 235.24, openai: 86.31, tokens: 42_390_000 },
  { timestamp: '2026-06-01', label: 'Jun (partial)', total: 189.12, anthropic: 136.23, openai: 52.89, tokens: 24_442_000 },
];

// ---------------------------------------------------------------------------
// Model Cost Comparison
// ---------------------------------------------------------------------------

export interface ModelComparison {
  currentModel: string;
  currentProvider: string;
  currentCostPer1k: number;
  currentMonthlyTokens: number;
  currentMonthlyCost: number;
  recommendedModel: string;
  recommendedProvider: string;
  recommendedCostPer1k: number;
  projectedMonthlyCost: number;
  savingsAmount: number;
  savingsPercent: number;
  useCase: string;
  tradeoffs: string;
}

export const mockModelComparisons: ModelComparison[] = [
  {
    currentModel: 'claude-opus-4-6',
    currentProvider: 'Anthropic',
    currentCostPer1k: 0.015,
    currentMonthlyTokens: 1_284_500,
    currentMonthlyCost: 19.27,
    recommendedModel: 'claude-sonnet-4-6',
    recommendedProvider: 'Anthropic',
    recommendedCostPer1k: 0.006,
    projectedMonthlyCost: 7.71,
    savingsAmount: 11.56,
    savingsPercent: 60.0,
    useCase: 'Code Review Agent — most tasks do not need Opus-level reasoning',
    tradeoffs: 'Sonnet handles 95% of code review tasks equally well',
  },
  {
    currentModel: 'gpt-4o',
    currentProvider: 'OpenAI',
    currentCostPer1k: 0.01,
    currentMonthlyTokens: 654_800,
    currentMonthlyCost: 6.55,
    recommendedModel: 'gpt-4o-mini',
    recommendedProvider: 'OpenAI',
    recommendedCostPer1k: 0.00015,
    projectedMonthlyCost: 0.98,
    savingsAmount: 5.57,
    savingsPercent: 85.0,
    useCase: 'Brainstorm Agent — creative ideation workloads',
    tradeoffs: 'Mini is 85% cheaper; suitable for high-volume brainstorming',
  },
  {
    currentModel: 'claude-sonnet-4-6',
    currentProvider: 'Anthropic',
    currentCostPer1k: 0.006,
    currentMonthlyTokens: 2_145_000,
    currentMonthlyCost: 12.87,
    recommendedModel: 'claude-haiku-3-5',
    recommendedProvider: 'Anthropic',
    recommendedCostPer1k: 0.00025,
    projectedMonthlyCost: 0.54,
    savingsAmount: 12.33,
    savingsPercent: 95.8,
    useCase: 'Dev Assistant — repetitive boilerplate generation tasks',
    tradeoffs: 'Haiku is ideal for templating; complex reasoning still needs Sonnet',
  },
  {
    currentModel: 'claude-sonnet-4-6',
    currentProvider: 'Anthropic',
    currentCostPer1k: 0.006,
    currentMonthlyTokens: 978_200,
    currentMonthlyCost: 5.87,
    recommendedModel: 'claude-sonnet-4-6',
    recommendedProvider: 'Anthropic',
    recommendedCostPer1k: 0.006,
    projectedMonthlyCost: 5.87,
    savingsAmount: 0,
    savingsPercent: 0,
    useCase: 'Spec Writer Agent — already well-optimised',
    tradeoffs: 'No alternative recommended — current model is cost-appropriate',
  },
];

// ---------------------------------------------------------------------------
// Savings Opportunities
// ---------------------------------------------------------------------------

export interface SavingsOpportunity {
  id: string;
  type: 'duplicate_prompts' | 'expensive_models' | 'batch_patterns' | 'memory_reuse';
  title: string;
  subtitle: string;
  count: number;
  estimatedSavingsMonthly: number;
  priority: 'high' | 'medium' | 'low';
  details: string[];
}

export const mockSavingsOpportunities: SavingsOpportunity[] = [
  {
    id: 'dup-prompts',
    type: 'duplicate_prompts',
    title: 'Duplicate Prompts',
    subtitle: 'Identical or near-identical requests detected',
    count: 143,
    estimatedSavingsMonthly: 8.42,
    priority: 'high',
    details: [
      '143 duplicate requests identified in the last 30 days',
      'Most common: "Summarize this PR" repeated 38 times',
      'Response caching could eliminate 89% of duplicates',
      'Estimated token savings: 1.2M tokens/month',
    ],
  },
  {
    id: 'expensive-models',
    type: 'expensive_models',
    title: 'Expensive Models',
    subtitle: 'Models that could be downgraded for common tasks',
    count: 3,
    estimatedSavingsMonthly: 29.46,
    priority: 'high',
    details: [
      'Code Review Agent using Opus ($18.42/mo) → Sonnet saves $11.56',
      'Brainstorm Agent using GPT-4o ($6.55/mo) → GPT-4o-mini saves $5.57',
      'Dev Assistant using Sonnet ($12.87/mo) → Haiku saves $12.33',
      'Total potential: 3 model downgrades with minimal quality impact',
    ],
  },
  {
    id: 'batch-patterns',
    type: 'batch_patterns',
    title: 'Batch Patterns',
    subtitle: 'Repetitive commands that could be scripted',
    count: 7,
    estimatedSavingsMonthly: 12.18,
    priority: 'medium',
    details: [
      '7 repetitive command patterns detected this month',
      'Top pattern: "run tests + report failures" (89 occurrences)',
      'Converting to batch scripts reduces per-call overhead by ~60%',
      'Automation candidates: test runs, lint checks, deploy validations',
    ],
  },
  {
    id: 'memory-reuse',
    type: 'memory_reuse',
    title: 'Memory Reuse',
    subtitle: 'Cached context available but not utilised',
    count: 56,
    estimatedSavingsMonthly: 4.87,
    priority: 'low',
    details: [
      '56 conversations reloading identical context from scratch',
      'Project context (~8K tokens) resent on every new session',
      'ZeroMemory semantic cache can eliminate repeat context loads',
      'Estimated savings: 680K prompt tokens/month',
    ],
  },
];

export const mockTotalSavings = mockSavingsOpportunities.reduce(
  (sum, o) => sum + o.estimatedSavingsMonthly,
  0,
);

// ---------------------------------------------------------------------------
// Batch Patterns
// ---------------------------------------------------------------------------

export interface DetectedBatchPattern {
  id: string;
  pattern: string;
  frequency: number;
  totalCost: number;
  totalTokens: number;
  estimatedSavings: number;
  samplePrompts: string[];
  scriptTemplate: string;
}

export const mockBatchPatterns: DetectedBatchPattern[] = [
  {
    id: 'bp-1',
    pattern: 'Run tests and report failures',
    frequency: 89,
    totalCost: 4.23,
    totalTokens: 534_000,
    estimatedSavings: 3.38,
    samplePrompts: [
      'Run the test suite and tell me what failed',
      'Execute all tests and summarise the failures',
      'Run pytest and report any test failures',
    ],
    scriptTemplate: `#!/bin/bash\n# Auto-generated test runner script\npytest --tb=short 2>&1 | tail -30\n`,
  },
  {
    id: 'bp-2',
    pattern: 'Lint and auto-fix code',
    frequency: 54,
    totalCost: 2.87,
    totalTokens: 312_000,
    estimatedSavings: 2.15,
    samplePrompts: [
      'Run the linter and fix any issues',
      'Check code style and apply auto-fixes',
      'Lint the codebase and resolve warnings',
    ],
    scriptTemplate: `#!/bin/bash\n# Auto-generated lint script\nnpx eslint . --fix && npx prettier --write .\n`,
  },
  {
    id: 'bp-3',
    pattern: 'Deploy to staging environment',
    frequency: 31,
    totalCost: 1.44,
    totalTokens: 178_000,
    estimatedSavings: 1.08,
    samplePrompts: [
      'Deploy the latest build to staging',
      'Push to staging and verify deployment',
      'Deploy develop branch to the staging environment',
    ],
    scriptTemplate: `#!/bin/bash\n# Auto-generated deploy script\ngit push origin develop && railway up --environment staging\n`,
  },
];

// ---------------------------------------------------------------------------
// Summary Stats
// ---------------------------------------------------------------------------

export const mockSummaryStats = {
  totalSpendThisMonth: mockTotalCost,
  totalSpendLastMonth: 48.32,
  spendTrendPercent: ((mockTotalCost - 48.32) / 48.32) * 100,
  totalTokensThisMonth: mockTotalTokens,
  totalSavingsAvailable: mockTotalSavings,
  budgetLimit: 100,
  budgetUsedPercent: (mockTotalCost / 100) * 100,
};
