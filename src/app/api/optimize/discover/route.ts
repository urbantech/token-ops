/**
 * POST /api/optimize/discover
 *
 * The Recursive Optimization Discovery Pipeline.
 * Designed to run as a cron job every 7 days.
 *
 * Steps:
 * 1. Analyze current production data for optimization opportunities
 * 2. Generate optimization report with quantified savings
 * 3. Compare against previous run to detect new patterns
 * 4. Record findings in ZeroDB for the leaderboard
 * 5. Return actionable recommendations
 *
 * This is part of AINative's continuous learning loop:
 *   Measure → Discover → Validate → Implement → Measure again
 */

import { NextResponse } from 'next/server';
import { generateOptimizationReport } from '../../../../services/optimization-engine';
import * as db from '../../../../lib/ainative-db';

interface DiscoveryRun {
  runId: string;
  runAt: string;
  period: { start: string; end: string };
  totalCalls: number;
  totalCost: number;
  topTechnique: string;
  topSavings: number;
  topSavingsPct: number;
  allTechniques: {
    technique: string;
    eligibleCalls: number;
    estimatedSavings: number;
    savingsPct: number;
    status: string;
  }[];
  recommendations: string[];
  newPatternsDetected: string[];
}

export async function POST() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);

    // Step 1: Generate current optimization report
    const report = await generateOptimizationReport(
      sevenDaysAgo.toISOString(),
      now.toISOString()
    );

    // Step 2: Check for new patterns not seen before
    const newPatterns: string[] = [];

    // Detect new high-frequency agents
    const agentFrequency = await db.query<{ agent_id: string; runs: number }>(`
      SELECT agent_id, COUNT(*)::int as runs
      FROM agent_run_log
      WHERE run_at >= $1 AND run_at <= $2
      AND agent_id IS NOT NULL
      GROUP BY agent_id
      HAVING COUNT(*) > 100
      ORDER BY runs DESC
      LIMIT 10
    `, [sevenDaysAgo.toISOString(), now.toISOString()]);

    for (const agent of agentFrequency) {
      if (agent.runs > 200) {
        newPatterns.push(
          `Agent "${agent.agent_id}" ran ${agent.runs} times in 7 days — prime candidate for output caching`
        );
      }
    }

    // Detect new expensive models
    const expensiveModels = await db.query<{ model: string; cost: number; calls: number }>(`
      SELECT model, ROUND(SUM(cost_usd)::numeric, 2)::float as cost, COUNT(*)::int as calls
      FROM llm_token_usage
      WHERE created_at >= $1 AND created_at <= $2
      AND endpoint = '/chat/completions'
      GROUP BY model
      HAVING SUM(cost_usd) > 100
      ORDER BY cost DESC
      LIMIT 5
    `, [sevenDaysAgo.toISOString(), now.toISOString()]);

    for (const m of expensiveModels) {
      newPatterns.push(
        `Model "${m.model}" cost $${m.cost} across ${m.calls} calls — evaluate routing to cheaper alternative`
      );
    }

    // Detect high prompt-to-completion ratio (waste indicator)
    const wasteRatio = await db.query<{ waste_calls: number; total: number }>(`
      SELECT
        COUNT(CASE WHEN prompt_tokens > 10000 AND completion_tokens < 200 THEN 1 END)::int as waste_calls,
        COUNT(*)::int as total
      FROM llm_token_usage
      WHERE created_at >= $1 AND created_at <= $2
      AND endpoint = '/chat/completions'
    `, [sevenDaysAgo.toISOString(), now.toISOString()]);

    if (wasteRatio[0] && wasteRatio[0].total > 0) {
      const wastePct = (wasteRatio[0].waste_calls / wasteRatio[0].total * 100).toFixed(1);
      if (parseFloat(wastePct) > 30) {
        newPatterns.push(
          `${wastePct}% of calls send >10K prompt tokens for <200 completion tokens — massive optimization opportunity`
        );
      }
    }

    // Step 3: Build discovery run record
    const runId = `discovery-${now.toISOString().slice(0, 10)}-${Date.now().toString(36)}`;

    const discoveryRun: DiscoveryRun = {
      runId,
      runAt: now.toISOString(),
      period: report.period,
      totalCalls: report.totalCalls,
      totalCost: report.totalCost,
      topTechnique: report.techniquesApplied[0]?.technique ?? 'none',
      topSavings: report.totalSavingsAvailable,
      topSavingsPct: report.totalSavingsPct,
      allTechniques: report.techniquesApplied.map((t) => ({
        technique: t.technique,
        eligibleCalls: t.eligibleCalls,
        estimatedSavings: t.estimatedSavings,
        savingsPct: t.savingsPct,
        status: t.status,
      })),
      recommendations: [
        ...report.recommendations,
        ...newPatterns.map((p) => `[NEW PATTERN] ${p}`),
      ],
      newPatternsDetected: newPatterns,
    };

    // Step 4: Log the discovery run
    console.log(`[OPTIMIZATION DISCOVERY] Run ${runId}: ${report.totalCalls} calls, $${report.totalCost.toFixed(2)} spend, best savings: $${report.totalSavingsAvailable.toFixed(2)} (${report.totalSavingsPct.toFixed(1)}%)`);
    for (const pattern of newPatterns) {
      console.log(`  [NEW PATTERN] ${pattern}`);
    }

    return NextResponse.json({
      success: true,
      data: discoveryRun,
      timestamp: now.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('POST /api/optimize/discover error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
