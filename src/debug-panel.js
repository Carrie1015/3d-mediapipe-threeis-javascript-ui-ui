import { BUDDHA_INFO } from "./config.js?v=solid-original-preview-3";

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
      bottom: 20px;
      transform: translateX(-50%);
      z-index: 6;
      width: min(1120px, calc(100vw - 34px));
      pointer-events: auto;
      font: 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .model-switcher__models {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 9px;
      padding: 12px;
      background:
        linear-gradient(180deg, rgba(18, 16, 12, 0.72), rgba(3, 4, 7, 0.64)),
        rgba(0, 0, 0, 0.42);
      border: 1px solid rgba(216, 166, 74, 0.34);
      border-radius: 999px;
      box-shadow:
        0 -16px 48px rgba(0, 0, 0, 0.42),
        inset 0 1px 0 rgba(255, 235, 194, 0.1),
        inset 0 -1px 0 rgba(121, 78, 18, 0.18);
      backdrop-filter: blur(18px) saturate(130%);
    }

    .model-switcher button {
      min-width: 94px;
      height: 36px;
      padding: 0 16px;
      border: 1px solid rgba(209, 166, 88, 0.32);
      border-radius: 999px;
      color: rgba(241, 218, 176, 0.82);
      background: linear-gradient(180deg, rgba(28, 24, 18, 0.74), rgba(8, 9, 13, 0.66));
      font: inherit;
      letter-spacing: 0;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(255, 239, 201, 0.06);
      transition: transform 160ms ease, border-color 160ms ease, color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    }

    .model-switcher button:hover {
      color: rgba(255, 237, 196, 0.98);
      background: linear-gradient(180deg, rgba(47, 37, 20, 0.82), rgba(14, 13, 14, 0.78));
      border-color: rgba(238, 184, 82, 0.6);
      transform: translateY(-1px);
    }

    .model-switcher button.is-active {
      color: #160f05;
      background: linear-gradient(180deg, #ffe19a 0%, #e4ae4e 44%, #b97722 100%);
      border-color: rgba(255, 229, 160, 0.96);
      box-shadow:
        0 0 24px rgba(226, 163, 65, 0.34),
        inset 0 1px 0 rgba(255, 247, 212, 0.44);
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
