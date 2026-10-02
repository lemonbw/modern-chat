import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

const Boom = () => {
  throw new Error("render failed");
};

describe("ErrorBoundary", () => {
  it("shows the fallback instead of the crashed subtree", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary title="This chat could not be displayed">
        <Boom />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert).toContain("This chat could not be displayed");
    expect(alert).toContain("render failed");
    consoleError.mockRestore();
  });

  it("renders the children while nothing throws", () => {
    render(<ErrorBoundary><p>chat</p></ErrorBoundary>);
    expect(screen.getByText("chat").textContent).toBe("chat");
  });

  it("calls onReset when the retry button is pressed", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onReset = vi.fn();
    render(<ErrorBoundary onReset={onReset}><Boom /></ErrorBoundary>);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});