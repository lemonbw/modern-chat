import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Shown instead of the error text, e.g. the chat area says "This chat failed to render". */
  title?: string;
  onReset?: () => void;
};

type State = { error: Error | null };

/**
 * Catches render errors below it so one broken chat cannot take the whole app down. React unmounts
 * the tree of a component that throws, so the fallback carries the only way out: a reset button.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Crash in a subtree", error, info.componentStack);
  }

  private readonly reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm">
        <p className="text-[#e4ebf0]">{this.props.title ?? "Something went wrong here"}</p>
        <p className="max-w-[420px] text-xs leading-5 text-[#91a2ae]">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="rounded-[9px] bg-[#2b5278] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#356391]"
        >
          Try again
        </button>
      </div>
    );
  }
}