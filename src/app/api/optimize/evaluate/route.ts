/**
 * POST /api/optimize/evaluate
 *
 * Evaluate an incoming LLM request and return an optimization decision.
 * This is the endpoint that the AINative inference router calls BEFORE
 * sending a request to the LLM provider.
 *
 * Body: { model, provider, promptTokens, prompt?, agentId?, isInteractive }
 * Returns: OptimizationDecision
 */

import { NextRequest, NextResponse } from 'next/server';
import { evaluateRequest } from '../../../../services/optimization-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.model || !body.provider) {
      return NextResponse.json(
        { success: false, error: 'model and provider required' },
        { status: 400 }
      );
    }

    const decision = evaluateRequest({
      model: body.model,
      provider: body.provider,
      promptTokens: body.promptTokens ?? 0,
      completionTokens: body.completionTokens,
      prompt: body.prompt,
      agentId: body.agentId,
      endpoint: body.endpoint,
      isInteractive: body.isInteractive ?? false,
    });

    return NextResponse.json({
      success: true,
      data: decision,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
