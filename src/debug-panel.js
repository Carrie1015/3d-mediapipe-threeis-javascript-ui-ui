const STORAGE_KEY = "particle-motion-params-v2";

const CONTROL_GROUPS = [
  {
    title: "Motion",
    controls: [
      ["autoRotateSpeed", "旋转", 0, 0.006, 0.0001, 4],
      ["pointSize", "点大小", 1, 10, 0.1, 1],
      ["motionNoise", "微动", 0, 4, 0.05, 2],
    ],
  },
  {
    title: "Dissolve",
    controls: [
      ["verticalDelay", "纵向延迟", 0, 3.5, 0.05, 2],
      ["scatterDuration", "扩散时长", 0.25, 3, 0.05, 2],
      ["flowStrength", "扩散强度", 0, 3, 0.05, 2],
      ["flowLimit", "拖尾长度", 0.2, 3, 0.05, 2],
      ["filamentDensity", "丝线密度", 0.1, 4, 0.05, 2],
    ],
  },
  {
    title: "Return",
    controls: [
      ["returnStart", "回流开始", 1, 8, 0.05, 2],
      ["returnDuration", "回流时长", 0.3, 5, 0.05, 2],
    ],
  },
];

export function createDebugPanel(defaults, models, callbacks) {
  injectPanelStyles();

  const params = {
    ...defaults,
    ...readStoredParams(defaults),
  };
  const panel = document.createElement("aside");
  panel.className = "debug-panel";
  panel.innerHTML = `
    <header class="debug-panel__header">
      <strong>Particle</strong>
      <button class="debug-panel__toggle" type="button" aria-label="折叠参数面板">-</button>
    </header>
    <div class="debug-panel__models"></div>
    <div class="debug-panel__body"></div>
    <footer class="debug-panel__actions">
      <button type="button" data-action="burst">爆散</button>
      <button type="button" data-action="reset">重置</button>
    </footer>
  `;

  const body = panel.querySelector(".debug-panel__body");
  const modelSwitcher = panel.querySelector(".debug-panel__models");
  const controlsByKey = new Map();
  let activeModelId = models[0]?.id;

  for (const model of models) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = model.label;
    button.dataset.modelId = model.id;
    button.className = model.id === activeModelId ? "is-active" : "";
    modelSwitcher.appendChild(button);
  }

  for (const group of CONTROL_GROUPS) {
    const section = document.createElement("section");
    section.className = "debug-panel__group";
    section.innerHTML = `<h2>${group.title}</h2>`;

    for (const [key, label, min, max, step, digits] of group.controls) {
      const row = document.createElement("label");
      row.className = "debug-panel__row";
      row.innerHTML = `
        <span>${label}</span>
        <output>${formatValue(params[key], digits)}</output>
        <input
          type="range"
          min="${min}"
          max="${max}"
          step="${step}"
          value="${params[key]}"
          data-key="${key}"
          data-digits="${digits}"
        />
      `;
      section.appendChild(row);
      controlsByKey.set(key, row);
    }

    body.appendChild(section);
  }

  panel.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-key]");
    if (!input) return;

    const key = input.dataset.key;
    const digits = Number(input.dataset.digits);
    params[key] = Number(input.value);
    controlsByKey.get(key).querySelector("output").textContent = formatValue(params[key], digits);
    storeParams(params);
    callbacks.onChange(params);
  });

  panel.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const modelId = event.target.closest("[data-model-id]")?.dataset.modelId;
    if (modelId && modelId !== activeModelId) {
      activeModelId = modelId;
      syncModelButtons(panel, activeModelId);
      callbacks.onModelChange(models.find((model) => model.id === modelId));
    }
    if (action === "burst") callbacks.onBurst();
    if (action === "reset") {
      Object.assign(params, defaults);
      syncInputs(panel, params);
      storeParams(params);
      callbacks.onChange(params);
    }
  });

  panel.querySelector(".debug-panel__toggle").addEventListener("click", () => {
    panel.classList.toggle("is-collapsed");
  });

  document.body.appendChild(panel);
  callbacks.onChange(params);
  return params;
}

function readStoredParams(defaults) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(
      Object.keys(defaults)
        .filter((key) => Number.isFinite(stored[key]))
        .map((key) => [key, stored[key]])
    );
  } catch {
    return {};
  }
}

function storeParams(params) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Ignore storage failures; live tuning should still work.
  }
}

function syncInputs(panel, params) {
  panel.querySelectorAll("input[data-key]").forEach((input) => {
    const key = input.dataset.key;
    const digits = Number(input.dataset.digits);
    input.value = params[key];
    input.closest(".debug-panel__row").querySelector("output").textContent = formatValue(params[key], digits);
  });
}

function syncModelButtons(panel, activeModelId) {
  panel.querySelectorAll("[data-model-id]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.modelId === activeModelId);
  });
}

function formatValue(value, digits) {
  return Number(value).toFixed(digits).replace(/\.?0+$/, "");
}

function injectPanelStyles() {
  if (document.getElementById("debug-panel-styles")) return;

  const style = document.createElement("style");
  style.id = "debug-panel-styles";
  style.textContent = `
    .debug-panel {
      position: fixed;
      right: 14px;
      top: 14px;
      z-index: 4;
      width: min(300px, calc(100vw - 28px));
      max-height: calc(100vh - 28px);
      overflow: auto;
      color: rgba(233, 240, 255, 0.94);
      background: rgba(10, 14, 22, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.34);
      border-radius: 8px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(16px);
      font: 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .debug-panel__header,
    .debug-panel__models,
    .debug-panel__actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
    }

    .debug-panel__header {
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }

    .debug-panel__models {
      flex-wrap: wrap;
      justify-content: flex-start;
      padding: 10px 12px 6px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }

    .debug-panel__header strong {
      font-size: 13px;
      font-weight: 650;
      letter-spacing: 0;
    }

    .debug-panel button {
      min-width: 36px;
      height: 28px;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 6px;
      color: inherit;
      background: rgba(15, 23, 42, 0.78);
      font: inherit;
      cursor: pointer;
    }

    .debug-panel button:hover {
      background: rgba(30, 41, 59, 0.92);
    }

    .debug-panel button.is-active {
      border-color: rgba(147, 197, 253, 0.82);
      color: #bfdbfe;
      background: rgba(59, 130, 246, 0.2);
    }

    .debug-panel__body {
      padding: 4px 12px 2px;
    }

    .debug-panel__group {
      padding: 8px 0 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }

    .debug-panel__group h2 {
      margin: 0 0 8px;
      color: rgba(203, 213, 225, 0.86);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    .debug-panel__row {
      display: grid;
      grid-template-columns: 76px 42px 1fr;
      align-items: center;
      gap: 8px;
      min-height: 30px;
    }

    .debug-panel__row output {
      color: rgba(147, 197, 253, 0.94);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .debug-panel input[type="range"] {
      width: 100%;
      accent-color: #93c5fd;
    }

    .debug-panel__actions {
      justify-content: flex-end;
    }

    .debug-panel.is-collapsed .debug-panel__body,
    .debug-panel.is-collapsed .debug-panel__models,
    .debug-panel.is-collapsed .debug-panel__actions {
      display: none;
    }

    @media (max-width: 520px) {
      .debug-panel {
        left: 10px;
        right: 10px;
        top: 10px;
        width: auto;
      }
    }
  `;
  document.head.appendChild(style);
}
