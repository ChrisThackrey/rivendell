import * as Sentry from "@sentry/nextjs";

/**
 * Captures an exception with Sentry and provides additional context
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

  // Add additional context if provided
  if (context) {
    // Set extra context data directly with the error
    Object.entries(context).forEach(([key, value]) => {
      Sentry.setExtra(key, value);
    });
  }

  // Send the error to Sentry
  Sentry.captureException(errorObject);

  // Log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.error("Error captured and sent to Sentry:", errorObject);
    if (context) {
      console.error("Additional context:", context);
    }
  }

  return errorObject;
}

/**
 * Sets user information for Sentry, helpful for tracking issues by user
 *
 * @param userData - User data to associate with subsequent errors
 */
export function setUserContext(userData: {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}) {
  Sentry.setUser(userData);
}

/**
 * Manually records a breadcrumb which will be attached to future errors
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
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Wraps an async function with Sentry error reporting
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
