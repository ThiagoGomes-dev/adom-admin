import { NextResponse } from 'next/server';

const ALLOWED_ORIGIN = process.env.STOREFRONT_ORIGIN ?? '*';

/** Libera as rotas públicas de pedido pro site (outra origem) chamar do navegador. */
export function withCors(response: NextResponse, methods = 'POST, OPTIONS') {
  response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  response.headers.set('Access-Control-Allow-Methods', methods);
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
