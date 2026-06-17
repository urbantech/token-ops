/**
 * GET /api/cron/weekly-optimize
 *
 * Weekly Optimization Discovery Cron Endpoint
 *
 * Called by Railway Cron Service every 7 days (Tuesdays at 06:23 UTC).
 * This is the heartbeat of AINative's recursive optimization loop:
 *
 *   Measure → Discover → Validate → Implement → Measure again
 *
 * Steps:
 * 1. Analyze last 7 days of production LLM usage
 * 2. Quantify savings potential for each technique
 * 3. Detect new patterns (high-frequency agents, expensive models, waste)
 * 4. Compare against previous run
 * 5. Log results for dashboard/leaderboard
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateOptimizationReport } from '../../../../services/optimization-engine';
import * as db from '../../../../lib/ainative-db';

export async function GET(request: NextRequest) {
  // Verify cron secret (Railway sets this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
    const start = sevenDaysAgo.toISOString();
    const end = now.toISOString();

    console.log(`[CRON] Weekly Optimization Discovery starting — ${start} to ${end}`);

    // Step 1: Generate optimization report
    const report = await generateOptimizationReport(start, end);

    // Step 2: Detect new patterns
    const newPatterns: string[] = [];

    // High-frequency agents
    const agents = await db.query<{ agent_id: string; runs: number }>(`
      SELECT agent_id, COUNT(*)::int as runs
      FROM agent_run_log
      WHERE run_at >= $1 AND run_at <= $2
      AND agent_id IS NOT NULL
      GROUP BY agent_id
      HAVING COUNT(*) > 100
      ORDER BY runs DESC LIMIT 10
    `, [start, end]);

    for (const a of agents) {
      if (a.runs > 200) {
        newPatterns.push(`Agent "${a.agent_id}": ${a.runs} runs/week — cache candidate`);
      }
    }

    // Expensive models
    const models = await db.query<{ model: string; cost: number; calls: number }>(`
      SELECT model, ROUND(SUM(cost_usd)::numeric, 2)::float as cost, COUNT(*)::int as calls
      FROM llm_token_usage
      WHERE created_at >= $1 AND created_at <= $2
      AND endpoint = '/chat/completions'
      GROUP BY model HAVING SUM(cost_usd) > 50
      ORDER BY cost DESC LIMIT 5
    `, [start, end]);

    for (const m of models) {
      newPatterns.push(`Model "${m.model}": $${m.cost} (${m.calls} calls) — evaluate downgrade`);
    }

    // Waste ratio
    const waste = await db.query<{ waste_pct: number }>(`
      SELECT ROUND(100.0 * COUNT(CASE WHEN prompt_tokens > 10000 AND completion_tokens < 200 THEN 1 END) / NULLIF(COUNT(*), 0), 1)::float as waste_pct
      FROM llm_token_usage
      WHERE created_at >= $1 AND created_at <= $2
      AND endpoint = '/chat/completions'
    `, [start, end]);

    if (waste[0]?.waste_pct > 30) {
      newPatterns.push(`${waste[0].waste_pct}% waste ratio (>10K prompt, <200 completion)`);
    }

    // Step 3: Log results
    const summary = {
      runAt: now.toISOString(),
      period: { start, end },
      totalCalls: report.totalCalls,
      totalCost: report.totalCost,
      topTechnique: report.techniquesApplied[0]?.technique ?? 'none',
      topSavings: report.totalSavingsAvailable,
      topSavingsPct: report.totalSavingsPct,
      techniques: report.techniquesApplied.length,
      newPatterns: newPatterns.length,
      recommendations: [...report.recommendations, ...newPatterns.map(p => `[NEW] ${p}`)],
    };

    console.log(`[CRON] Discovery complete: ${report.totalCalls} calls, $${report.totalCost.toFixed(2)} cost`);
    console.log(`[CRON] Best savings: $${report.totalSavingsAvailable.toFixed(2)} (${report.totalSavingsPct.toFixed(1)}%)`);
    console.log(`[CRON] New patterns: ${newPatterns.length}`);
    for (const p of newPatterns) {
      console.log(`[CRON]   ${p}`);
    }

    return NextResponse.json({
      success: true,
      data: summary,
      timestamp: now.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(`[CRON] Weekly optimization discovery FAILED: ${message}`);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
