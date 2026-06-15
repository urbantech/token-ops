/**
 * POST /api/context/compress
 *
 * Accepts a text string and returns a CompressionAnalysis with
 * identified compression techniques and estimated token savings.
 *
 * Refs #19, #20
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeCompression } from '@/services/context-compression';

const CompressSchema = z.object({
  text: z
    .string()
    .min(1, 'Text must not be empty')
    .max(200_000, 'Text exceeds maximum length of 200 000 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CompressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        },
        { status: 400 }
      );
    }

    const analysis = analyzeCompression(parsed.data.text);

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
