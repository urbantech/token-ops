/**
 * POST /api/prompts/analyze
 *
 * Accepts a prompt string and returns a full PromptAnalysis scorecard
 * with verbosity, duplication, context waste, and repeated instructions.
 *
 * Refs #14
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzePrompt } from '@/services/prompt-analyzer';

const AnalyzeSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt must not be empty')
    .max(100_000, 'Prompt exceeds maximum length of 100 000 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AnalyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        },
        { status: 400 }
      );
    }

    const analysis = await analyzePrompt(parsed.data.prompt);

    return NextResponse.json({
      success: true,
      data: analysis,
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
