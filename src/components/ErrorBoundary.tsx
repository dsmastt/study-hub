import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Panel } from "./ui.tsx";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Study Hub view crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Panel>
          <div className="empty-state">
            <div className="empty-icon" style={{ color: "var(--danger)", borderColor: "rgba(var(--danger-rgb), 0.35)" }}>
              <AlertTriangle size={22} />
            </div>
            <h3>This view crashed</h3>
            <p>The rest of the app is still usable. The error is shown below so it can be fixed.</p>
            <div className="code-block" style={{ marginTop: 10, maxWidth: 720, whiteSpace: "pre-wrap", textAlign: "left" }}>
              {this.state.error.message}
              {this.state.error.stack ? `\n\n${this.state.error.stack.slice(0, 2000)}` : ""}
            </div>
            <div className="empty-action">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  this.setState({ error: null });
                  window.location.reload();
                }}
              >
                Reload view
              </Button>
            </div>
          </div>
        </Panel>
      );
    }
    return this.props.children;
  }
}
