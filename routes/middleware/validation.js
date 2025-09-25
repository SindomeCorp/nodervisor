import { ZodError } from 'zod';

/**
 * Creates an Express middleware that validates parts of the incoming request
 * using the provided Zod schemas. Parsed values are stored on
 * `req.validated` so that downstream handlers operate on normalized data.
 *
 * @param {{ body?: import('zod').ZodTypeAny; query?: import('zod').ZodTypeAny; params?: import('zod').ZodTypeAny }} schemas
 */
export function validateRequest(schemas) {
  return (req, res, next) => {
    try {
      const parsed = { ...(req.validated ?? {}) };

      if (schemas.body) {
        parsed.body = schemas.body.parse(req.body ?? {});
      }

      if (schemas.query) {
        parsed.query = schemas.query.parse(req.query ?? {});
      }

      if (schemas.params) {
        parsed.params = schemas.params.parse(req.params ?? {});
      }

      req.validated = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(({ path, message }) => ({
          path: path.map(String),
          message
        }));
        const message = details[0]?.message ?? 'Invalid request payload.';

        res.status(400).json({
          status: 'error',
          error: {
            message,
            details
          }
        });
        return;
      }

      next(error);
    }
  };
}
