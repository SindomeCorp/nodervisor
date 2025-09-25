import { ServiceError } from '../../services/errors.js';

export function sendError(res, statusCode, message, details) {
  const payload = { status: 'error', error: { message } };

  if (details && details.length > 0) {
    payload.error.details = details;
  }

  res.status(statusCode).json(payload);
}

export function handleRouteError(res, error) {
  if (error instanceof ServiceError) {
    sendError(res, error.statusCode ?? 500, error.message, error.details);
    return;
  }

  sendError(res, 500, 'Unexpected error');
}
