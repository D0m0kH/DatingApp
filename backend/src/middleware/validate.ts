// backend/src/middleware/validate.ts

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * @description Express middleware factory that validates request body, query, or params against a Zod schema.
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[source];
      const parsedData = schema.parse(dataToValidate);

      // Augment the request with a typed property
      req.validatedBody = parsedData;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Map Zod errors to rich details object for client consumption
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        throw new ValidationError('Validation failed for request data.', 'INVALID_INPUT', details);
      }
      next(error);
    }
  };
};

export const validateBody = (schema: ZodSchema) => validate(schema, 'body');
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');