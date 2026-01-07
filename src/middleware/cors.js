/**
 * CORS middleware for ChittyIntel
 */

export function corsMiddleware() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ChittyID, X-ChittyOS-API-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}
