const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set in environment variables');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    // Do not spam logs for unauthenticated public requests; simply return 401
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  // Accept either 'Bearer <token>' or a raw token value for robustness
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.split(' ')[1] : auth;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    console.warn('authMiddleware: token verification failed', err && err.message);
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    next();
  };
}

module.exports = { authMiddleware, requireRole, JWT_SECRET };
