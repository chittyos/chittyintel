/**
 * Authentication middleware for ChittyIntel
 * Validates that requests come from ChittyConnect
 */

export async function authMiddleware(request, env) {
  const authHeader = request.headers.get('Authorization');
  const serviceHeader = request.headers.get('X-ChittyOS-Service');

  // Check for Authorization header
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Authorization header required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.slice(7);

  // Validate token matches our expected service token
  // This token is shared between ChittyIntel and ChittyConnect
  if (token !== env.CHITTYCONNECT_SERVICE_TOKEN) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Invalid service token'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Additional validation: check service header
  // ChittyConnect should identify itself when proxying requests
  const validServices = ['chittyconnect', 'chittyevidence', 'chittyledger'];
  if (serviceHeader && !validServices.includes(serviceHeader.toLowerCase())) {
    console.warn(`Unexpected service header: ${serviceHeader}`);
  }

  // Request is authenticated
  return {
    authenticated: true,
    source: serviceHeader || 'chittyconnect',
    token: token
  };
}
