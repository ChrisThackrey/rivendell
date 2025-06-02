// Re-enabled Sentry import with Next.js instrumentation API
import * as Sentry from "@sentry/nextjs";

/**
 * Error reporting module with Sentry integration
 * This uses the Next.js instrumentation API for Sentry
 */

/**
 * Captures an exception and provides additional context
 *
 * @param error - The error to capture
 * @param context - Additional context data to include with the error
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>,
) {
  // Convert unknown errors to Error objects
  const errorObject =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Unknown error");

  // Log to console for local debugging
  console.error("ERROR:", errorObject);
  if (context) {
    console.error("Additional context:", context);
  }

  // Report to Sentry with context
  Sentry.captureException(errorObject, {
    extra: context
  });

  return errorObject;
}

/**
 * Sets user information for tracking issues by user
 * Currently just logs to console
 *
 * @param userData - User data to associate with subsequent errors
 */
export function setUserContext(userData: {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}) {
  // Set user context in Sentry
  Sentry.setUser(userData);
  console.log("User context set:", userData);
}

/**
 * Manually records a breadcrumb which will be attached to future errors
 * Currently just logs to console
 *
 * @param breadcrumb - The breadcrumb data to record
 */
export function addBreadcrumb(breadcrumb: {
  type?: string;
  category?: string;
  message: string;
  data?: Record<string, unknown>;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
}) {
  // Add breadcrumb to Sentry
  Sentry.addBreadcrumb(breadcrumb);
  console.log("Breadcrumb added:", breadcrumb);
}

/**
 * Wraps an async function with error reporting
 *
 * @param fn - The async function to wrap
 * @returns The wrapped function with error reporting
 */
export function withErrorReporting<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return (await fn(...args)) as ReturnType<T>;
    } catch (error) {
      // Create a context object with argument indices as keys
      const argsContext: Record<string, unknown> = {};
      args.forEach((arg, index) => {
        argsContext[`arg${index}`] = arg;
      });
      captureException(error, { argsContext });
      throw error;
    }
  };
}
