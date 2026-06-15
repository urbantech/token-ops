/**
 * POST /api/prompts/recommend
 *
 * Accepts a prompt (and optionally a pre-computed analysis) and returns
 * an optimized prompt with token savings metrics and change descriptions.
 *
 * If no analysis is provided, one is computed on the fly.
 *
 * Refs #15
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzePrompt } from '@/services/prompt-analyzer';
import { generateRecommendation } from '@/services/prompt-recommender';

const RecommendSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt must not be empty')
    .max(100_000, 'Prompt exceeds maximum length of 100 000 characters'),
  analysis: z.any().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RecommendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        },
        { status: 400 }
      );
    }

    const { prompt, analysis: providedAnalysis } = parsed.data;

    // Use provided analysis or compute fresh
    const analysis = providedAnalysis ?? (await analyzePrompt(prompt));
    const recommendation = generateRecommendation(prompt, analysis);

    return NextResponse.json({
      success: true,
      data: recommendation,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
