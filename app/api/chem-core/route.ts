/**
 * Proxy to Chem Core service (parse-standardize).
 * Next.js does not spawn Python; it calls the persistent FastAPI service.
 */

import { NextRequest, NextResponse } from 'next/server';

const CHEM_CORE_URL = process.env.CHEM_CORE_URL || 'http://127.0.0.1:8001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${CHEM_CORE_URL}/parse-standardize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || res.statusText },
        { status: res.status }
      );
    }
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    console.error('Chem Core proxy error:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Chem Core unreachable' },
      { status: 503 }
    );
  }
}

export async function GET() {
  try {
    const res = await fetch(`${CHEM_CORE_URL}/health`);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ status: 'error', rdkit: false }, { status: 503 });
  }
}
