"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { RegionFallback } from "./region-fallback";

export interface ErrorBoundaryProps {
  /** Lower-case name of the region, used in the message and the console line ("table list"). */
  region: string;
  /** `data-testid` of the fallback. */
  testId: string;
  /** When any value changes (e.g. the schema fingerprint after an import), the region retries. */
  resetKeys?: readonly unknown[];
  /** Regions inside a sheet or dialog: the fallback gets a Close button, and Escape closes too. */
  onClose?: () => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
  error: unknown;
}

/**
 * Keeps a rendering failure in one region (canvas, table list, inspector, issues, search, import)
 * from taking down the whole workspace (ADR-020). Logs one `console.error` line per failure:
 * `SchemaFlow: the <region> could not be displayed.` "Try again" renders the region again; if it
 * still throws, the fallback simply shows again (React renders the children once per attempt).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      `SchemaFlow: the ${this.props.region} could not be displayed.`,
      error,
      info.componentStack,
    );
  }

  override componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && !sameKeys(previous.resetKeys, this.props.resetKeys)) this.retry();
  }

  private retry = () => this.setState({ failed: false, error: null });

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <RegionFallback
        region={this.props.region}
        testId={this.props.testId}
        error={this.state.error}
        onRetry={this.retry}
        {...(this.props.onClose ? { onClose: this.props.onClose } : {})}
      />
    );
  }
}

function sameKeys(a: readonly unknown[] = [], b: readonly unknown[] = []): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}
