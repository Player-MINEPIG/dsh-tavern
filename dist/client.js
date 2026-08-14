window.__ModuleLoader__.load({
	id: "dsh-tavern",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/client/src/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply2,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// packages/preset/src/client.js
var import_react = require("react");

// packages/preset/src/client-state.js
function reorder(items, from, to) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return items;
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}
function reorderAtBoundary(items, from, boundary) {
  if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > items.length) return items;
  const destination = boundary > from ? boundary - 1 : boundary;
  return reorder(items, from, destination);
}
function shouldUseFloatingPanel(sessionState) {
  const current = sessionState?.current;
  if (current === void 0 || current === null) return true;
  return sessionState.byId?.[current]?.blank === true;
}

// packages/preset/src/client.js
var API_ROOT = "/dsh-tavern/api";
var ST_NUMBER_FIELDS = [
  ["top_p", "Top P"],
  ["top_k", "Top K"],
  ["top_a", "Top A"],
  ["min_p", "Min P"],
  ["frequency_penalty", "Frequency penalty"],
  ["presence_penalty", "Presence penalty"],
  ["repetition_penalty", "Repetition penalty"],
  ["seed", "Seed"]
];
var css = `
.dtt-root{height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dtt-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dtt-title{font-size:14px;font-weight:650;flex:1;min-width:0}.dtt-active{font-size:11px;color:var(--dsw-alias-state-success);margin-left:7px}
.dtt-icon{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtt-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtt-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.dtt-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtt-button{height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-size:12px}.dtt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtt-button:disabled{opacity:.5;cursor:default}.dtt-button-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtt-danger{color:var(--dsw-alias-state-error)}
.dtt-field{display:flex;flex-direction:column;gap:5px}.dtt-label{font-size:11px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtt-input,.dtt-select,.dtt-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}.dtt-input,.dtt-select{height:34px;padding:0 9px}.dtt-textarea{min-height:110px;resize:vertical;padding:8px;line-height:1.45}.dtt-input:focus,.dtt-select:focus,.dtt-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.dtt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dtt-section{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtt-section-title{font-size:12px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.dtt-note{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin:0}.dtt-status{font-size:11px;line-height:1.4;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);word-break:break-word}.dtt-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtt-prompts{display:flex;flex-direction:column;gap:7px}.dtt-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;transition:border-color .12s,box-shadow .12s}.dtt-prompt[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dtt-prompt[data-dragging=true]>*{opacity:0}.dtt-drop-placeholder{box-sizing:border-box;height:42px;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);font-size:11px;font-weight:600;pointer-events:none}.dtt-prompt-summary{display:flex;align-items:center;gap:7px;padding:8px;cursor:pointer;font-size:12px}.dtt-prompt-summary::marker{color:var(--dsw-alias-label-tertiary)}.dtt-drag{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:grab;padding:1px 2px;font-size:15px;line-height:1;touch-action:none;user-select:none}.dtt-drag:active{cursor:grabbing}.dtt-prompt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtt-role{font-size:10px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}.dtt-prompt-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:8px}.dtt-row-actions{display:flex;gap:6px}.dtt-row-actions .dtt-button{height:28px;padding:0 8px;flex:1}
.dtt-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);display:grid;grid-template-columns:1fr auto;gap:8px}
.dtt-open-button{height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font-size:11px;cursor:pointer;padding:0 9px}.dtt-open-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtt-floating-layer{display:none;position:absolute;inset:0;pointer-events:none;z-index:5}[data-details-collapsed] .dtt-floating-layer{display:block}.dtt-floating-launcher{position:absolute;top:14px;right:16px;pointer-events:auto}.dtt-floating-button{height:32px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-2,0 4px 16px rgba(0,0,0,.16));color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;cursor:pointer;padding:0 12px}.dtt-floating-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtt-overlay-panel{position:absolute;top:0;right:0;bottom:0;width:min(420px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18))}
`;
async function api(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...options.body === void 0 ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  if (!response.ok || data.ok === false) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}
function body(value) {
  return JSON.stringify(value);
}
function Field({ label, children }) {
  return (0, import_react.createElement)(
    "label",
    { className: "dtt-field" },
    (0, import_react.createElement)("span", { className: "dtt-label" }, label),
    children
  );
}
function NumberField({ label, value, onChange, min, step = "any" }) {
  return (0, import_react.createElement)(Field, { label }, (0, import_react.createElement)("input", {
    className: "dtt-input",
    type: "number",
    value: value ?? "",
    min,
    step,
    onChange: (event) => onChange(event.target.value === "" ? void 0 : Number(event.target.value))
  }));
}
function PromptEditor({ prompt, index, dragging, onPatch, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDelete }) {
  return (0, import_react.createElement)(
    "details",
    {
      className: "dtt-prompt",
      "data-prompt-index": index,
      "data-dragging": dragging || void 0
    },
    (0, import_react.createElement)(
      "summary",
      { className: "dtt-prompt-summary" },
      (0, import_react.createElement)("button", {
        className: "dtt-drag",
        type: "button",
        title: "\u62D6\u62FD\u6392\u5217\u987A\u5E8F",
        "aria-label": `\u62D6\u62FD\u201C${prompt.name || prompt.identifier}\u201D\u6392\u5217\u987A\u5E8F`,
        "aria-pressed": dragging,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel
      }, "\u283F"),
      (0, import_react.createElement)("input", {
        type: "checkbox",
        checked: prompt.enabled === true,
        disabled: prompt.marker === true,
        title: prompt.marker === true ? "ST marker \u4E0D\u4F1A\u4F5C\u4E3A\u72EC\u7ACB\u63D0\u793A\u8BCD\u6CE8\u5165" : "\u542F\u7528\u63D0\u793A\u8BCD",
        onClick: (event) => event.stopPropagation(),
        onChange: (event) => onPatch({ enabled: event.target.checked })
      }),
      (0, import_react.createElement)("span", { className: "dtt-prompt-name" }, prompt.name || prompt.identifier),
      (0, import_react.createElement)("span", { className: "dtt-role" }, prompt.marker ? "marker" : prompt.role)
    ),
    (0, import_react.createElement)(
      "div",
      { className: "dtt-prompt-body" },
      (0, import_react.createElement)(Field, { label: "\u540D\u79F0" }, (0, import_react.createElement)("input", {
        className: "dtt-input",
        value: prompt.name,
        onChange: (event) => onPatch({ name: event.target.value })
      })),
      (0, import_react.createElement)(Field, { label: "\u89D2\u8272" }, (0, import_react.createElement)(
        "select",
        {
          className: "dtt-select",
          value: prompt.role,
          disabled: prompt.marker === true,
          onChange: (event) => onPatch({ role: event.target.value })
        },
        (0, import_react.createElement)("option", { value: "system" }, "System"),
        (0, import_react.createElement)("option", { value: "user" }, "User"),
        (0, import_react.createElement)("option", { value: "assistant" }, "Assistant")
      )),
      (0, import_react.createElement)(Field, { label: "\u5185\u5BB9" }, (0, import_react.createElement)("textarea", {
        className: "dtt-textarea",
        value: prompt.content,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ content: event.target.value })
      })),
      (0, import_react.createElement)(
        "div",
        { className: "dtt-row-actions" },
        (0, import_react.createElement)("button", { className: "dtt-button dtt-danger", type: "button", onClick: onDelete }, "\u5220\u9664")
      )
    )
  );
}
function DropPlaceholder() {
  return (0, import_react.createElement)("div", {
    className: "dtt-drop-placeholder",
    "aria-hidden": true
  }, "\u677E\u5F00\u540E\u653E\u7F6E\u4E8E\u6B64");
}
function insertionBoundary(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-prompt-index]");
  if (target === null) return null;
  const index = Number(target.dataset.promptIndex);
  const bounds = target.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? index : index + 1;
}
function PresetSidebar({ closePanel, openPanel, sessionId, autoOpen = true }) {
  const [catalog, setCatalog] = (0, import_react.useState)(null);
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [status, setStatus] = (0, import_react.useState)({ text: "\u52A0\u8F7D\u4E2D\u2026", error: false });
  const [advanced, setAdvanced] = (0, import_react.useState)(false);
  const [dragFrom, setDragFrom] = (0, import_react.useState)(null);
  const [dropIndex, setDropIndex] = (0, import_react.useState)(null);
  const fileRef = (0, import_react.useRef)(null);
  const refreshGeneration = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => {
    if (!autoOpen) return void 0;
    const timers = [0, 200, 800].map((delay) => window.setTimeout(openPanel, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [autoOpen]);
  const run = (0, import_react.useCallback)(async (operation, successText) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ text: successText, error: false });
      return result;
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const refresh = (0, import_react.useCallback)(async (preferredId) => {
    const generation = ++refreshGeneration.current;
    const data = await api("/presets");
    const id = preferredId === void 0 ? data.selectedId : preferredId;
    const detail = id === null || id === void 0 ? null : (await api(`/presets/${encodeURIComponent(id)}`)).preset;
    if (generation !== refreshGeneration.current) return false;
    setCatalog(data);
    setDraft(detail);
    return true;
  }, []);
  (0, import_react.useEffect)(() => {
    refreshGeneration.current += 1;
    setCatalog(null);
    setDraft(null);
    setStatus({ text: "\u6B63\u5728\u540C\u6B65\u5F53\u524D\u4F1A\u8BDD\u7684\u9884\u8BBE\u72B6\u6001\u2026", error: false });
    run(() => refresh(), "\u9884\u8BBE\u5DF2\u52A0\u8F7D");
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh, run, sessionId]);
  (0, import_react.useEffect)(() => {
    const onRefresh = () => run(() => refresh(), "\u9884\u8BBE\u72B6\u6001\u5DF2\u5237\u65B0");
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => window.removeEventListener("dsh-tavern:refresh", onRefresh);
  }, [refresh, run]);
  const choose = (0, import_react.useCallback)((id) => run(async () => {
    await api("/select", { method: "POST", body: body({ id: id || null }) });
    await refresh(id || null);
  }, id ? "\u9884\u8BBE\u5DF2\u9009\u62E9\uFF1B\u4E0B\u4E00\u6761\u6D88\u606F\u5C06\u643A\u5E26\u6B64 preset\u3002\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664\u3002" : "\u5DF2\u505C\u7528 preset\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664"), [refresh, run]);
  const createPreset = (0, import_react.useCallback)(() => run(async () => {
    const created = await api("/presets", { method: "POST", body: body({ name: "\u65B0\u9884\u8BBE" }) });
    await api("/select", { method: "POST", body: body({ id: created.preset.id }) });
    await refresh(created.preset.id);
  }, "\u5DF2\u521B\u5EFA\u5E76\u9009\u62E9\u65B0\u9884\u8BBE"), [refresh, run]);
  const importFile = (0, import_react.useCallback)((file) => run(async () => {
    const content = await file.text();
    const imported = await api("/import", {
      method: "POST",
      body: body({ name: file.name.replace(/\.json$/i, ""), content })
    });
    await api("/select", { method: "POST", body: body({ id: imported.preset.id }) });
    await refresh(imported.preset.id);
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "ST \u9884\u8BBE\u5DF2\u5BFC\u5165\u5E76\u9009\u62E9"), [refresh, run]);
  const save = (0, import_react.useCallback)(() => run(async () => {
    const result = await api(`/presets/${encodeURIComponent(draft.id)}`, {
      method: "PUT",
      body: body({ name: draft.name, systemPromptMode: draft.systemPromptMode, sampling: draft.sampling, prompts: draft.prompts })
    });
    setDraft(result.preset);
    await refresh(result.preset.id);
  }, "\u9884\u8BBE\u914D\u7F6E\u5DF2\u4FDD\u5B58"), [draft, refresh, run]);
  const remove = (0, import_react.useCallback)(() => run(async () => {
    if (!window.confirm(`\u5220\u9664\u9884\u8BBE\u201C${draft.name}\u201D\uFF1F`)) return;
    await api(`/presets/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    await refresh(null);
  }, "\u9884\u8BBE\u5DF2\u5220\u9664"), [draft, refresh, run]);
  const patchSampling = (patch) => setDraft((current) => ({
    ...current,
    sampling: { ...current.sampling, ...patch }
  }));
  const patchSt = (key, value) => patchSampling({
    st: { ...draft.sampling.st, [key]: value }
  });
  const patchPrompt = (index, patch) => setDraft((current) => ({
    ...current,
    prompts: current.prompts.map((prompt, at) => at === index ? { ...prompt, ...patch } : prompt)
  }));
  const movePrompt = (from, boundary) => setDraft((current) => {
    const prompts = reorderAtBoundary(current.prompts, from, boundary);
    if (prompts === current.prompts) return current;
    return { ...current, prompts };
  });
  const deletePrompt = (index) => setDraft((current) => ({
    ...current,
    prompts: current.prompts.filter((_prompt, at) => at !== index)
  }));
  const addPrompt = () => setDraft((current) => ({
    ...current,
    prompts: [...current.prompts, {
      identifier: `prompt-${Date.now().toString(36)}`,
      name: "\u65B0\u63D0\u793A\u8BCD",
      role: "system",
      content: "",
      enabled: true,
      marker: false,
      systemPrompt: false,
      st: {}
    }]
  }));
  return (0, import_react.createElement)(
    "div",
    { className: "dtt-root" },
    (0, import_react.createElement)(
      "div",
      { className: "dtt-header" },
      (0, import_react.createElement)("div", { className: "dtt-title" }, "Tavern \u9884\u8BBE", catalog?.selectedId ? (0, import_react.createElement)("span", { className: "dtt-active" }, "\u25CF \u5DF2\u542F\u7528") : null),
      (0, import_react.createElement)("button", { className: "dtt-icon", type: "button", title: "\u5173\u95ED\u53F3\u4FA7\u680F", onClick: closePanel }, "\u2715")
    ),
    (0, import_react.createElement)(
      "div",
      { className: "dtt-body" },
      (0, import_react.createElement)(
        "div",
        { className: "dtt-toolbar" },
        (0, import_react.createElement)("button", { className: "dtt-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, "\u5BFC\u5165 ST JSON"),
        (0, import_react.createElement)("button", { className: "dtt-button", type: "button", disabled: busy, onClick: createPreset }, "\u521B\u5EFA\u9884\u8BBE"),
        (0, import_react.createElement)("input", {
          ref: fileRef,
          hidden: true,
          type: "file",
          accept: ".json,application/json",
          onChange: (event) => {
            const file = event.target.files?.[0];
            if (file !== void 0) importFile(file);
          }
        })
      ),
      (0, import_react.createElement)(Field, { label: "\u5F53\u524D\u9009\u62E9" }, (0, import_react.createElement)(
        "select",
        {
          className: "dtt-select",
          value: catalog?.selectedId ?? "",
          disabled: busy || catalog === null,
          onChange: (event) => choose(event.target.value)
        },
        (0, import_react.createElement)("option", { value: "" }, "\u4E0D\u4F7F\u7528\u9884\u8BBE"),
        ...(catalog?.presets ?? []).map((preset) => (0, import_react.createElement)("option", { key: preset.id, value: preset.id }, `${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`))
      )),
      (0, import_react.createElement)("p", { className: "dtt-note" }, `\u5B58\u50A8\u76EE\u5F55\uFF1A${catalog?.storageDir || "\u52A0\u8F7D\u4E2D\u2026"}`),
      (0, import_react.createElement)("div", { className: "dtt-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.text),
      draft === null ? (0, import_react.createElement)("p", { className: "dtt-note" }, catalog === null ? "\u6B63\u5728\u52A0\u8F7D\u9884\u8BBE\u2026" : "\u8BF7\u9009\u62E9\u6216\u521B\u5EFA\u9884\u8BBE\u4EE5\u5F00\u59CB\u914D\u7F6E\u3002") : (0, import_react.createElement)(
        "div",
        { className: "dtt-section" },
        (0, import_react.createElement)("div", { className: "dtt-section-title" }, "\u57FA\u672C\u8BBE\u7F6E"),
        (0, import_react.createElement)(Field, { label: "\u9884\u8BBE\u540D\u79F0" }, (0, import_react.createElement)("input", {
          className: "dtt-input",
          value: draft.name,
          onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value }))
        })),
        (0, import_react.createElement)(
          "div",
          { className: "dtt-grid" },
          (0, import_react.createElement)(NumberField, { label: "Temperature", value: draft.sampling.temperature, onChange: (temperature) => patchSampling({ temperature }), min: 0 }),
          (0, import_react.createElement)(NumberField, { label: "Max tokens", value: draft.sampling.maxTokens, onChange: (maxTokens) => patchSampling({ maxTokens }), min: 1, step: 1 })
        ),
        (0, import_react.createElement)(Field, { label: "Reasoning effort" }, (0, import_react.createElement)(
          "select",
          {
            className: "dtt-select",
            value: draft.sampling.reasoningEffort ?? "",
            onChange: (event) => patchSampling({ reasoningEffort: event.target.value || void 0 })
          },
          (0, import_react.createElement)("option", { value: "" }, "\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4"),
          (0, import_react.createElement)("option", { value: "low" }, "Low"),
          (0, import_react.createElement)("option", { value: "medium" }, "Medium"),
          (0, import_react.createElement)("option", { value: "high" }, "High"),
          (0, import_react.createElement)("option", { value: "xhigh" }, "Extra high")
        )),
        (0, import_react.createElement)("button", { className: "dtt-button", type: "button", onClick: () => setAdvanced((value) => !value) }, advanced ? "\u6536\u8D77\u9AD8\u7EA7\u8BBE\u7F6E" : "\u5C55\u5F00\u9AD8\u7EA7\u8BBE\u7F6E"),
        advanced ? (0, import_react.createElement)("div", { className: "dtt-grid" }, ...ST_NUMBER_FIELDS.map(([key, label]) => (0, import_react.createElement)(NumberField, {
          key,
          label,
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value)
        }))) : null,
        advanced ? (0, import_react.createElement)("p", { className: "dtt-note" }, "\u8FD9\u4E9B\u5B57\u6BB5\u4F1A\u88AB\u5B8C\u6574\u4FDD\u5B58\uFF1Bdsh 0.1.0 \u5F53\u524D\u8BF7\u6C42\u534F\u8BAE\u672A\u66B4\u9732\u7684\u53C2\u6570\u4E0D\u4F1A\u5F3A\u884C\u4E0B\u53D1\u7ED9\u9002\u914D\u5668\u3002") : null,
        advanced ? (0, import_react.createElement)(Field, { label: "DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD" }, (0, import_react.createElement)(
          "select",
          {
            className: "dtt-select",
            value: draft.systemPromptMode === "replace" ? "replace" : "append",
            onChange: (event) => setDraft((current) => ({ ...current, systemPromptMode: event.target.value }))
          },
          (0, import_react.createElement)("option", { value: "append" }, "\u4FDD\u7559 DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF0C\u5E76\u8FFD\u52A0\u9884\u8BBE\uFF08\u63A8\u8350\uFF09"),
          (0, import_react.createElement)("option", { value: "replace" }, "\u4EC5\u4F7F\u7528\u9884\u8BBE\uFF0C\u79FB\u9664 DSH \u7CFB\u7EDF\u6BB5\uFF08\u9AD8\u7EA7\uFF09")
        )) : null,
        advanced && draft.systemPromptMode === "replace" ? (0, import_react.createElement)("p", { className: "dtt-status", "data-error": true }, "\u8B66\u544A\uFF1A\u8FD9\u4F1A\u79FB\u9664\u6A21\u578B\u53EF\u89C1\u7684 Harness \u8EAB\u4EFD\u3001Agent persona \u548C\u5DE5\u5177\u8BF4\u660E\uFF0C\u53EF\u80FD\u7834\u574F\u5DE5\u5177\u8C03\u7528\u6216\u7ED3\u6784\u5316\u8F93\u51FA\uFF1B\u6C99\u7BB1\u4E0E\u5BA1\u6279\u7B49\u6267\u884C\u5C42\u5B89\u5168\u4ECD\u7136\u6709\u6548\u3002") : null,
        (0, import_react.createElement)(
          "div",
          { className: "dtt-section" },
          (0, import_react.createElement)(
            "div",
            { className: "dtt-section-title" },
            (0, import_react.createElement)("span", null, `\u63D0\u793A\u8BCD (${draft.prompts.length})`),
            (0, import_react.createElement)("button", { className: "dtt-button", type: "button", onClick: addPrompt }, "\uFF0B \u6DFB\u52A0")
          ),
          (0, import_react.createElement)(
            "div",
            { className: "dtt-prompts" },
            ...draft.prompts.flatMap((prompt, index) => [
              dragFrom !== null && dropIndex === index ? (0, import_react.createElement)(DropPlaceholder, { key: `drop-${index}` }) : null,
              (0, import_react.createElement)(PromptEditor, {
                key: `${prompt.identifier}-${index}`,
                prompt,
                index,
                dragging: dragFrom === index,
                onPatch: (patch) => patchPrompt(index, patch),
                onPointerDown: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragFrom(index);
                  setDropIndex(index + 1);
                },
                onPointerMove: (event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const boundary = insertionBoundary(event);
                  if (boundary !== null) setDropIndex(boundary);
                },
                onPointerUp: (event) => {
                  event.preventDefault();
                  const boundary = insertionBoundary(event) ?? dropIndex ?? index + 1;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  movePrompt(index, boundary);
                  setDragFrom(null);
                  setDropIndex(null);
                },
                onPointerCancel: () => {
                  setDragFrom(null);
                  setDropIndex(null);
                },
                onDelete: () => deletePrompt(index)
              })
            ]),
            dragFrom !== null && dropIndex === draft.prompts.length ? (0, import_react.createElement)(DropPlaceholder, { key: "drop-end" }) : null
          )
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dtt-footer" },
          (0, import_react.createElement)("button", { className: "dtt-button dtt-button-primary", type: "button", disabled: busy, onClick: save }, busy ? "\u5904\u7406\u4E2D\u2026" : "\u4FDD\u5B58\u5E76\u5E94\u7528"),
          (0, import_react.createElement)("button", { className: "dtt-button dtt-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664")
        )
      )
    )
  );
}
function PresetHeaderButton({ openPanel }) {
  const open = () => {
    openPanel();
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  };
  return (0, import_react.createElement)("button", { className: "dtt-open-button", type: "button", onClick: open, title: "\u6253\u5F00 Tavern \u9884\u8BBE\u4FA7\u8FB9\u680F" }, "\u9884\u8BBE");
}
function PresetFloatingLauncher({ useSessions }) {
  const [overlayOpen, setOverlayOpen] = (0, import_react.useState)(false);
  const sessionId = useSessions((state) => state.current);
  const floatingAvailable = useSessions(shouldUseFloatingPanel);
  (0, import_react.useEffect)(() => {
    if (!floatingAvailable) setOverlayOpen(false);
  }, [floatingAvailable]);
  if (!floatingAvailable) return null;
  const open = () => {
    setOverlayOpen(true);
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  };
  return (0, import_react.createElement)(
    "div",
    { className: "dtt-floating-layer" },
    overlayOpen ? (0, import_react.createElement)("div", { className: "dtt-overlay-panel" }, (0, import_react.createElement)(PresetSidebar, {
      closePanel: () => setOverlayOpen(false),
      openPanel: () => {
      },
      sessionId,
      autoOpen: false
    })) : (0, import_react.createElement)(
      "div",
      { className: "dtt-floating-launcher" },
      (0, import_react.createElement)("button", {
        className: "dtt-floating-button",
        type: "button",
        onClick: open,
        title: "\u6253\u5F00 Tavern \u9884\u8BBE\u4FA7\u8FB9\u680F",
        "aria-label": "\u6253\u5F00 Tavern \u9884\u8BBE\u4FA7\u8FB9\u680F"
      }, "\u9884\u8BBE")
    )
  );
}
function installStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern";
  style.textContent = css;
  document.head.append(style);
}
function apply(ctx) {
  installStyles();
  ctx.slots.inject("details", () => ctx.slots.register({
    name: "details",
    priority: -10,
    inject: () => ({
      closePanel: () => ctx.layout.closeDetails(),
      openPanel: () => ctx.layout.openDetails()
    })
  }, PresetSidebar));
  ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "dsh-tavern-preset",
    order: 80,
    inject: () => ({ openPanel: () => ctx.layout.openDetails() })
  }, PresetHeaderButton));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "dsh-tavern-preset-launcher",
    order: 80,
    inject: () => ({})
  }, PresetFloatingLauncher));
  let attempts = 0;
  const openDefault = () => {
    attempts += 1;
    try {
      ctx.layout.openDetails();
    } catch {
      if (attempts < 20) window.setTimeout(openDefault, 100);
    }
  };
  const timer = window.setTimeout(openDefault, 0);
  ctx.effect(() => () => window.clearTimeout(timer), "dsh-tavern: default right panel");
}

// packages/character/src/client.js
var import_react2 = require("react");

// packages/character/src/client-state.js
function shouldShowCharacterLauncher(sessionState) {
  const current = sessionState?.current;
  if (current === void 0 || current === null) return true;
  return sessionState.byId?.[current]?.blank === true;
}
function characterGreetingOptions(character) {
  if (character === null || typeof character !== "object") return [];
  const first = typeof character.data?.firstMessage === "string" ? character.data.firstMessage : "";
  const alternates = Array.isArray(character.data?.alternateGreetings) ? character.data.alternateGreetings.filter((item) => typeof item === "string") : [];
  return [
    { index: 0, label: first === "" ? "\u9ED8\u8BA4\u5F00\u573A\uFF08\u7A7A\uFF09" : "\u9ED8\u8BA4\u5F00\u573A", text: first },
    ...alternates.map((text, index) => ({ index: index + 1, label: `\u5907\u9009\u5F00\u573A ${index + 1}`, text }))
  ];
}
function defaultCharacterSelection(characterCardId) {
  return {
    characterCardId,
    character: {
      greetingIndex: 0,
      preferCharacterSystemPrompt: true,
      preferCharacterPostHistory: true
    }
  };
}

// packages/character/src/client.js
var API_ROOT2 = "/dsh-tavern/api";
var css2 = `
.dcc-layer{position:absolute;inset:0;pointer-events:none;z-index:7}.dcc-launcher{position:absolute;top:14px;right:82px;pointer-events:auto}.dcc-launcher-button,.dcc-header-button{height:32px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:12px;font-weight:600;cursor:pointer;padding:0 12px}.dcc-header-button{height:28px;border-radius:7px;background:transparent;font-size:11px;font-weight:400;padding:0 9px}.dcc-launcher-button:hover,.dcc-header-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dcc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dcc-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dcc-title{font-size:14px;font-weight:650;flex:1}.dcc-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dcc-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dcc-toolbar,.dcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dcc-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dcc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcc-button:disabled{opacity:.5;cursor:default}.dcc-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dcc-danger{color:var(--dsw-alias-state-error)}.dcc-field{display:flex;flex-direction:column;gap:5px}.dcc-label{font-size:11px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dcc-select{box-sizing:border-box;width:100%;height:34px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}.dcc-note,.dcc-meta{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dcc-status{font-size:11px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dcc-status[data-error=true]{color:var(--dsw-alias-state-error)}.dcc-card{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dcc-card-head{display:flex;gap:11px}.dcc-avatar{width:76px;height:100px;object-fit:cover;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-container)}.dcc-card-title{font-size:15px;font-weight:650;margin:0 0 5px}.dcc-tags{display:flex;gap:5px;flex-wrap:wrap}.dcc-tag{font-size:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px;color:var(--dsw-alias-label-secondary)}.dcc-check{display:flex;gap:7px;align-items:flex-start;font-size:11px;line-height:1.4}.dcc-detail{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px}.dcc-detail summary{cursor:pointer;font-size:12px;font-weight:600}.dcc-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.5;margin:8px 0 0;max-height:260px;overflow:auto}.dcc-diags{margin:7px 0 0;padding-left:18px;font-size:11px;line-height:1.5}.dcc-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`;
function errorMessage(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return `HTTP ${status}`;
}
async function api2(path, options = {}) {
  const response = await fetch(`${API_ROOT2}${path}`, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status));
  return data;
}
function Field2({ label, children }) {
  return (0, import_react2.createElement)("label", { className: "dcc-field" }, (0, import_react2.createElement)("span", { className: "dcc-label" }, label), children);
}
function TextDetail({ label, value }) {
  if (typeof value !== "string" || value === "") return null;
  return (0, import_react2.createElement)(
    "details",
    { className: "dcc-detail" },
    (0, import_react2.createElement)("summary", null, label),
    (0, import_react2.createElement)("p", { className: "dcc-text" }, value)
  );
}
function DiagnosticList({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (0, import_react2.createElement)(
    "details",
    { className: "dcc-detail" },
    (0, import_react2.createElement)("summary", null, `${title} (${items.length})`),
    (0, import_react2.createElement)("ul", { className: "dcc-diags" }, ...items.map((item, index) => (0, import_react2.createElement)("li", { key: `${item.code}-${index}` }, `${item.message}${item.path ? ` [${item.path}]` : ""}`)))
  );
}
function CharacterPanel({ sessionId, sessionBlank, close }) {
  const [catalog, setCatalog] = (0, import_react2.useState)(null);
  const [detail, setDetail] = (0, import_react2.useState)(null);
  const [selection, setSelection] = (0, import_react2.useState)(null);
  const [binding, setBinding] = (0, import_react2.useState)(null);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [status, setStatus] = (0, import_react2.useState)({ text: "\u52A0\u8F7D\u4E2D\u2026", error: false });
  const fileRef = (0, import_react2.useRef)(null);
  const refreshGeneration = (0, import_react2.useRef)(0);
  const run = (0, import_react2.useCallback)(async (operation, success) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ text: success, error: false });
      return result;
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const loadDetail = (0, import_react2.useCallback)(async (id) => {
    const generation = ++refreshGeneration.current;
    if (id === null || id === void 0 || id === "") {
      setDetail(null);
      setBinding(null);
      return;
    }
    const data = await api2(`/characters/${encodeURIComponent(id)}`);
    if (generation !== refreshGeneration.current) return;
    setDetail(data.character);
    setBinding(selection?.characterCardId === id ? selection : defaultCharacterSelection(id));
  }, [selection]);
  const refresh = (0, import_react2.useCallback)(async (preferredId) => {
    const generation = ++refreshGeneration.current;
    const list = await api2("/characters");
    let currentSelection = null;
    if (sessionId) {
      const selected = await api2(`/character-selection?sessionId=${encodeURIComponent(sessionId)}`);
      currentSelection = selected.selection;
    }
    if (generation !== refreshGeneration.current) return;
    setCatalog(list);
    setSelection(currentSelection);
    const id = preferredId ?? currentSelection?.characterCardId ?? list.characters[0]?.id ?? null;
    if (id === null) {
      setDetail(null);
      setBinding(null);
      return;
    }
    const data = await api2(`/characters/${encodeURIComponent(id)}`);
    if (generation !== refreshGeneration.current) return;
    setDetail(data.character);
    setBinding(currentSelection?.characterCardId === id ? currentSelection : defaultCharacterSelection(id));
  }, [sessionId]);
  (0, import_react2.useEffect)(() => {
    run(() => refresh(), "\u89D2\u8272\u5E93\u5DF2\u52A0\u8F7D");
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh, run]);
  const importFile = (0, import_react2.useCallback)((file) => run(async () => {
    const response = await fetch(`${API_ROOT2}/characters/import?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status));
    await refresh(data.character.id);
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "\u89D2\u8272\u5361\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5230\u4F1A\u8BDD"), [refresh, run]);
  const bind = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw new Error("\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u89D2\u8272");
    if (selection?.characterCardId !== binding?.characterCardId && sessionBlank === false && !window.confirm("\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u66F4\u6362\u89D2\u8272\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F")) return;
    const data = await api2("/character-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...binding })
    });
    setSelection(data.selection);
    setBinding(data.selection);
  }, "\u89D2\u8272\u9009\u62E9\u5DF2\u4FDD\u5B58\uFF1B\u5B9E\u9645\u5BF9\u8BDD\u52A0\u8F7D\u7531 Tavern loader \u7EDF\u4E00\u5904\u7406"), [binding, run, selection, sessionBlank, sessionId]);
  const unbind = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw new Error("\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u7ED1\u7684\u4F1A\u8BDD");
    await api2("/character-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, characterCardId: null })
    });
    setSelection(null);
    if (detail !== null) setBinding(defaultCharacterSelection(detail.id));
  }, "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u89D2\u8272\u7ED1\u5B9A"), [detail, run, sessionId]);
  const remove = (0, import_react2.useCallback)(() => run(async () => {
    if (detail === null || !window.confirm(`\u5220\u9664\u89D2\u8272\u5361\u201C${detail.name}\u201D\uFF1F\u539F\u59CB\u5BFC\u5165\u6587\u4EF6\u4E5F\u4F1A\u88AB\u5220\u9664\u3002`)) return;
    await api2(`/characters/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
    await refresh(null);
  }, "\u89D2\u8272\u5361\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664"), [detail, refresh, run]);
  const greetings = characterGreetingOptions(detail);
  const activeName = selection === null ? "\u672A\u7ED1\u5B9A\u89D2\u8272" : catalog?.characters.find((item) => item.id === selection.characterCardId)?.name ?? selection.characterCardId;
  return (0, import_react2.createElement)(
    "div",
    { className: "dcc-panel" },
    (0, import_react2.createElement)(
      "div",
      { className: "dcc-header" },
      (0, import_react2.createElement)("div", { className: "dcc-title" }, "Tavern \u89D2\u8272\u5361"),
      (0, import_react2.createElement)("button", { className: "dcc-close", type: "button", title: "\u5173\u95ED\u89D2\u8272\u5361\u9762\u677F", onClick: close }, "\u2715")
    ),
    (0, import_react2.createElement)(
      "div",
      { className: "dcc-body" },
      (0, import_react2.createElement)(
        "div",
        { className: "dcc-toolbar" },
        (0, import_react2.createElement)("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, "\u5BFC\u5165 JSON / PNG"),
        (0, import_react2.createElement)("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => run(() => refresh(detail?.id), "\u89D2\u8272\u5E93\u5DF2\u5237\u65B0") }, "\u5237\u65B0"),
        (0, import_react2.createElement)("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,.png,application/json,image/png", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      (0, import_react2.createElement)(Field2, { label: "\u6D4F\u89C8\u89D2\u8272\u5E93" }, (0, import_react2.createElement)(
        "select",
        {
          className: "dcc-select",
          value: detail?.id ?? "",
          disabled: busy || catalog === null || catalog.characters.length === 0,
          onChange: (event) => run(() => loadDetail(event.target.value), "\u89D2\u8272\u8BE6\u60C5\u5DF2\u52A0\u8F7D")
        },
        ...catalog?.characters.length ? [] : [(0, import_react2.createElement)("option", { key: "empty", value: "" }, "\u89D2\u8272\u5E93\u4E3A\u7A7A")],
        ...(catalog?.characters ?? []).map((item) => (0, import_react2.createElement)("option", { key: item.id, value: item.id }, `${item.name} \xB7 ${item.sourceFormat}`))
      )),
      (0, import_react2.createElement)("p", { className: "dcc-note" }, `\u5F53\u524D\u4F1A\u8BDD\uFF1A${sessionId || "\u65E0"}\uFF1B\u7ED1\u5B9A\uFF1A${activeName}`),
      (0, import_react2.createElement)("p", { className: "dcc-note" }, `\u5B58\u50A8\u76EE\u5F55\uFF1A${catalog?.storageDir || "\u52A0\u8F7D\u4E2D\u2026"}`),
      (0, import_react2.createElement)("div", { className: "dcc-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.text),
      detail === null ? (0, import_react2.createElement)("p", { className: "dcc-note" }, catalog === null ? "\u6B63\u5728\u52A0\u8F7D\u89D2\u8272\u5E93\u2026" : "\u5BFC\u5165\u4E00\u5F20\u5408\u6210\u6216\u81EA\u6709\u6388\u6743\u7684 SillyTavern \u89D2\u8272\u5361\u4EE5\u67E5\u770B\u8BE6\u60C5\u3002") : (0, import_react2.createElement)(
        "div",
        { className: "dcc-card" },
        (0, import_react2.createElement)(
          "div",
          { className: "dcc-card-head" },
          detail.source.container === "png" ? (0, import_react2.createElement)("img", { className: "dcc-avatar", src: `${API_ROOT2}/characters/${encodeURIComponent(detail.id)}/artifact`, alt: `${detail.name} \u89D2\u8272\u5361\u56FE\u7247` }) : null,
          (0, import_react2.createElement)(
            "div",
            null,
            (0, import_react2.createElement)("h3", { className: "dcc-card-title" }, detail.name),
            (0, import_react2.createElement)("p", { className: "dcc-meta" }, `${detail.source.format}${detail.source.specVersion ? ` \xB7 ${detail.source.specVersion}` : ""} \xB7 ${detail.source.container}`),
            (0, import_react2.createElement)("p", { className: "dcc-meta" }, `${detail.data.creator || "\u672A\u77E5\u4F5C\u8005"}${detail.data.characterVersion ? ` \xB7 ${detail.data.characterVersion}` : ""}`),
            (0, import_react2.createElement)("div", { className: "dcc-tags" }, ...detail.data.tags.map((tag, index) => (0, import_react2.createElement)("span", { className: "dcc-tag", key: `${tag}-${index}` }, tag)))
          )
        ),
        (0, import_react2.createElement)(Field2, { label: "\u5F00\u573A\u53C2\u8003" }, (0, import_react2.createElement)("select", {
          className: "dcc-select",
          value: binding?.character?.greetingIndex ?? 0,
          onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, greetingIndex: Number(event.target.value) } }))
        }, ...greetings.map((item) => (0, import_react2.createElement)("option", { key: item.index, value: item.index }, item.label)))),
        (0, import_react2.createElement)("label", { className: "dcc-check" }, (0, import_react2.createElement)("input", { type: "checkbox", checked: binding?.character?.preferCharacterSystemPrompt !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterSystemPrompt: event.target.checked } })) }), (0, import_react2.createElement)("span", null, "\u5141\u8BB8 loader \u4F18\u5148\u91C7\u7528\u5361\u5185 system_prompt")),
        (0, import_react2.createElement)("label", { className: "dcc-check" }, (0, import_react2.createElement)("input", { type: "checkbox", checked: binding?.character?.preferCharacterPostHistory !== false, onChange: (event) => setBinding((current) => ({ ...current, character: { ...current.character, preferCharacterPostHistory: event.target.checked } })) }), (0, import_react2.createElement)("span", null, "\u5141\u8BB8 loader \u91C7\u7528 post_history_instructions\uFF08\u5B9E\u9645\u4F4D\u7F6E\u7531 loader \u51B3\u5B9A\uFF09")),
        (0, import_react2.createElement)(
          "div",
          { className: "dcc-actions" },
          (0, import_react2.createElement)("button", { className: "dcc-button dcc-primary", type: "button", disabled: busy || !sessionId, onClick: bind }, selection?.characterCardId === detail.id ? "\u66F4\u65B0\u4F1A\u8BDD\u7ED1\u5B9A" : "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD"),
          (0, import_react2.createElement)("button", { className: "dcc-button", type: "button", disabled: busy || !sessionId || selection === null, onClick: unbind }, "\u89E3\u9664\u7ED1\u5B9A")
        ),
        (0, import_react2.createElement)("p", { className: "dcc-note" }, "\u89D2\u8272\u5361\u6A21\u5757\u53EA\u4FDD\u5B58\u6807\u51C6\u5316\u8D44\u6E90\u548C\u4F1A\u8BDD\u9009\u62E9\uFF0C\u4E0D\u4F1A\u81EA\u884C\u5199\u5165 system prompt\u3001\u4F2A\u9020 assistant \u6D88\u606F\u6216\u6FC0\u6D3B\u4E16\u754C\u4E66\u3002"),
        (0, import_react2.createElement)(TextDetail, { label: "Creator notes", value: detail.data.creatorNotes }),
        (0, import_react2.createElement)(TextDetail, { label: "Description", value: detail.data.description }),
        (0, import_react2.createElement)(TextDetail, { label: "Personality", value: detail.data.personality }),
        (0, import_react2.createElement)(TextDetail, { label: "Scenario", value: detail.data.scenario }),
        (0, import_react2.createElement)(TextDetail, { label: "\u5F53\u524D\u5F00\u573A\u53C2\u8003\u5185\u5BB9", value: greetings[binding?.character?.greetingIndex ?? 0]?.text }),
        (0, import_react2.createElement)(TextDetail, { label: "Message examples", value: detail.data.messageExample }),
        (0, import_react2.createElement)(TextDetail, { label: "System prompt\uFF08\u4EC5\u4FDD\u5B58\uFF09", value: detail.data.systemPrompt }),
        (0, import_react2.createElement)(TextDetail, { label: "Post-history instructions\uFF08\u4EC5\u4FDD\u5B58\uFF09", value: detail.data.postHistoryInstructions }),
        detail.data.characterBook !== null ? (0, import_react2.createElement)("div", { className: "dcc-status" }, `\u5185\u5D4C character_book \u5DF2\u65E0\u635F\u4FDD\u7559\uFF08${Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : "\u672A\u77E5"} \u6761\uFF09\uFF1B\u672C\u6A21\u5757\u4E0D\u4F1A\u6267\u884C\u5339\u914D\u3002`) : null,
        (0, import_react2.createElement)(DiagnosticList, { title: "\u517C\u5BB9\u8B66\u544A", items: detail.compatibility.warnings }),
        (0, import_react2.createElement)(DiagnosticList, { title: "\u9700\u8981 loader/\u5176\u4ED6\u6A21\u5757\u5904\u7406", items: detail.compatibility.unsupportedFeatures }),
        detail.compatibility.unknownMacroNames.length > 0 ? (0, import_react2.createElement)("div", { className: "dcc-status" }, `\u672A\u77E5\u5B8F\uFF1A${detail.compatibility.unknownMacroNames.join(", ")}`) : null,
        (0, import_react2.createElement)(
          "div",
          { className: "dcc-actions" },
          (0, import_react2.createElement)("a", { className: "dcc-button", href: `${API_ROOT2}/characters/${encodeURIComponent(detail.id)}/artifact`, download: "" }, "\u5BFC\u51FA\u539F\u4EF6"),
          (0, import_react2.createElement)("a", { className: "dcc-button", href: `${API_ROOT2}/characters/${encodeURIComponent(detail.id)}/json`, download: "" }, "\u5BFC\u51FA JSON")
        ),
        (0, import_react2.createElement)("div", { className: "dcc-footer" }, (0, import_react2.createElement)("button", { className: "dcc-button dcc-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664\u89D2\u8272\u5361"))
      )
    )
  );
}
function CharacterHeaderButton() {
  return (0, import_react2.createElement)("button", { className: "dcc-header-button", type: "button", title: "\u6253\u5F00 Tavern \u89D2\u8272\u5361\u9762\u677F", onClick: () => window.dispatchEvent(new Event("dsh-tavern:open-character")) }, "\u89D2\u8272\u5361");
}
function CharacterOverlay({ useSessions }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  const sessionId = useSessions((state) => state.current);
  const sessionBlank = useSessions((state) => state.current === void 0 || state.current === null ? true : state.byId?.[state.current]?.blank === true);
  const showLauncher = useSessions(shouldShowCharacterLauncher);
  (0, import_react2.useEffect)(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("dsh-tavern:open-character", onOpen);
    return () => window.removeEventListener("dsh-tavern:open-character", onOpen);
  }, []);
  return (0, import_react2.createElement)(
    "div",
    { className: "dcc-layer" },
    open ? (0, import_react2.createElement)(CharacterPanel, { sessionId, sessionBlank, close: () => setOpen(false) }) : null,
    !open && showLauncher ? (0, import_react2.createElement)("div", { className: "dcc-launcher" }, (0, import_react2.createElement)("button", { className: "dcc-launcher-button", type: "button", onClick: () => setOpen(true), title: "\u6253\u5F00 Tavern \u89D2\u8272\u5361\u9762\u677F" }, "\u89D2\u8272\u5361")) : null
  );
}
function installStyles2() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-character"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern-character";
  style.textContent = css2;
  document.head.append(style);
}
function applyCharacterClient(ctx) {
  installStyles2();
  ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "dsh-tavern-character",
    order: 81,
    inject: () => ({})
  }, CharacterHeaderButton));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "dsh-tavern-character-overlay",
    order: 81,
    inject: () => ({})
  }, CharacterOverlay));
}

// packages/client/src/index.js
var name = "dsh-tavern";
var inject = ["slots", "layout"];
function apply2(ctx) {
  apply(ctx);
  applyCharacterClient(ctx);
}

		return module.exports;
	}
});
