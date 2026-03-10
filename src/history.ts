import { openPath } from "@tauri-apps/plugin-opener";
import type { GenerationRecord } from "./types";
import { escapeHtml, showToast } from "./utils";

export function renderHistoryTab(
  container: HTMLElement,
  generations: GenerationRecord[],
  onDelete: (index: number) => void
) {
  container.innerHTML = `
    <div class="history-tab">
      <h2>History</h2>
      <div id="history-list"></div>
    </div>
  `;

  const list = container.querySelector("#history-list")!;

  if (generations.length === 0) {
    list.innerHTML = `<p class="empty-state">No videos generated yet.</p>`;
    return;
  }

  // Show newest first
  const sorted = generations
    .map((g, i) => ({ ...g, _index: i }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  list.innerHTML = sorted
    .map(
      (g) => `
    <div class="history-item" data-index="${g._index}">
      <div class="history-info">
        <span class="history-title">${escapeHtml(g.title)}</span>
        <span class="history-meta">${formatDate(g.created_at)}</span>
        <span class="history-path">${escapeHtml(g.path)}</span>
      </div>
      <div class="history-actions">
        <button class="btn btn-primary btn-small history-open" data-path="${escapeHtml(g.path)}">Open</button>
        <button class="btn-remove history-delete" data-index="${g._index}" title="Remove">&times;</button>
      </div>
    </div>
  `
    )
    .join("");

  // Open buttons
  list.querySelectorAll(".history-open").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const path = (btn as HTMLElement).dataset.path!;
      try {
        await openPath(path);
      } catch (e) {
        showToast(`Failed to open: ${e}`);
      }
    });
  });

  // Delete buttons
  list.querySelectorAll(".history-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt((btn as HTMLElement).dataset.index!);
      onDelete(idx);
    });
  });
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
