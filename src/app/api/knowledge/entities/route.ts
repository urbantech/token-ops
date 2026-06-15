/**
 * GET  /api/knowledge/entities — list entities, optional ?type=person
 * POST /api/knowledge/entities — create entity
 *
 * Refs #28 #30
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  entityQuerySchema,
  createEntitySchema,
} from '../../../../lib/validation';
import { getKnowledgeGraphService } from '../../../../services/knowledge-graph';
import type { KnowledgeEntity } from '../../../../types/knowledge';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// GET — list/filter entities
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<KnowledgeEntity[]>>> {
  try {
    const { searchParams } = request.nextUrl;

    const rawType = searchParams.get('type') ?? undefined;
    const params = rawType !== undefined ? { type: rawType } : {};

    const parsed = entityQuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${parsed.error.issues
            .map(
              (i: { path: (string | number)[]; message: string }) =>
                `${i.path.join('.')}: ${i.message}`
            )
            .join('; ')}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const service = getKnowledgeGraphService();
    const entities = await service.getEntities(parsed.data.type);

    return NextResponse.json({
      success: true,
      data: entities,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create entity
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<KnowledgeEntity>>> {
  try {
    const body = await request.json();

    const parsed = createEntitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${parsed.error.issues
            .map(
              (i: { path: (string | number)[]; message: string }) =>
                `${i.path.join('.')}: ${i.message}`
            )
            .join('; ')}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const service = getKnowledgeGraphService();
    const entity = await service.addEntity(parsed.data);

    return NextResponse.json(
      {
        success: true,
        data: entity,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
