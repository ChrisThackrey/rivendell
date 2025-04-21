"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to Sentry
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback UI or use provided fallback
      return (
        this.props.fallback || (
          <Card className="mx-auto my-12 max-w-lg">
            <CardHeader>
              <CardTitle className="text-xl text-center text-red-600">
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-red-50 rounded-md mb-4">
                <p className="text-sm text-red-800 font-mono overflow-auto">
                  {this.state.error?.toString() || "An unknown error occurred"}
                </p>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                The error has been reported to our team. Please try again or
                refresh the page.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button
                onClick={this.resetError}
                variant="outline"
                className="mr-2"
              >
                Try again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="default"
              >
                Refresh page
              </Button>
            </CardFooter>
          </Card>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
