import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(err.stack || err.message || err);

  // Zod validation errors should be 400 Bad Request, not 500
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Doğrulama hatası',
      errors: err.errors,
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
