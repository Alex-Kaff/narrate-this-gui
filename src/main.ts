import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Provider, SavedConfig, PipelineEvent, GenerationRecord } from "./types";
import { renderProvidersTab } from "./providers";
import {
  renderBuildTab,
  buildGenerateConfig,
  createDefaultBuildState,
  type BuildState,
} from "./build";
import { renderHistoryTab } from "./history";
import { escapeHtml, showToast } from "./utils";

let providers: Provider[] = [];
let generations: GenerationRecord[] = [];
let buildState: BuildState = createDefaultBuildState();
let defaultVideoDir = "";
let activeTab: "build" | "providers" | "history" = "build";
let isGenerating = false;
let containerEl: HTMLElement;

function generateOutputPath(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const sep = defaultVideoDir.includes("\\") ? "\\" : "/";
  return `${defaultVideoDir}${sep}narration_${ts}.mp4`;
}

async function loadData() {
  try {
    defaultVideoDir = await invoke<string>("get_default_video_dir");
  } catch {
    defaultVideoDir = "";
  }

  try {
    const config = await invoke<SavedConfig>("load_config");
    providers = config.providers || [];
    generations = config.generations || [];

    if (defaultVideoDir) {
      buildState.video_path = generateOutputPath();
    }
    if (config.default_audio_dir) {
      buildState.audio_dir = config.default_audio_dir;
      buildState.save_audio = true;
    }
  } catch (e) {
    showToast(`Failed to load config: ${e}`);
  }
}

async function saveConfig() {
  const config: SavedConfig = {
    providers,
    generations,
    default_audio_dir: buildState.save_audio ? buildState.audio_dir : undefined,
  };
  await invoke("save_config", { config });
}

function render() {
  document.querySelectorAll(".tab-bar button").forEach((btn) => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.tab === activeTab);
  });

  if (activeTab === "providers") {
    renderProvidersTab(containerEl, providers, () => saveConfig());
  } else if (activeTab === "history") {
    renderHistoryTab(containerEl, generations, (idx) => {
      generations.splice(idx, 1);
      saveConfig();
      render();
    });
  } else {
    renderBuildTab(containerEl, buildState, providers, startGeneration, isGenerating);
  }
}

async function startGeneration() {
  if (isGenerating) return;

  try {
    const config = buildGenerateConfig(buildState, providers);

    isGenerating = true;
    render(); // Re-render to disable the button

    const overlay = document.getElementById("progress-overlay")!;
    const log = document.getElementById("progress-log")!;
    const closeBtn = document.getElementById("btn-close-progress")!;

    overlay.classList.remove("hidden");
    closeBtn.classList.add("hidden");
    log.innerHTML = "";

    function addLog(stage: string, message: string, cls = "") {
      const entry = document.createElement("div");
      entry.className = `log-entry ${cls}`;
      entry.innerHTML = `<span class="stage">[${escapeHtml(stage)}]</span>${escapeHtml(message)}`;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }

    const unlisten = await listen<PipelineEvent>("pipeline-progress", (event) => {
      addLog(event.payload.stage, event.payload.message);
    });

    try {
      addLog("init", "Starting pipeline...");
      const result = await invoke<string>("generate", { config });
      addLog("done", `Complete! Output: ${result}`, "done");

      let title = "Narration";
      if (buildState.content.type === "url" && buildState.content.url) {
        title = buildState.content.url;
      } else if (buildState.content.type === "text" && buildState.content.text) {
        title = buildState.content.text.slice(0, 80);
        if (buildState.content.text.length > 80) title += "...";
      }
      generations.push({
        path: result,
        created_at: new Date().toISOString(),
        title,
      });
      await saveConfig();

      if (defaultVideoDir) {
        buildState.video_path = generateOutputPath();
      }
    } catch (e) {
      addLog("error", `${e}`, "error");
    } finally {
      unlisten();
      isGenerating = false;
      closeBtn.classList.remove("hidden");
      closeBtn.addEventListener("click", () => {
        overlay.classList.add("hidden");
        render(); // Re-render to re-enable the button
      }, { once: true });
    }
  } catch (e) {
    isGenerating = false;
    showToast(`${e}`);
    render();
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  containerEl = document.getElementById("tab-content")!;

  await loadData();

  document.querySelectorAll(".tab-bar button").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = (btn as HTMLElement).dataset.tab as typeof activeTab;
      render();
    });
  });

  render();
});
