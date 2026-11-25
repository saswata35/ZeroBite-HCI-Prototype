/**
 * ZeroBite Campus — Empirical HCI Telemetry Engine
 * Captures interaction timestamps, action counts, and error recoveries for lab evaluation.
 */
class HciTelemetry {
  constructor() {
    this.sessionStart = Date.now();
    this.interactionCount = 0;
    this.undoCount = 0;
    this.events = [
      { timestampSec: 0.0, action: "SESSION_INIT", detail: "Task started: Order Lunch" }
    ];
    this.startClock();
  }

  startClock() {
    setInterval(() => {
      const timeEl = document.getElementById("telemetryTime");
      if (timeEl) {
        timeEl.textContent = `${this.getElapsedSeconds()}s`;
      }
    }, 250);
  }

  getElapsedSeconds() {
    return Number(((Date.now() - this.sessionStart) / 1000).toFixed(1));
  }

  record(action, detail) {
    this.interactionCount++;
    const elapsed = this.getElapsedSeconds();
    this.events.unshift({ timestampSec: elapsed, action, detail });

    document.getElementById("clickCountBadge").textContent = this.interactionCount;
    document.getElementById("telemetryClicks").textContent = this.interactionCount;

    const logList = document.getElementById("eventLog");
    if (logList) {
      const li = document.createElement("li");
      li.textContent = `[${elapsed.toFixed(1)}s] ${detail}`;
      logList.prepend(li);
    }
  }

  recordUndo(itemName) {
    this.undoCount++;
    document.getElementById("telemetryUndos").textContent = this.undoCount;
    this.record("ERROR_RECOVERY_UNDO", `Restored "${itemName}" via Undo`);
  }

  exportSessionJson() {
    const report = {
      project: "ZeroBite Campus HCI Prototype",
      exportedAt: new Date().toISOString(),
      summaryMetrics: {
        totalElapsedSeconds: this.getElapsedSeconds(),
        totalInteractions: this.interactionCount,
        undoRecoveries: this.undoCount,
        wcagMinTargetPx: 48
      },
      eventStream: [...this.events].reverse()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zerobite-hci-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.record("TELEMETRY_EXPORT", "Exported session JSON log");
  }
}

const telemetry = new HciTelemetry();