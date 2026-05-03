// Import JWT library for token creation and verification
const jwt = require('jsonwebtoken');

// Get JWT secret from environment variables
// If not set, fallback to a default (NOT recommended for production)
const JWT_SECRET = process.env.JWT_SECRET || 'internbridge_v4_secret_key_2026';

// Security Warning:
// If JWT_SECRET is missing or still using default value,
// log a warning so developer knows to fix it
if (!process.env.JWT_SECRET || JWT_SECRET === 'internbridge_v4_secret_key_2026') {
  console.warn('WARNING: JWT_SECRET is not set in environment variables. Please set it in .env file.');
}

/**
 * 🔐 Authentication Middleware
 * Purpose:
 * - Verify JWT token sent in request headers
 * - Attach decoded user data to request object (req.user)
 * - Block unauthorized access if token is missing/invalid
 */
function authMiddleware(req, res, next) {
  
  // Get Authorization header from request
  const auth = req.headers.authorization;

  // If no Authorization header found → user is not logged in
  if (!auth) {
    console.warn('authMiddleware: missing Authorization header');
    return res.status(401).json({ 
      error: 'Authentication required. Please log in.' 
    });
  }

  // Support both formats:
  // 1. "Bearer <token>" (standard)
  // 2. "<token>" (raw token)
  const token = typeof auth === 'string' && auth.startsWith('Bearer ')
    ? auth.split(' ')[1]   // Extract token after "Bearer"
    : auth;

  try {
    // Verify token using secret key
    // If valid → decoded payload stored in req.user
    req.user = jwt.verify(token, JWT_SECRET);

    // Pass control to next middleware/route
    next();

  } catch (err) {
    // If token is invalid/expired → reject request
    console.warn('authMiddleware: token verification failed', err && err.message);
    
    return res.status(401).json({ 
      error: 'Session expired. Please log in again.' 
    });
  }
}

/**
 * 🛡️ Role-Based Authorization Middleware
 * Purpose:
 * - Restrict access based on user roles
 * - Example: Only admin can access certain routes
 * 
 * Usage:
 * requireRole('admin')
 * requireRole('admin', 'company')
 */
function requireRole(...roles) {
  return (req, res, next) => {

    // Check if user's role is included in allowed roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'You do not have permission to perform this action.' 
      });
    }

    // If role matches → allow access
    next();
  };
}

// Export middleware functions and secret key
module.exports = { authMiddleware, requireRole, JWT_SECRET };
