/**
 * Here I extend Express typings so `req.user` matches my JWT payload.
 * This fixes TypeScript overload errors in routes/middlewares where I use AuthRequest.
 *
 * NOTE:
 * - Express defines req.user as Express.User.
 * - By extending Express.User, req.user becomes compatible everywhere.
 */
declare global {
  namespace Express {
    interface User {
      /**
       * These fields should match what you attach to req.user in your auth middleware.
       * Adjust names if your payload uses different keys.
       */
      id: number;
      hotelId: number;
      role: "admin" | "receptionist";

      // Optional extra fields if you include them
      email?: string;
      name?: string;
    }
  }
}

export {};
