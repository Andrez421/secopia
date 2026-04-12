/**
 * Custom error types for Socrata API interactions.
 */

/**
 * Error thrown when the Socrata API returns a non-OK response.
 * Includes the HTTP status code and raw response body for debugging.
 */
export class SocrataError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = "SocrataError";
  }
}
