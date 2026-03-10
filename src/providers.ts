import type { Provider } from "./types";
import { escapeHtml, debounce } from "./utils";

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  tts_elevenlabs: "ElevenLabs TTS",
  tts_openai: "OpenAI-Compatible TTS",
  llm: "LLM (OpenAI-Compatible)",
  pexels: "Pexels",
};

const PROVIDER_TYPE_OPTIONS = Object.entries(PROVIDER_TYPE_LABELS);

let expandedId: string | null = null;

export function renderProvidersTab(
  container: HTMLElement,
  providers: Provider[],
  onSave: () => void
) {
  const debouncedSave = debounce(onSave, 300);

  container.innerHTML = `
    <div class="providers-tab">
      <div class="tab-header-row">
        <h2>Providers</h2>
        <div class="add-provider-row">
          <select id="new-provider-type">
            ${PROVIDER_TYPE_OPTIONS.map(([val, label]) => `<option value="${val}">${label}</option>`).join("")}
          </select>
          <button class="btn btn-primary btn-small" id="btn-add-provider">Add</button>
        </div>
      </div>
      <div id="provider-list"></div>
    </div>
  `;

  const renderList = () => {
    const list = container.querySelector("#provider-list")!;
    if (providers.length === 0) {
      list.innerHTML = `<p class="empty-state">No providers configured yet. Add one above.</p>`;
      return;
    }

    list.innerHTML = providers
      .map(
        (p) => `
      <div class="provider-card ${expandedId === p.id ? "open" : ""}" data-id="${p.id}">
        <div class="provider-header" data-id="${p.id}">
          <span class="provider-badge badge-${p.type}">${PROVIDER_TYPE_LABELS[p.type] || p.type}</span>
          <span class="provider-name">${escapeHtml(p.name || "(unnamed)")}</span>
          <button class="btn-remove provider-delete" data-id="${p.id}" title="Delete">&times;</button>
        </div>
        <div class="provider-body">
          ${renderProviderFields(p)}
        </div>
      </div>
    `
      )
      .join("");

    // Expand/collapse
    list.querySelectorAll(".provider-header").forEach((header) => {
      header.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).classList.contains("provider-delete")) return;
        const id = (header as HTMLElement).dataset.id!;
        expandedId = expandedId === id ? null : id;
        renderList();
      });
    });

    // Delete
    list.querySelectorAll(".provider-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id!;
        const idx = providers.findIndex((p) => p.id === id);
        if (idx >= 0) {
          providers.splice(idx, 1);
          if (expandedId === id) expandedId = null;
          onSave();
          renderList();
        }
      });
    });

    // Field editing — debounced save to avoid IPC on every keystroke
    list.querySelectorAll(".provider-body input").forEach((el) => {
      el.addEventListener("input", (e) => {
        const input = e.target as HTMLInputElement;
        const card = input.closest(".provider-card")!;
        const id = card.getAttribute("data-id")!;
        const field = input.dataset.field!;
        const provider = providers.find((p) => p.id === id);
        if (!provider) return;

        const val = input.value;
        if (field === "speed") {
          (provider as any)[field] = val ? parseFloat(val) : undefined;
        } else {
          (provider as any)[field] = val || undefined;
        }

        // Update name in header
        if (field === "name") {
          const nameEl = card.querySelector(".provider-name");
          if (nameEl) nameEl.textContent = val || "(unnamed)";
        }

        debouncedSave();
      });
    });
  };

  // Add provider
  container.querySelector("#btn-add-provider")!.addEventListener("click", () => {
    const typeSelect = container.querySelector("#new-provider-type") as HTMLSelectElement;
    const type = typeSelect.value as Provider["type"];
    const newProvider: Provider = {
      id: crypto.randomUUID(),
      name: "",
      type,
    };
    providers.push(newProvider);
    expandedId = newProvider.id;
    onSave();
    renderList();
  });

  renderList();
}

function renderProviderFields(provider: Provider): string {
  const field = (label: string, fieldName: string, type = "text", placeholder = "") => {
    const val = (provider as any)[fieldName] ?? "";
    return `
      <div class="field">
        <label>${label}</label>
        <input type="${type}" data-field="${fieldName}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(String(val))}" />
      </div>
    `;
  };

  let fields = field("Name", "name", "text", "My Provider");

  switch (provider.type) {
    case "tts_elevenlabs":
      fields += field("API Key", "api_key", "password");
      fields += field("Voice ID", "voice_id", "text", "Gr7mLjPA3HhuWxZidxPW");
      fields += field("Model", "model_id", "text", "eleven_flash_v2_5");
      fields += field("Speed", "speed", "number", "1.0");
      break;
    case "tts_openai":
      fields += field("API Key", "api_key", "password");
      fields += field("Base URL", "base_url", "text", "https://api.openai.com");
      fields += field("Model", "model", "text", "tts-1");
      fields += field("Voice", "voice", "text", "alloy");
      fields += field("Speed", "speed", "number", "1.0");
      break;
    case "llm":
      fields += field("API Key", "api_key", "password");
      fields += field("Base URL", "base_url", "text", "https://api.openai.com");
      fields += field("Model", "model", "text", "gpt-4o-mini");
      break;
    case "pexels":
      fields += field("API Key", "api_key", "password");
      break;
  }

  return fields;
}
