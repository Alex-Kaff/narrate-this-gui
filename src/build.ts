import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  Provider,
  ContentConfig,
  LocalMediaFile,
  GenerateConfig,
  TtsConfig,
  MediaConfig,
  FirecrawlConfig,
} from "./types";
import { escapeHtml } from "./utils";

export interface BuildState {
  content: ContentConfig;
  tts_provider_id: string;
  enhancement_enabled: boolean;
  enhancement_provider_id: string;
  enhancement_instructions: string;
  media_enabled: boolean;
  media_type: "pexels" | "local";
  media_pexels_provider_id: string;
  media_llm_provider_id: string;
  media_files: LocalMediaFile[];
  media_pexels_fallback: boolean;
  media_fallback_provider_id: string;
  firecrawl_provider_id: string;
  video_path: string;
  save_audio: boolean;
  audio_dir?: string;
}

export function createDefaultBuildState(): BuildState {
  return {
    content: { type: "text", text: "" },
    tts_provider_id: "",
    enhancement_enabled: false,
    enhancement_provider_id: "",
    enhancement_instructions: "",
    media_enabled: false,
    media_type: "pexels",
    media_pexels_provider_id: "",
    media_llm_provider_id: "",
    media_files: [],
    media_pexels_fallback: false,
    media_fallback_provider_id: "",
    firecrawl_provider_id: "",
    video_path: "output.mp4",
    save_audio: false,
    audio_dir: undefined,
  };
}

const openSections = new Set<string>(["content", "tts"]);

