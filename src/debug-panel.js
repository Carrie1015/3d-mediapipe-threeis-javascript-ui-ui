import { BUDDHA_INFO } from "./config.js?v=switch-return-only-1";

export function createDebugPanel(defaults, models, callbacks) {
  injectPanelStyles();

  const params = { ...defaults };
  const panel = document.createElement("nav");
  panel.className = "model-switcher";
  panel.setAttribute("aria-label", "佛像模型切换");
  panel.innerHTML = `<div class="model-switcher__models"></div>`;

  const modelSwitcher = panel.querySelector(".model-switcher__models");
  let activeModelId = models[0]?.id;
  renderSwitcherInfo(activeModelId);

  for (const model of models) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = model.label;
    button.dataset.modelId = model.id;
    button.className = model.id === activeModelId ? "is-active" : "";
    modelSwitcher.appendChild(button);
  }

  panel.addEventListener("click", (event) => {
    const modelId = event.target.closest("[data-model-id]")?.dataset.modelId;
    if (!modelId || modelId === activeModelId) return;

    const selectedModel = models.find((model) => model.id === modelId);
    if (!selectedModel) return;

    activeModelId = modelId;
    syncModelButtons(panel, activeModelId);
    renderSwitcherInfo(modelId);
    callbacks.onSelect?.(selectedModel);
    callbacks.onModelChange?.(selectedModel);
  });

  document.body.appendChild(panel);
  callbacks.onChange(params);
  return params;
}

function renderSwitcherInfo(modelId) {
  const infoPanel = document.getElementById("buddhaInfo");
  const info = BUDDHA_INFO[modelId];
  if (!infoPanel || !info) return;

  infoPanel.innerHTML = `
    <p class="info-panel__roman">${info.roman}</p>
    <h1>${info.title}</h1>
    <p class="info-panel__alias">${info.alias}</p>
    <div class="info-panel__meta">
      <span>${info.direction}</span>
      <span>${info.wisdom}</span>
    </div>
    <p class="info-panel__summary">${info.summary}</p>
    <ul>
      ${info.points.map((point) => `<li>${point}</li>`).join("")}
    </ul>
  `;
}

function syncModelButtons(panel, activeModelId) {
  panel.querySelectorAll("[data-model-id]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.modelId === activeModelId);
  });
}

function injectPanelStyles() {
  if (document.getElementById("model-switcher-styles")) return;

  const style = document.createElement("style");
  style.id = "model-switcher-styles";
  style.textContent = `
    .model-switcher {
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      z-index: 6;
      width: min(1040px, calc(100vw - 32px));
      pointer-events: auto;
      font: 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .model-switcher__models {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      padding: 10px;
      background: rgba(5, 7, 11, 0.56);
      border: 1px solid rgba(210, 170, 94, 0.28);
      border-radius: 8px;
      box-shadow: 0 -14px 42px rgba(0, 0, 0, 0.38);
      backdrop-filter: blur(14px);
    }

    .model-switcher button {
      min-width: 92px;
      height: 34px;
      padding: 0 14px;
      border: 1px solid rgba(207, 163, 82, 0.34);
      border-radius: 6px;
      color: rgba(243, 219, 174, 0.88);
      background: rgba(14, 16, 22, 0.7);
      font: inherit;
      cursor: pointer;
    }

    .model-switcher button:hover {
      color: rgba(255, 237, 196, 0.98);
      background: rgba(32, 26, 18, 0.82);
      border-color: rgba(238, 184, 82, 0.6);
    }

    .model-switcher button.is-active {
      color: #111;
      background: linear-gradient(180deg, #f6c766 0%, #d49535 100%);
      border-color: rgba(255, 219, 138, 0.92);
      box-shadow: 0 0 20px rgba(226, 163, 65, 0.24);
    }

    @media (max-width: 720px) {
      .model-switcher {
        bottom: 10px;
        width: calc(100vw - 20px);
      }

      .model-switcher__models {
        justify-content: flex-start;
        overflow-x: auto;
        flex-wrap: nowrap;
        padding: 8px;
      }

      .model-switcher button {
        flex: 0 0 auto;
        min-width: 86px;
      }
    }
  `;
  document.head.appendChild(style);
}
