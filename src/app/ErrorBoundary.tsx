import React from "react";

/**
 * Keeps a render crash from turning the window into an invisible surface.
 *
 * The app window is transparent, so an unmounted React tree leaves literally
 * nothing on screen — the process is alive in the taskbar but there is no UI to
 * report anything. This boundary paints an opaque fallback instead, and shows
 * the message plus the component stack while running in dev.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; stack: string }
> {
  state: { error: Error | null; stack: string } = { error: null, stack: "" };

  static getDerivedStateFromError(error: Error) {
    return { error, stack: "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, stack: info.componentStack ?? "" });
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "auto",
          padding: 20,
          background: "#1b1d24",
          color: "#f2f4f8",
          fontFamily: "Consolas, ui-monospace, monospace",
          fontSize: 12,
          lineHeight: 1.5,
          borderRadius: 14,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Bili-MonitariNYA frontend error
        </div>
        <div style={{ color: "#ff8f9c", whiteSpace: "pre-wrap" }}>{error.message}</div>
        {import.meta.env.DEV && (
          <div style={{ marginTop: 12, color: "#9aa3b2", whiteSpace: "pre-wrap" }}>
            {error.stack}
            {stack}
          </div>
        )}
        <button
          onClick={() => this.setState({ error: null, stack: "" })}
          style={{
            marginTop: 16,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #4a4f5c",
            background: "#2a2d36",
            color: "#f2f4f8",
            cursor: "pointer",
          }}
        >
          重试
        </button>
      </div>
    );
  }
}
