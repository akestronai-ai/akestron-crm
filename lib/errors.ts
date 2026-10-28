export class ApiError extends Error {
  constructor(message: string, public status = 400, public code?: string, public details?: Record<string, unknown>) { super(message); }
}