function providerOptions(providers: Provider[], types: string[], selectedId: string): string {
  const filtered = providers.filter((p) => types.includes(p.type));
  return (
    `<option value="">-- Select --</option>` +
    filtered
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(p.name || "(unnamed)")}</option>`
      )
      .join("")
  );
}

export function renderBuildTab(
  container: HTMLElement,
  state: BuildState,
  providers: Provider[],
  onGenerate: () => void,
  isGenerating: boolean
) {
  const sections = [
    { id: "content", title: "Content", required: true },
    { id: "tts", title: "TTS", required: true },
    { id: "enhancement", title: "Enhancement", required: false },
    { id: "media", title: "Media", required: false },
    { id: "output", title: "Output", required: true },
  ];

  container.innerHTML = `
    <div class="build-tab">
      ${sections
        .map(
          (s) => `
        <div class="pipeline-section ${openSections.has(s.id) ? "open" : ""}" data-section="${s.id}">
          <div class="section-header">
            <span class="section-label">${s.title}${s.required ? "" : " (optional)"}</span>
            <span class="section-chevron">&#9662;</span>
          </div>
          <div class="section-body" id="section-${s.id}"></div>
        </div>
      `
        )
        .join("")}
      <button class="btn btn-primary btn-generate" id="btn-generate" ${isGenerating ? "disabled" : ""}>
        ${isGenerating ? "Generating..." : "Generate"}
      </button>
    </div>
  `;

  // Section toggle
  container.querySelectorAll(".section-header").forEach((header) => {
    header.addEventListener("click", () => {
      const section = header.closest(".pipeline-section")!;
      const id = section.getAttribute("data-section")!;
      if (openSections.has(id)) {
        openSections.delete(id);
        section.classList.remove("open");
      } else {
        openSections.add(id);
        section.classList.add("open");
      }
    });
  });

  // Render sections
  renderContentSection(container.querySelector("#section-content")!, state, providers);
  renderTtsSection(container.querySelector("#section-tts")!, state, providers);
  renderEnhancementSection(container.querySelector("#section-enhancement")!, state, providers);
  renderMediaSection(container.querySelector("#section-media")!, state, providers);
  renderOutputSection(container.querySelector("#section-output")!, state);

  container.querySelector("#btn-generate")!.addEventListener("click", onGenerate);
}

function renderContentSection(el: HTMLElement, state: BuildState, providers: Provider[]) {
  el.innerHTML = `
    <div class="toggle-group" id="content-toggle">
      <button data-value="url" class="${state.content.type === "url" ? "active" : ""}">Article URL</button>
      <button data-value="text" class="${state.content.type === "text" ? "active" : ""}">Raw Text</button>
    </div>
    <div id="content-fields"></div>
  `;

  const renderFields = () => {
    const fields = el.querySelector("#content-fields")!;
    if (state.content.type === "url") {
      fields.innerHTML = `
        <div class="field">
          <label>URL</label>
          <input type="url" id="content-url" placeholder="https://example.com/article" value="${escapeHtml(state.content.url || "")}" />
        </div>
        <div class="field">
          <label>Firecrawl Provider</label>
          <select id="content-firecrawl">${providerOptions(providers, ["firecrawl"], state.firecrawl_provider_id)}</select>
        </div>
      `;
      fields.querySelector("#content-url")!.addEventListener("input", (e) => {
        state.content.url = (e.target as HTMLInputElement).value;
      });
      fields.querySelector("#content-firecrawl")!.addEventListener("change", (e) => {
        state.firecrawl_provider_id = (e.target as HTMLSelectElement).value;
      });
    } else {
      fields.innerHTML = `
        <div class="field">
          <label>Text</label>
          <textarea id="content-text" rows="5" placeholder="Enter narration text...">${escapeHtml(state.content.text || "")}</textarea>
        </div>
      `;
      fields.querySelector("#content-text")!.addEventListener("input", (e) => {
        state.content.text = (e.target as HTMLTextAreaElement).value;
      });
    }
  };

  el.querySelectorAll("#content-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.content.type = (btn as HTMLElement).dataset.value as "url" | "text";
      el.querySelectorAll("#content-toggle button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderFields();
    });
  });

  renderFields();
}

function renderTtsSection(el: HTMLElement, state: BuildState, providers: Provider[]) {
  el.innerHTML = `
    <div class="field">
      <label>Provider</label>
      <select id="tts-provider">${providerOptions(providers, ["tts_elevenlabs", "tts_openai"], state.tts_provider_id)}</select>
    </div>
  `;
  el.querySelector("#tts-provider")!.addEventListener("change", (e) => {
    state.tts_provider_id = (e.target as HTMLSelectElement).value;
  });
}

function renderEnhancementSection(el: HTMLElement, state: BuildState, providers: Provider[]) {
  el.innerHTML = `
    <div class="checkbox-field">
      <input type="checkbox" id="enh-enabled" ${state.enhancement_enabled ? "checked" : ""} />
      <label for="enh-enabled">Enable text enhancement</label>
    </div>
    <div id="enh-fields" class="${state.enhancement_enabled ? "" : "hidden"}">
      <div class="field">
        <label>LLM Provider</label>
        <select id="enh-provider">${providerOptions(providers, ["llm"], state.enhancement_provider_id)}</select>
      </div>
      <div class="field">
        <label>Instructions</label>
        <textarea id="enh-instructions" rows="3" placeholder="Rewrite in a more engaging tone...">${escapeHtml(state.enhancement_instructions)}</textarea>
      </div>
    </div>
  `;

  el.querySelector("#enh-enabled")!.addEventListener("change", (e) => {
    state.enhancement_enabled = (e.target as HTMLInputElement).checked;
    el.querySelector("#enh-fields")!.classList.toggle("hidden", !state.enhancement_enabled);
  });
  el.querySelector("#enh-provider")!.addEventListener("change", (e) => {
    state.enhancement_provider_id = (e.target as HTMLSelectElement).value;
  });
  el.querySelector("#enh-instructions")!.addEventListener("input", (e) => {
    state.enhancement_instructions = (e.target as HTMLTextAreaElement).value;
  });
}

function renderMediaSection(el: HTMLElement, state: BuildState, providers: Provider[]) {
  el.innerHTML = `
    <div class="checkbox-field">
      <input type="checkbox" id="media-enabled" ${state.media_enabled ? "checked" : ""} />
      <label for="media-enabled">Enable media</label>
    </div>
    <div id="media-fields" class="${state.media_enabled ? "" : "hidden"}">
      <div class="toggle-group" id="media-toggle">
        <button data-value="pexels" class="${state.media_type === "pexels" ? "active" : ""}">Pexels Stock</button>
        <button data-value="local" class="${state.media_type === "local" ? "active" : ""}">Local Images</button>
      </div>
      <div id="media-type-fields"></div>
    </div>
  `;

  const renderTypeFields = () => {
    const tf = el.querySelector("#media-type-fields")!;
    if (state.media_type === "pexels") {
      tf.innerHTML = `
        <div class="field">
          <label>Pexels Provider</label>
          <select id="media-pexels">${providerOptions(providers, ["pexels"], state.media_pexels_provider_id)}</select>
        </div>
        <div class="field">
          <label>LLM Provider (keyword extraction)</label>
          <select id="media-llm">${providerOptions(providers, ["llm"], state.media_llm_provider_id)}</select>
        </div>
      `;
      tf.querySelector("#media-pexels")!.addEventListener("change", (e) => {
        state.media_pexels_provider_id = (e.target as HTMLSelectElement).value;
      });
      tf.querySelector("#media-llm")!.addEventListener("change", (e) => {
        state.media_llm_provider_id = (e.target as HTMLSelectElement).value;
      });
    } else {
      tf.innerHTML = `
        <div class="field">
          <label>LLM Provider (asset matching)</label>
          <select id="media-llm">${providerOptions(providers, ["llm"], state.media_llm_provider_id)}</select>
        </div>
        <div class="field">
          <label>Images</label>
          <div id="file-list" class="file-list"></div>
          <button class="btn btn-secondary btn-small" id="btn-add-files">Add Images...</button>
        </div>
        <div class="checkbox-field" style="margin-top: 12px;">
          <input type="checkbox" id="pexels-fallback" ${state.media_pexels_fallback ? "checked" : ""} />
          <label for="pexels-fallback">Fall back to Pexels for unmatched</label>
        </div>
        <div id="fallback-fields" class="${state.media_pexels_fallback ? "" : "hidden"}">
          <div class="field">
            <label>Pexels Provider (fallback)</label>
            <select id="media-fallback-pexels">${providerOptions(providers, ["pexels"], state.media_fallback_provider_id)}</select>
          </div>
        </div>
      `;

      tf.querySelector("#media-llm")!.addEventListener("change", (e) => {
        state.media_llm_provider_id = (e.target as HTMLSelectElement).value;
      });

      renderFileList(tf.querySelector("#file-list")!, state.media_files);

      tf.querySelector("#btn-add-files")!.addEventListener("click", async () => {
        const selected = await open({
          multiple: true,
          filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
        });
        if (selected) {
          const paths = Array.isArray(selected) ? selected : [selected];
          for (const p of paths) state.media_files.push({ path: p, description: "" });
          renderFileList(tf.querySelector("#file-list")!, state.media_files);
        }
      });

      tf.querySelector("#pexels-fallback")!.addEventListener("change", (e) => {
        state.media_pexels_fallback = (e.target as HTMLInputElement).checked;
        tf.querySelector("#fallback-fields")!.classList.toggle("hidden", !state.media_pexels_fallback);
      });

      // Always attach the fallback provider listener (fixes bug where it was
      // only attached when state.media_pexels_fallback was already true)
      tf.querySelector("#media-fallback-pexels")!.addEventListener("change", (e) => {
        state.media_fallback_provider_id = (e.target as HTMLSelectElement).value;
      });
    }
  };

  el.querySelector("#media-enabled")!.addEventListener("change", (e) => {
    state.media_enabled = (e.target as HTMLInputElement).checked;
    el.querySelector("#media-fields")!.classList.toggle("hidden", !state.media_enabled);
    if (state.media_enabled) renderTypeFields();
  });

  el.querySelectorAll("#media-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.media_type = (btn as HTMLElement).dataset.value as "pexels" | "local";
      el.querySelectorAll("#media-toggle button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTypeFields();
    });
  });

  if (state.media_enabled) renderTypeFields();
}

function renderFileList(container: HTMLElement, files: LocalMediaFile[]) {
  container.innerHTML = files
    .map(
      (f, i) => `
    <div class="file-item" data-index="${i}">
      <span class="file-name" title="${escapeHtml(f.path)}">${escapeHtml(f.path.split(/[\\/]/).pop() || "")}</span>
      <input type="text" placeholder="Description..." value="${escapeHtml(f.description)}" data-index="${i}" />
      <button class="btn-remove" data-index="${i}">&times;</button>
    </div>
  `
    )
    .join("");

  container.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.index!);
      files[idx].description = (e.target as HTMLInputElement).value;
    });
  });

  container.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.index!);
      files.splice(idx, 1);
      renderFileList(container, files);
    });
  });
}

function renderOutputSection(el: HTMLElement, state: BuildState) {
  el.innerHTML = `
    <div class="field">
      <label>Video Output Path</label>
      <div class="path-row">
        <input type="text" id="output-video" value="${escapeHtml(state.video_path)}" placeholder="output.mp4" />
        <button class="btn btn-secondary btn-small" id="btn-pick-video">Browse</button>
      </div>
    </div>
    <div class="checkbox-field">
      <input type="checkbox" id="save-audio" ${state.save_audio ? "checked" : ""} />
      <label for="save-audio">Save audio separately</label>
    </div>
    <div id="audio-fields" class="${state.save_audio ? "" : "hidden"}">
      <div class="field">
        <label>Audio Directory</label>
        <div class="path-row">
          <input type="text" id="output-audio" value="${escapeHtml(state.audio_dir || "")}" placeholder="./audio_output" />
          <button class="btn btn-secondary btn-small" id="btn-pick-audio">Browse</button>
        </div>
      </div>
    </div>
  `;

  el.querySelector("#output-video")!.addEventListener("input", (e) => {
    state.video_path = (e.target as HTMLInputElement).value;
  });

  el.querySelector("#btn-pick-video")!.addEventListener("click", async () => {
    const path = await save({
      filters: [{ name: "Video", extensions: ["mp4"] }],
      defaultPath: state.video_path || "output.mp4",
    });
    if (path) {
      state.video_path = path;
      (el.querySelector("#output-video") as HTMLInputElement).value = path;
    }
  });

  el.querySelector("#save-audio")!.addEventListener("change", (e) => {
    state.save_audio = (e.target as HTMLInputElement).checked;
    el.querySelector("#audio-fields")!.classList.toggle("hidden", !state.save_audio);
  });

  el.querySelector("#btn-pick-audio")!.addEventListener("click", async () => {
    const path = await open({ directory: true });
    if (path) {
      state.audio_dir = path;
      (el.querySelector("#output-audio") as HTMLInputElement).value = path;
    }
  });

  el.querySelector("#output-audio")?.addEventListener("input", (e) => {
    state.audio_dir = (e.target as HTMLInputElement).value || undefined;
  });
}

export function buildGenerateConfig(state: BuildState, providers: Provider[]): GenerateConfig {
  const find = (id: string) => providers.find((p) => p.id === id);

  // Content
  const content = state.content;
  if (content.type === "url" && !content.url?.trim()) throw new Error("No URL provided");
  if (content.type === "text" && !content.text?.trim()) throw new Error("No text provided");

  // Firecrawl (required for URL content)
  let firecrawl: FirecrawlConfig | undefined;
  if (content.type === "url") {
    const fcP = find(state.firecrawl_provider_id);
    if (!fcP) throw new Error("URL content requires a Firecrawl provider");
    firecrawl = { base_url: fcP.base_url || "http://localhost:3002" };
  }

  // TTS
  const ttsP = find(state.tts_provider_id);
  if (!ttsP) throw new Error("No TTS provider selected");

  let tts: TtsConfig;
  if (ttsP.type === "tts_elevenlabs") {
    tts = {
      type: "elevenlabs",
      api_key: ttsP.api_key || "",
      voice_id: ttsP.voice_id,
      model_id: ttsP.model_id,
      speed: ttsP.speed,
    };
  } else {
    tts = {
      type: "openai",
      api_key: ttsP.api_key || "",
      base_url: ttsP.base_url,
      model: ttsP.model,
      voice: ttsP.voice,
      speed: ttsP.speed,
    };
  }

  const config: GenerateConfig = {
    content,
    tts,
    firecrawl,
    output: {
      video_path: state.video_path,
      audio_dir: state.save_audio ? state.audio_dir : undefined,
    },
  };

  // Enhancement
  if (state.enhancement_enabled) {
    const enhP = find(state.enhancement_provider_id);
    if (!enhP) throw new Error("Enhancement enabled but no LLM provider selected");
    config.enhancement = {
      api_key: enhP.api_key || "",
      base_url: enhP.base_url,
      model: enhP.model,
      instructions: state.enhancement_instructions,
    };
  }

  // Media
  if (state.media_enabled) {
    if (state.media_type === "pexels") {
      const pexP = find(state.media_pexels_provider_id);
      const llmP = find(state.media_llm_provider_id);
      if (!pexP) throw new Error("Media enabled but no Pexels provider selected");
      if (!llmP) throw new Error("Media enabled but no LLM provider selected");
      config.media = {
        type: "pexels",
        api_key: pexP.api_key,
        llm_api_key: llmP.api_key,
        llm_base_url: llmP.base_url,
        llm_model: llmP.model,
      };
    } else {
      const llmP = find(state.media_llm_provider_id);
      if (!llmP) throw new Error("Media enabled but no LLM provider selected");
      const media: MediaConfig = {
        type: "local",
        files: state.media_files,
        llm_api_key: llmP.api_key,
        llm_base_url: llmP.base_url,
        llm_model: llmP.model,
      };
      if (state.media_pexels_fallback) {
        const fbP = find(state.media_fallback_provider_id);
        if (fbP) media.pexels_fallback = { api_key: fbP.api_key || "" };
      }
      config.media = media;
    }
  }

  return config;
}
