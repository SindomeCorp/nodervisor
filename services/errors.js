export class ServiceError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message);
    this.name = 'ServiceError';
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
