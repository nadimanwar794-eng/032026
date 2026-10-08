/**
 * Vercel catch-all function for the existing notification API.
 *
 * Keeping the Express app as the single route implementation avoids having
 * different Firebase Admin/authentication behavior on Replit and Vercel.
 * Vercel passes /api/* requests to this function, while the app itself still
 * owns the /api prefix.
 */
import app from '../artifacts/api-server/src/app';

export default app;