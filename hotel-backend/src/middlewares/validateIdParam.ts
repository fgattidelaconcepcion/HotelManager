import type { Request, Response, NextFunction } from "express";

/**
 * ID validation middleware factory.
 *
 * Here I generate a middleware that validates numeric route params,
 * ensuring they are positive integers before reaching controllers.
 */
export function validateIdParam(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Here I read the raw parameter from the route
    const raw = req.params[paramName];

    // Here I convert it to a number
    const id = Number(raw);

    /**
     * Here I validate that:
     * - The param exists
     * - It is a valid number
     * - It is an integer
     * - It is greater than zero
     *
     * This prevents invalid IDs from reaching the database layer.
     */
    if (!raw || Number.isNaN(id) || !Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid ID",
      });
    }

    // Here I allow the request to continue if validation passes
    next();
  };
}
