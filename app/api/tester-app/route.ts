import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const testerFilePath = path.join(
      process.cwd(),
      'Spectrotester',
      'Spectromasterv0.2tester.html'
    );

    const htmlContent = await fs.readFile(testerFilePath, 'utf-8');

    const testerCsp = [
      "default-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': testerCsp,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Tester uygulamasi dosyasi okunamadi.';

    return NextResponse.json(
      {
        success: false,
        error: 'Tester uygulamasi acilamadi.',
        details: message,
      },
      { status: 500 }
    );
  }
}
