import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'token-ops',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}
