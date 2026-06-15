/**
 * POST /api/prompts/duplicates
 *
 * Check whether a given prompt is semantically similar to previously
 * analyzed prompts. Returns matching duplicates above the similarity
 * threshold.
 *
 * Refs #14
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectDuplicates } from '@/services/prompt-analyzer';

const DuplicateSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt must not be empty')
    .max(100_000, 'Prompt exceeds maximum length of 100 000 characters'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.8),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DuplicateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        },
        { status: 400 }
      );
    }

    const duplicates = await detectDuplicates(
      parsed.data.prompt,
      parsed.data.threshold
    );

    return NextResponse.json({
      success: true,
      data: {
        duplicates,
        count: duplicates.length,
        threshold: parsed.data.threshold,
      },
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
