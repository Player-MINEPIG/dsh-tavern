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
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react5 = require("react");

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
`;
async function api(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
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
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const data = await api(`/presets${query}`);
    const id = preferredId === void 0 ? data.selectedId : preferredId;
    const detail = id === null || id === void 0 ? null : (await api(`/presets/${encodeURIComponent(id)}`)).preset;
    if (generation !== refreshGeneration.current) return false;
    setCatalog(data);
    setDraft(detail);
    return true;
  }, [sessionId]);
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
    await api("/select", { method: "POST", body: body({ id: id || null, sessionId }) });
    await refresh(id || null);
  }, id ? "\u9884\u8BBE\u5DF2\u9009\u62E9\uFF1B\u4E0B\u4E00\u6761\u6D88\u606F\u5C06\u643A\u5E26\u6B64 preset\u3002\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664\u3002" : "\u5DF2\u505C\u7528 preset\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664"), [refresh, run, sessionId]);
  const createPreset = (0, import_react.useCallback)(() => run(async () => {
    const created = await api("/presets", { method: "POST", body: body({ name: "\u65B0\u9884\u8BBE" }) });
    await api("/select", { method: "POST", body: body({ id: created.preset.id, sessionId }) });
    await refresh(created.preset.id);
  }, "\u5DF2\u521B\u5EFA\u5E76\u9009\u62E9\u65B0\u9884\u8BBE"), [refresh, run, sessionId]);
  const importFile = (0, import_react.useCallback)((file) => run(async () => {
    const content = await file.text();
    const imported = await api("/import", {
      method: "POST",
      body: body({ name: file.name.replace(/\.json$/i, ""), content })
    });
    await api("/select", { method: "POST", body: body({ id: imported.preset.id, sessionId }) });
    await refresh(imported.preset.id);
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "ST \u9884\u8BBE\u5DF2\u5BFC\u5165\u5E76\u9009\u62E9"), [refresh, run, sessionId]);
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
      (0, import_react.createElement)("button", { className: "dtt-icon", type: "button", title: "\u5173\u95ED\u53F3\u4FA7\u680F", "aria-label": "\u5173\u95ED\u9884\u8BBE\u4FA7\u8FB9\u680F", onClick: closePanel }, "\u2715")
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
function installPresetStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern";
  style.textContent = css;
  document.head.append(style);
}

// packages/character/src/client.js
var import_react2 = require("react");

// packages/character/src/client-state.js
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
.dcc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dcc-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dcc-title{font-size:14px;font-weight:650;flex:1}.dcc-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dcc-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dcc-toolbar,.dcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dcc-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dcc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcc-button:disabled{opacity:.5;cursor:default}.dcc-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dcc-danger{color:var(--dsw-alias-state-error)}.dcc-field{display:flex;flex-direction:column;gap:5px}.dcc-label{font-size:11px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dcc-select{box-sizing:border-box;width:100%;height:34px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}.dcc-note,.dcc-meta{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dcc-status{font-size:11px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dcc-status[data-error=true]{color:var(--dsw-alias-state-error)}.dcc-card{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dcc-card-head{display:flex;gap:11px}.dcc-avatar{width:76px;height:100px;object-fit:cover;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-container)}.dcc-card-title{font-size:15px;font-weight:650;margin:0 0 5px}.dcc-tags{display:flex;gap:5px;flex-wrap:wrap}.dcc-tag{font-size:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px;color:var(--dsw-alias-label-secondary)}.dcc-check{display:flex;gap:7px;align-items:flex-start;font-size:11px;line-height:1.4}.dcc-detail{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px}.dcc-detail summary{cursor:pointer;font-size:12px;font-weight:600}.dcc-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.5;margin:8px 0 0;max-height:260px;overflow:auto}.dcc-diags{margin:7px 0 0;padding-left:18px;font-size:11px;line-height:1.5}.dcc-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`;
function errorMessage(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return `HTTP ${status}`;
}
async function api2(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_ROOT2}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
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
      (0, import_react2.createElement)("button", { className: "dcc-close", type: "button", title: "\u5173\u95ED\u89D2\u8272\u5361\u9762\u677F", "aria-label": "\u5173\u95ED\u89D2\u8272\u5361\u4FA7\u8FB9\u680F", onClick: close }, "\u2715")
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
        (0, import_react2.createElement)("p", { className: "dcc-note" }, "\u89D2\u8272\u5361\u6A21\u5757\u8D1F\u8D23\u4FDD\u5B58\u6807\u51C6\u5316\u8D44\u6E90\u548C\u4F1A\u8BDD\u9009\u62E9\uFF1B\u5B9E\u9645 system profile \u4E0E\u5185\u5D4C\u4E16\u754C\u4FE1\u606F\u5339\u914D\u7531 Tavern loader \u5728\u6BCF\u6B21\u8BF7\u6C42\u65F6\u7EDF\u4E00\u5904\u7406\uFF0C\u4E0D\u4F1A\u4F2A\u9020 assistant \u5386\u53F2\u3002"),
        (0, import_react2.createElement)(TextDetail, { label: "Creator notes", value: detail.data.creatorNotes }),
        (0, import_react2.createElement)(TextDetail, { label: "Description", value: detail.data.description }),
        (0, import_react2.createElement)(TextDetail, { label: "Personality", value: detail.data.personality }),
        (0, import_react2.createElement)(TextDetail, { label: "Scenario", value: detail.data.scenario }),
        (0, import_react2.createElement)(TextDetail, { label: "\u5F53\u524D\u5F00\u573A\u53C2\u8003\u5185\u5BB9", value: greetings[binding?.character?.greetingIndex ?? 0]?.text }),
        (0, import_react2.createElement)(TextDetail, { label: "Message examples", value: detail.data.messageExample }),
        (0, import_react2.createElement)(TextDetail, { label: "System prompt\uFF08\u7531 loader \u6309\u7ED1\u5B9A\u8BBE\u7F6E\u5904\u7406\uFF09", value: detail.data.systemPrompt }),
        (0, import_react2.createElement)(TextDetail, { label: "Post-history instructions\uFF08\u7531 loader \u8FD1\u4F3C\u653E\u7F6E\uFF09", value: detail.data.postHistoryInstructions }),
        detail.data.characterBook !== null ? (0, import_react2.createElement)("div", { className: "dcc-status" }, `\u5185\u5D4C character_book \u5DF2\u65E0\u635F\u4FDD\u7559\uFF08${Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : "\u672A\u77E5"} \u6761\uFF09\uFF1B\u7ED1\u5B9A\u89D2\u8272\u540E\u7531 Tavern loader \u8C03\u7528\u4E16\u754C\u4FE1\u606F matcher\uFF0C\u89E3\u7ED1\u540E\u4E0D\u518D\u53C2\u4E0E\u540E\u7EED\u8BF7\u6C42\u3002`) : null,
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
function installCharacterStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-character"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern-character";
  style.textContent = css2;
  document.head.append(style);
}

// packages/world-book-library/src/client.js
var import_react3 = require("react");
var API_ROOT3 = "/dsh-tavern/api";
var POSITIONS = [
  ["before_character_definition", "\u89D2\u8272\u5B9A\u4E49\u4E4B\u524D"],
  ["after_character_definition", "\u89D2\u8272\u5B9A\u4E49\u4E4B\u540E"],
  ["before_author_note", "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09"],
  ["after_author_note", "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09"],
  ["at_depth", "\u6307\u5B9A\u6DF1\u5EA6\uFF08\u8FD1\u4F3C\uFF09"],
  ["before_example_messages", "\u793A\u4F8B\u6D88\u606F\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09"],
  ["after_example_messages", "\u793A\u4F8B\u6D88\u606F\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09"],
  ["outlet", "Outlet\uFF08\u5F53\u524D\u4E0D\u6CE8\u5165\uFF09"]
];
var css3 = `
.dwb-panel{position:absolute;top:0;right:0;bottom:0;width:min(500px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dwb-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dwb-title{font-size:14px;font-weight:650;flex:1}.dwb-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dwb-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:11px}.dwb-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dwb-actions{display:flex;gap:7px;flex-wrap:wrap}.dwb-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:11px}.dwb-button:disabled{opacity:.5;cursor:default}.dwb-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dwb-danger{color:var(--dsw-alias-state-error)}.dwb-field{display:flex;flex-direction:column;gap:4px}.dwb-label{font-size:10px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dwb-input,.dwb-select,.dwb-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:7px 8px}.dwb-input,.dwb-select{height:32px}.dwb-textarea{min-height:110px;resize:vertical;line-height:1.45}.dwb-note,.dwb-meta{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dwb-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dwb-status[data-error=true]{color:var(--dsw-alias-state-error)}.dwb-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:8px}.dwb-resource-title{font-size:12px;font-weight:650}.dwb-bindings{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dwb-check{display:flex;gap:6px;align-items:flex-start;font-size:10px;line-height:1.4}.dwb-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dwb-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:11px}.dwb-entry>summary::-webkit-details-marker{display:none}.dwb-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dwb-entry[data-enabled=true] .dwb-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dwb-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwb-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px}.dwb-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dwb-checks{display:flex;flex-wrap:wrap;gap:10px}.dwb-list{margin:0;padding-left:18px;font-size:11px;line-height:1.5}
`;
function errorMessage2(data, status) {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  return `HTTP ${status}`;
}
async function api3(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_ROOT3}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(errorMessage2(data, response.status));
  return data;
}
function Field3({ label, children }) {
  return (0, import_react3.createElement)("label", { className: "dwb-field" }, (0, import_react3.createElement)("span", { className: "dwb-label" }, label), children);
}
function parseKeywords(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function embeddedPosition(entry) {
  const value = entry?.extensions?.position;
  if (Number.isInteger(value) && value >= 0 && value <= 7) return value;
  return entry?.position === "before_char" ? 0 : 1;
}
function EmbeddedEntryEditor({ entry, index, update, remove }) {
  const patch = (value) => update(index, value);
  const secondaryKeys = Array.isArray(entry.secondary_keys) ? entry.secondary_keys : [];
  const position = embeddedPosition(entry);
  return (0, import_react3.createElement)(
    "details",
    { className: "dwb-entry", "data-enabled": entry.enabled === true },
    (0, import_react3.createElement)(
      "summary",
      null,
      (0, import_react3.createElement)("span", { className: "dwb-dot" }),
      (0, import_react3.createElement)("span", { className: "dwb-entry-name" }, entry.comment || entry.name || `\u6761\u76EE ${entry.id ?? index}`),
      (0, import_react3.createElement)("span", { className: "dwb-entry-state" }, entry.constant ? "\u5E38\u9A7B" : (entry.keys ?? []).join(", ") || "\u65E0\u5173\u952E\u8BCD")
    ),
    (0, import_react3.createElement)(
      "div",
      { className: "dwb-entry-body" },
      (0, import_react3.createElement)(Field3, { label: "\u6761\u76EE\u6807\u9898" }, (0, import_react3.createElement)("input", { className: "dwb-input", value: entry.comment ?? entry.name ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      (0, import_react3.createElement)(Field3, { label: "\u4E3B\u5173\u952E\u8BCD\uFF08\u9017\u53F7\u5206\u9694\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", value: (entry.keys ?? []).join(", "), onChange: (event) => patch({ keys: parseKeywords(event.target.value) }) })),
      (0, import_react3.createElement)(Field3, { label: "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u9017\u53F7\u5206\u9694\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", value: secondaryKeys.join(", "), onChange: (event) => {
        const keys = parseKeywords(event.target.value);
        patch({ secondary_keys: keys, selective: keys.length > 0 });
      } })),
      secondaryKeys.length > 0 ? (0, import_react3.createElement)(Field3, { label: "Secondary logic" }, (0, import_react3.createElement)(
        "select",
        {
          className: "dwb-select",
          value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? "and_any",
          onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true, extensions: { ...entry.extensions ?? {}, selectiveLogic: event.target.value } })
        },
        (0, import_react3.createElement)("option", { value: "and_any" }, "AND ANY\uFF1A\u547D\u4E2D\u4EFB\u4E00"),
        (0, import_react3.createElement)("option", { value: "and_all" }, "AND ALL\uFF1A\u547D\u4E2D\u5168\u90E8"),
        (0, import_react3.createElement)("option", { value: "not_any" }, "NOT ANY\uFF1A\u4E0D\u80FD\u547D\u4E2D\u4EFB\u4E00"),
        (0, import_react3.createElement)("option", { value: "not_all" }, "NOT ALL\uFF1A\u4E0D\u80FD\u5168\u90E8\u547D\u4E2D")
      )) : null,
      (0, import_react3.createElement)(Field3, { label: "\u6B63\u6587" }, (0, import_react3.createElement)("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      (0, import_react3.createElement)(
        "div",
        { className: "dwb-grid" },
        (0, import_react3.createElement)(Field3, { label: "\u4F4D\u7F6E" }, (0, import_react3.createElement)("select", { className: "dwb-select", value: position, onChange: (event) => {
          const value = Number(event.target.value);
          patch({ position: value === 0 ? "before_char" : value === 1 ? "after_char" : entry.position, extensions: { ...entry.extensions ?? {}, position: value } });
        } }, ...POSITIONS.map(([_value, label], value) => (0, import_react3.createElement)("option", { key: value, value }, label)))),
        (0, import_react3.createElement)(Field3, { label: "\u987A\u5E8F\uFF08\u9AD8\u503C\u4F18\u5148\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", type: "number", value: entry.insertion_order ?? 100, onChange: (event) => patch({ insertion_order: Number(event.target.value) }) })),
        (0, import_react3.createElement)(Field3, { label: "\u6982\u7387\uFF080\u2013100\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? entry.extensions?.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), extensions: { ...entry.extensions ?? {}, probability: Number(event.target.value), useProbability: true } }) }))
      ),
      (0, import_react3.createElement)(
        "div",
        { className: "dwb-checks" },
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), "\u542F\u7528"),
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), "\u5E38\u9A7B"),
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: (event) => patch({ case_sensitive: event.target.checked, extensions: { ...entry.extensions ?? {}, case_sensitive: event.target.checked } }) }), "\u533A\u5206\u5927\u5C0F\u5199"),
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: (event) => patch({ match_whole_words: event.target.checked, extensions: { ...entry.extensions ?? {}, match_whole_words: event.target.checked } }) }), "\u5168\u8BCD\u5339\u914D")
      ),
      (0, import_react3.createElement)("div", { className: "dwb-actions" }, (0, import_react3.createElement)("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, "\u5220\u9664\u6761\u76EE"))
    )
  );
}
function nextUid(entries) {
  const numeric = entries.map((entry) => entry.uid).filter(Number.isSafeInteger);
  return numeric.length === 0 ? 0 : Math.max(...numeric) + 1;
}
function createWorldBookEntry(entries = []) {
  const uid = nextUid(entries);
  return {
    uid,
    keys: [],
    secondaryKeys: [],
    comment: `\u65B0\u6761\u76EE ${uid}`,
    content: "",
    enabled: true,
    constant: false,
    selective: false,
    insertionOrder: 100,
    position: "after_character_definition",
    probability: 100,
    useProbability: true,
    caseSensitive: false,
    matchWholeWords: false
  };
}
function EntryEditor({ entry, index, update, remove }) {
  const patch = (value) => update(index, value);
  const secondary = Array.isArray(entry.secondaryKeys) ? entry.secondaryKeys : [];
  return (0, import_react3.createElement)(
    "details",
    { className: "dwb-entry", "data-enabled": entry.enabled === true },
    (0, import_react3.createElement)(
      "summary",
      null,
      (0, import_react3.createElement)("span", { className: "dwb-dot" }),
      (0, import_react3.createElement)("span", { className: "dwb-entry-name" }, entry.comment || `\u6761\u76EE ${entry.uid ?? index}`),
      (0, import_react3.createElement)("span", { className: "dwb-entry-state" }, entry.constant ? "\u5E38\u9A7B" : (entry.keys ?? []).join(", ") || "\u65E0\u5173\u952E\u8BCD")
    ),
    (0, import_react3.createElement)(
      "div",
      { className: "dwb-entry-body" },
      (0, import_react3.createElement)(Field3, { label: "\u6761\u76EE\u6807\u9898" }, (0, import_react3.createElement)("input", { className: "dwb-input", value: entry.comment ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      (0, import_react3.createElement)(Field3, { label: "\u4E3B\u5173\u952E\u8BCD\uFF08\u9017\u53F7\u5206\u9694\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", value: (entry.keys ?? []).join(", "), onChange: (event) => patch({ keys: parseKeywords(event.target.value) }) })),
      (0, import_react3.createElement)(Field3, { label: "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u9017\u53F7\u5206\u9694\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", value: secondary.join(", "), onChange: (event) => patch({ secondaryKeys: parseKeywords(event.target.value), selective: parseKeywords(event.target.value).length > 0 }) })),
      secondary.length > 0 ? (0, import_react3.createElement)(Field3, { label: "Secondary logic" }, (0, import_react3.createElement)(
        "select",
        { className: "dwb-select", value: entry.selectiveLogic ?? "and_any", onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true }) },
        (0, import_react3.createElement)("option", { value: "and_any" }, "AND ANY\uFF1A\u547D\u4E2D\u4EFB\u4E00"),
        (0, import_react3.createElement)("option", { value: "and_all" }, "AND ALL\uFF1A\u547D\u4E2D\u5168\u90E8"),
        (0, import_react3.createElement)("option", { value: "not_any" }, "NOT ANY\uFF1A\u4E0D\u80FD\u547D\u4E2D\u4EFB\u4E00"),
        (0, import_react3.createElement)("option", { value: "not_all" }, "NOT ALL\uFF1A\u4E0D\u80FD\u5168\u90E8\u547D\u4E2D")
      )) : null,
      (0, import_react3.createElement)(Field3, { label: "\u6B63\u6587" }, (0, import_react3.createElement)("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      (0, import_react3.createElement)(
        "div",
        { className: "dwb-grid" },
        (0, import_react3.createElement)(Field3, { label: "\u4F4D\u7F6E" }, (0, import_react3.createElement)("select", { className: "dwb-select", value: entry.position, onChange: (event) => patch({ position: event.target.value }) }, ...POSITIONS.map(([value, label]) => (0, import_react3.createElement)("option", { key: value, value }, label)))),
        (0, import_react3.createElement)(Field3, { label: "\u987A\u5E8F\uFF08\u9AD8\u503C\u4F18\u5148\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", type: "number", value: entry.insertionOrder ?? 100, onChange: (event) => patch({ insertionOrder: Number(event.target.value) }) })),
        (0, import_react3.createElement)(Field3, { label: "\u6982\u7387\uFF080\u2013100\uFF09" }, (0, import_react3.createElement)("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), useProbability: true }) }))
      ),
      (0, import_react3.createElement)(
        "div",
        { className: "dwb-checks" },
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), "\u542F\u7528"),
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), "\u5E38\u9A7B"),
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: entry.caseSensitive === true, onChange: (event) => patch({ caseSensitive: event.target.checked }) }), "\u533A\u5206\u5927\u5C0F\u5199"),
        (0, import_react3.createElement)("label", { className: "dwb-check" }, (0, import_react3.createElement)("input", { type: "checkbox", checked: entry.matchWholeWords === true, onChange: (event) => patch({ matchWholeWords: event.target.checked }) }), "\u5168\u8BCD\u5339\u914D")
      ),
      (0, import_react3.createElement)("div", { className: "dwb-actions" }, (0, import_react3.createElement)("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, "\u5220\u9664\u6761\u76EE"))
    )
  );
}
function WorldBookPanel({ sessionId, close }) {
  const [catalog, setCatalog] = (0, import_react3.useState)(null);
  const [document2, setDocument] = (0, import_react3.useState)(null);
  const [draft, setDraft] = (0, import_react3.useState)(null);
  const [selection, setSelection] = (0, import_react3.useState)([]);
  const [active, setActive] = (0, import_react3.useState)(null);
  const [embeddedCharacterId, setEmbeddedCharacterId] = (0, import_react3.useState)(null);
  const [embeddedDraft, setEmbeddedDraft] = (0, import_react3.useState)(null);
  const [embeddedDirty, setEmbeddedDirty] = (0, import_react3.useState)(false);
  const [dirty, setDirty] = (0, import_react3.useState)(false);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [status, setStatus] = (0, import_react3.useState)({ text: "\u52A0\u8F7D\u4E2D\u2026", error: false });
  const fileRef = (0, import_react3.useRef)(null);
  const generation = (0, import_react3.useRef)(0);
  const run = (0, import_react3.useCallback)(async (operation, success) => {
    setBusy(true);
    try {
      const value = await operation();
      setStatus({ text: success, error: false });
      return value;
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const refresh = (0, import_react3.useCallback)(async (preferredId) => {
    const currentGeneration = ++generation.current;
    const list = await api3("/world-books");
    const selected = sessionId ? await api3(`/world-book-selection?sessionId=${encodeURIComponent(sessionId)}`) : { selection: { worldBookIds: [] } };
    const activeView = await api3(`/active${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`);
    const characterId = activeView.resources?.characterCard?.id ?? null;
    let embeddedBook = null;
    if (characterId !== null) {
      const character = await api3(`/characters/${encodeURIComponent(characterId)}`);
      embeddedBook = character.character?.data?.characterBook ?? null;
    }
    if (currentGeneration !== generation.current) return;
    const ids = selected.selection?.worldBookIds ?? [];
    setCatalog(list);
    setSelection(ids);
    setActive(activeView);
    setEmbeddedCharacterId(characterId);
    setEmbeddedDraft(embeddedBook === null ? null : structuredClone(embeddedBook));
    setEmbeddedDirty(false);
    const id = preferredId ?? document2?.id ?? ids[0] ?? list.worldBooks[0]?.id ?? null;
    if (id === null || !list.worldBooks.some((item) => item.id === id)) {
      setDocument(null);
      setDraft(null);
      setDirty(false);
      return;
    }
    const detail = await api3(`/world-books/${encodeURIComponent(id)}`);
    if (currentGeneration !== generation.current) return;
    setDocument(detail.worldBook);
    setDraft(structuredClone(detail.worldBook.book));
    setDirty(false);
  }, [document2?.id, sessionId]);
  (0, import_react3.useEffect)(() => {
    run(() => refresh(), "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u52A0\u8F7D");
    const onRefresh = () => run(() => refresh(), "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u5237\u65B0");
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => {
      generation.current += 1;
      window.removeEventListener("dsh-tavern:refresh", onRefresh);
    };
  }, [refresh, run]);
  const load = (id) => run(async () => {
    const detail = await api3(`/world-books/${encodeURIComponent(id)}`);
    setDocument(detail.worldBook);
    setDraft(structuredClone(detail.worldBook.book));
    setDirty(false);
  }, "\u4E16\u754C\u4E66\u8BE6\u60C5\u5DF2\u52A0\u8F7D");
  const create = () => run(async () => {
    const data = await api3("/world-books", { method: "POST", body: JSON.stringify({ name: "Untitled World Book" }) });
    await refresh(data.worldBook.id);
  }, "\u5DF2\u521B\u5EFA\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD");
  const importFile = (file) => run(async () => {
    const response = await fetch(`${API_ROOT3}/world-books/import?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: file
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(errorMessage2(data, response.status));
    if (fileRef.current !== null) fileRef.current.value = "";
    await refresh(data.worldBook.id);
  }, "\u4E16\u754C\u4E66\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD");
  const save = () => run(async () => {
    const data = await api3(`/world-books/${encodeURIComponent(document2.id)}`, { method: "PATCH", body: JSON.stringify({ book: draft }) });
    setDocument(data.worldBook);
    setDraft(structuredClone(data.worldBook.book));
    setDirty(false);
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  }, "\u4E16\u754C\u4E66\u4FEE\u6539\u5DF2\u6301\u4E45\u5316\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9");
  const saveSelection = () => run(async () => {
    if (!sessionId) throw new Error("\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u4E16\u754C\u4E66");
    const data = await api3("/world-book-selection", { method: "POST", body: JSON.stringify({ sessionId, worldBookIds: selection }) });
    setSelection(data.selection.worldBookIds);
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  }, "\u5F53\u524D\u4F1A\u8BDD\u7684\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58");
  const remove = () => run(async () => {
    if (document2 === null || !window.confirm(`\u5220\u9664\u72EC\u7ACB\u4E16\u754C\u4E66\u201C${document2.name}\u201D\uFF1F\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u4E0D\u4F1A\u53D7\u5230\u5F71\u54CD\u3002`)) return;
    await api3(`/world-books/${encodeURIComponent(document2.id)}`, { method: "DELETE" });
    setDocument(null);
    setDraft(null);
    await refresh(null);
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  }, "\u72EC\u7ACB\u4E16\u754C\u4E66\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u7406");
  const saveEmbedded = () => run(async () => {
    const data = await api3(`/characters/${encodeURIComponent(embeddedCharacterId)}/world-book`, {
      method: "PATCH",
      body: JSON.stringify({ characterBook: embeddedDraft })
    });
    setEmbeddedDraft(structuredClone(data.character.data.characterBook));
    setEmbeddedDirty(false);
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  }, "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9");
  const updateEntry = (index, patch) => {
    setDraft((current) => {
      const next = structuredClone(current);
      next.entries[index] = { ...next.entries[index], ...patch };
      return next;
    });
    setDirty(true);
  };
  const entries = draft?.entries ?? [];
  const embeddedEntries = embeddedDraft?.entries ?? [];
  const embedded = active?.resources?.worldBooks?.filter((item) => item.kind === "embedded-character-book") ?? [];
  const diagnostics = active?.diagnostics?.filter((item) => String(item.code ?? "").includes("WORLD_BOOK")) ?? [];
  return (0, import_react3.createElement)(
    "div",
    { className: "dwb-panel" },
    (0, import_react3.createElement)("div", { className: "dwb-header" }, (0, import_react3.createElement)("div", { className: "dwb-title" }, "\u4E16\u754C\u4FE1\u606F\uFF08World Book\uFF09"), (0, import_react3.createElement)("button", { className: "dwb-close", type: "button", onClick: close, "aria-label": "\u5173\u95ED\u4E16\u754C\u4E66\u4FA7\u8FB9\u680F" }, "\u2715")),
    (0, import_react3.createElement)(
      "div",
      { className: "dwb-body" },
      (0, import_react3.createElement)(
        "div",
        { className: "dwb-toolbar" },
        (0, import_react3.createElement)("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, "\u5BFC\u5165 JSON"),
        (0, import_react3.createElement)("button", { className: "dwb-button", type: "button", disabled: busy, onClick: create }, "\u65B0\u5EFA\u4E16\u754C\u4E66"),
        (0, import_react3.createElement)("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => {
          if (!dirty || window.confirm("\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F")) run(() => refresh(), "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u5237\u65B0");
        } }, "\u5237\u65B0"),
        (0, import_react3.createElement)("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,application/json", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      (0, import_react3.createElement)("p", { className: "dwb-note" }, `\u5F53\u524D\u4F1A\u8BDD\uFF1A${sessionId || "\u65E0"}\u3002\u53EF\u7ED1\u5B9A\u96F6\u672C\u3001\u4E00\u672C\u6216\u591A\u672C\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u7ED1\u5B9A\u987A\u5E8F\u4FDD\u6301\u7A33\u5B9A\u3002`),
      (0, import_react3.createElement)("div", { className: "dwb-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.text),
      (0, import_react3.createElement)(
        "div",
        { className: "dwb-resource" },
        (0, import_react3.createElement)("div", { className: "dwb-resource-title" }, "\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A"),
        catalog?.worldBooks.length ? (0, import_react3.createElement)("div", { className: "dwb-bindings" }, ...catalog.worldBooks.map((item) => (0, import_react3.createElement)(
          "label",
          { className: "dwb-check", key: item.id },
          (0, import_react3.createElement)("input", { type: "checkbox", checked: selection.includes(item.id), onChange: (event) => setSelection((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)) }),
          `${item.name}\uFF08${item.entryCount} \u6761\uFF09`
        ))) : (0, import_react3.createElement)("p", { className: "dwb-note" }, "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002"),
        (0, import_react3.createElement)(
          "div",
          { className: "dwb-actions" },
          (0, import_react3.createElement)("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !sessionId, onClick: saveSelection }, "\u4FDD\u5B58\u4F1A\u8BDD\u7ED1\u5B9A"),
          (0, import_react3.createElement)("button", { className: "dwb-button", type: "button", disabled: busy || !sessionId || selection.length === 0, onClick: () => setSelection([]) }, "\u6E05\u7A7A\u5F85\u4FDD\u5B58\u9009\u62E9")
        )
      ),
      (0, import_react3.createElement)(Field3, { label: "\u6D4F\u89C8\u72EC\u7ACB\u4E16\u754C\u4E66" }, (0, import_react3.createElement)(
        "select",
        { className: "dwb-select", value: document2?.id ?? "", disabled: busy || !catalog?.worldBooks.length, onChange: (event) => {
          if (!dirty || window.confirm("\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F")) load(event.target.value);
        } },
        ...catalog?.worldBooks.length ? [] : [(0, import_react3.createElement)("option", { key: "empty", value: "" }, "\u8D44\u6E90\u5E93\u4E3A\u7A7A")],
        ...(catalog?.worldBooks ?? []).map((item) => (0, import_react3.createElement)("option", { key: item.id, value: item.id }, `${item.name} \xB7 ${item.sourceFormat}`))
      )),
      draft === null ? null : (0, import_react3.createElement)(
        "div",
        { className: "dwb-resource" },
        (0, import_react3.createElement)(Field3, { label: "\u4E16\u754C\u4E66\u540D\u79F0" }, (0, import_react3.createElement)("input", { className: "dwb-input", value: draft.name ?? "", onChange: (event) => {
          setDraft((current) => ({ ...current, name: event.target.value }));
          setDirty(true);
        } })),
        (0, import_react3.createElement)("p", { className: "dwb-meta" }, `${document2.source.format} \xB7 ${entries.length} \u6761 \xB7 \u672A\u77E5\u5B57\u6BB5\u5728\u4FDD\u5B58\u548C\u5BFC\u51FA\u65F6\u7A33\u5B9A\u4FDD\u7559`),
        (0, import_react3.createElement)(
          "div",
          { className: "dwb-actions" },
          (0, import_react3.createElement)("button", { className: "dwb-button", type: "button", onClick: () => {
            setDraft((current) => ({ ...current, entries: [...current.entries, createWorldBookEntry(current.entries)] }));
            setDirty(true);
          } }, "\u65B0\u589E\u6761\u76EE"),
          (0, import_react3.createElement)("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !dirty, onClick: save }, dirty ? "\u4FDD\u5B58\u4FEE\u6539" : "\u5DF2\u4FDD\u5B58"),
          (0, import_react3.createElement)("a", { className: "dwb-button", href: `${API_ROOT3}/world-books/${encodeURIComponent(document2.id)}/json`, download: "" }, "\u5BFC\u51FA JSON"),
          (0, import_react3.createElement)("button", { className: "dwb-button dwb-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664\u72EC\u7ACB\u4E66")
        ),
        ...entries.map((entry, index) => (0, import_react3.createElement)(EntryEditor, { key: `${String(entry.uid)}-${index}`, entry, index, update: updateEntry, remove: (itemIndex) => {
          if (window.confirm("\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002")) {
            setDraft((current) => ({ ...current, entries: current.entries.filter((_item, candidate) => candidate !== itemIndex) }));
            setDirty(true);
          }
        } }))
      ),
      embeddedDraft !== null ? (0, import_react3.createElement)(
        "div",
        { className: "dwb-resource" },
        (0, import_react3.createElement)("div", { className: "dwb-resource-title" }, embeddedDraft.name || embedded[0]?.name || "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66"),
        (0, import_react3.createElement)("p", { className: "dwb-note" }, `${embeddedEntries.length} \u6761\u3002\u5B83\u4E0E\u72EC\u7ACB\u4E66\u5171\u7528 matcher/loader\uFF1B\u5220\u9664\u72EC\u7ACB\u4E66\u4E0D\u4F1A\u4FEE\u6539\u6216\u89E3\u7ED1\u89D2\u8272\u5361\u5185\u5D4C\u4E66\u3002`),
        (0, import_react3.createElement)(
          "div",
          { className: "dwb-actions" },
          (0, import_react3.createElement)("button", { className: "dwb-button", type: "button", onClick: () => {
            const ids = embeddedEntries.map((entry) => Number(entry.id)).filter(Number.isSafeInteger);
            const id = ids.length === 0 ? 0 : Math.max(...ids) + 1;
            setEmbeddedDraft((current) => ({ ...structuredClone(current), entries: [...current.entries, { id, keys: [], secondary_keys: [], comment: `\u65B0\u6761\u76EE ${id}`, content: "", enabled: true, constant: false, selective: false, insertion_order: 100, position: "after_char", extensions: { position: 1, probability: 100, useProbability: true } }] }));
            setEmbeddedDirty(true);
          } }, "\u65B0\u589E\u5185\u5D4C\u6761\u76EE"),
          (0, import_react3.createElement)("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !embeddedDirty, onClick: saveEmbedded }, embeddedDirty ? "\u4FDD\u5B58\u5185\u5D4C\u4E66" : "\u5185\u5D4C\u4E66\u5DF2\u4FDD\u5B58")
        ),
        ...embeddedEntries.map((entry, index) => (0, import_react3.createElement)(EmbeddedEntryEditor, { key: `${String(entry.id)}-${index}`, entry, index, update: (itemIndex, value) => {
          setEmbeddedDraft((current) => {
            const next = structuredClone(current);
            next.entries[itemIndex] = { ...next.entries[itemIndex], ...value };
            return next;
          });
          setEmbeddedDirty(true);
        }, remove: (itemIndex) => {
          if (window.confirm("\u5220\u9664\u8FD9\u4E2A\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002")) {
            setEmbeddedDraft((current) => ({ ...structuredClone(current), entries: current.entries.filter((_item, candidate) => candidate !== itemIndex) }));
            setEmbeddedDirty(true);
          }
        } }))
      ) : null,
      diagnostics.length > 0 ? (0, import_react3.createElement)("details", { className: "dwb-resource" }, (0, import_react3.createElement)("summary", { className: "dwb-resource-title" }, `\u8FD0\u884C\u8BCA\u65AD\uFF08${diagnostics.length}\uFF09`), (0, import_react3.createElement)("ul", { className: "dwb-list" }, ...diagnostics.map((item, index) => (0, import_react3.createElement)("li", { key: `${item.code}-${index}` }, item.message)))) : null,
      (0, import_react3.createElement)("p", { className: "dwb-note" }, "\u5B9E\u9645\u6FC0\u6D3B\u3001\u6392\u5E8F\u3001\u6982\u7387\u548C\u9884\u7B97\u7531\u5171\u4EAB matcher \u786E\u5B9A\uFF1B\u6700\u7EC8\u6CE8\u5165\u4ECD\u7531 Tavern loader \u7EDF\u4E00\u5B8C\u6210\u3002\u5F53\u524D\u626B\u63CF\u57FA\u4E8E\u5DF2\u6301\u4E45\u5316\u7684\u4F1A\u8BDD\u5386\u53F2\uFF0C\u521A\u63D0\u4EA4\u7684\u540C\u8F6E\u7528\u6237\u8F93\u5165\u53EF\u80FD\u5230\u4E0B\u4E00\u8F6E\u624D\u89E6\u53D1\u3002")
    )
  );
}
function installWorldBookStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-world-book"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern-world-book";
  style.textContent = css3;
  document.head.append(style);
}

// packages/user/src/client.js
var import_react4 = require("react");
var API_ROOT4 = "/dsh-tavern/api";
var css4 = `
.dtu-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dtu-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtu-title{font-size:14px;font-weight:650;flex:1}.dtu-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtu-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtu-toolbar,.dtu-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtu-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtu-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtu-button:disabled{opacity:.5;cursor:default}.dtu-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtu-danger{color:var(--dsw-alias-state-error)}.dtu-field{display:flex;flex-direction:column;gap:5px}.dtu-label{font-size:11px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtu-input,.dtu-textarea,.dtu-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:8px 9px}.dtu-input,.dtu-select{height:34px}.dtu-textarea{min-height:220px;line-height:1.5;resize:vertical}.dtu-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtu-status{font-size:11px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtu-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtu-editor{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtu-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`;
function errorMessage3(data, status) {
  return data?.error?.message ?? data?.error ?? `HTTP ${status}`;
}
async function api4(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_ROOT4}${path}`, {
    ...options,
    headers: {
      ...method === "GET" || method === "HEAD" ? {} : { "Content-Type": "application/json" },
      ...options.headers
    }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(errorMessage3(data, response.status));
  return data;
}
function Field4({ label, children }) {
  return (0, import_react4.createElement)("label", { className: "dtu-field" }, (0, import_react4.createElement)("span", { className: "dtu-label" }, label), children);
}
function notifyRefresh() {
  window.dispatchEvent(new Event("dsh-tavern:refresh"));
}
function UserPanel({ sessionId, sessionBlank, close }) {
  const [users, setUsers] = (0, import_react4.useState)(null);
  const [draft, setDraft] = (0, import_react4.useState)(null);
  const [selectedUserId, setSelectedUserId] = (0, import_react4.useState)(null);
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [status, setStatus] = (0, import_react4.useState)({ text: "\u52A0\u8F7D\u4E2D\u2026", error: false });
  const generation = (0, import_react4.useRef)(0);
  const draftId = (0, import_react4.useRef)(null);
  draftId.current = draft?.id ?? null;
  const run = (0, import_react4.useCallback)(async (operation, success) => {
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
  const refresh = (0, import_react4.useCallback)(async (preferredId) => {
    const current = ++generation.current;
    const catalog = await api4("/users");
    const binding = sessionId ? await api4(`/user-selection?sessionId=${encodeURIComponent(sessionId)}`) : { selection: null };
    if (current !== generation.current) return;
    setUsers(catalog.users);
    setSelectedUserId(binding.selection?.userId ?? null);
    const id = preferredId ?? binding.selection?.userId ?? catalog.users[0]?.id ?? null;
    setDraft(id === null ? null : structuredClone(catalog.users.find((user) => user.id === id) ?? null));
  }, [sessionId]);
  (0, import_react4.useEffect)(() => {
    run(() => refresh(), "\u7528\u6237\u8D44\u6E90\u5DF2\u52A0\u8F7D");
    const onRefresh = () => run(() => refresh(draftId.current), "\u7528\u6237\u8D44\u6E90\u5DF2\u5237\u65B0");
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => {
      generation.current += 1;
      window.removeEventListener("dsh-tavern:refresh", onRefresh);
    };
  }, [refresh, run]);
  const create = (0, import_react4.useCallback)(() => run(async () => {
    const data = await api4("/users", { method: "POST", body: JSON.stringify({ name: "\u65B0\u7528\u6237", description: "" }) });
    draftId.current = data.user.id;
    await refresh(data.user.id);
    notifyRefresh();
  }, "\u7528\u6237\u8D44\u6E90\u5DF2\u521B\u5EFA\uFF1B\u4FDD\u5B58\u540D\u5B57\u548C\u63CF\u8FF0\u540E\u518D\u7ED1\u5B9A"), [refresh, run]);
  const save = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null) return;
    const data = await api4(`/users/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: draft.name, description: draft.description })
    });
    draftId.current = data.user.id;
    setDraft(data.user);
    setUsers((current) => current?.map((user) => user.id === data.user.id ? data.user : user) ?? current);
    notifyRefresh();
  }, "\u540D\u5B57\u548C\u63CF\u8FF0\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u7ACB\u5373\u4F7F\u7528\u65B0\u5185\u5BB9"), [draft, run]);
  const bind = (0, import_react4.useCallback)(() => run(async () => {
    if (!sessionId || draft === null) throw new Error("\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u5E76\u9009\u62E9\u7528\u6237\u8D44\u6E90");
    if (selectedUserId !== draft.id && sessionBlank === false && !window.confirm("\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u5207\u6362\u7528\u6237\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F")) return;
    const data = await api4("/user-selection", {
      method: "POST",
      body: JSON.stringify({ sessionId, userId: draft.id })
    });
    setSelectedUserId(data.selection.userId);
    notifyRefresh();
  }, "\u7528\u6237\u5DF2\u7ED1\u5B9A\uFF1B\u5F53\u524D\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u4F7F\u7528\u8BE5\u540D\u5B57\u548C\u63CF\u8FF0"), [draft, run, selectedUserId, sessionBlank, sessionId]);
  const unbind = (0, import_react4.useCallback)(() => run(async () => {
    if (!sessionId) throw new Error("\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u7ED1\u7684\u4F1A\u8BDD");
    await api4("/user-selection", { method: "POST", body: JSON.stringify({ sessionId, userId: null }) });
    setSelectedUserId(null);
    notifyRefresh();
  }, "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u7528\u6237\u7ED1\u5B9A"), [run, sessionId]);
  const remove = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null || !window.confirm(`\u5220\u9664\u7528\u6237\u201C${draft.name}\u201D\uFF1F\u6240\u6709\u4F1A\u8BDD\u4E2D\u7684\u5BF9\u5E94\u7ED1\u5B9A\u90FD\u4F1A\u6E05\u9664\u3002`)) return;
    await api4(`/users/${encodeURIComponent(draft.id)}`, { method: "DELETE", body: "{}" });
    draftId.current = null;
    await refresh(null);
    notifyRefresh();
  }, "\u7528\u6237\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664"), [draft, refresh, run]);
  const activeName = selectedUserId === null ? "\u672A\u7ED1\u5B9A\u7528\u6237" : users?.find((user) => user.id === selectedUserId)?.name ?? selectedUserId;
  return (0, import_react4.createElement)(
    "div",
    { className: "dtu-panel" },
    (0, import_react4.createElement)(
      "div",
      { className: "dtu-header" },
      (0, import_react4.createElement)("div", { className: "dtu-title" }, "Tavern \u7528\u6237"),
      (0, import_react4.createElement)("button", { className: "dtu-close", type: "button", title: "\u5173\u95ED\u7528\u6237\u9762\u677F", "aria-label": "\u5173\u95ED\u7528\u6237\u4FA7\u8FB9\u680F", onClick: close }, "\u2715")
    ),
    (0, import_react4.createElement)(
      "div",
      { className: "dtu-body" },
      (0, import_react4.createElement)(
        "div",
        { className: "dtu-toolbar" },
        (0, import_react4.createElement)("button", { className: "dtu-button", type: "button", disabled: busy, onClick: create }, "\u65B0\u5EFA\u7528\u6237"),
        (0, import_react4.createElement)("button", { className: "dtu-button", type: "button", disabled: busy, onClick: () => run(() => refresh(draft?.id), "\u7528\u6237\u8D44\u6E90\u5DF2\u5237\u65B0") }, "\u5237\u65B0")
      ),
      (0, import_react4.createElement)(Field4, { label: "\u6D4F\u89C8\u7528\u6237\u8D44\u6E90" }, (0, import_react4.createElement)(
        "select",
        {
          className: "dtu-select",
          value: draft?.id ?? "",
          disabled: busy || users === null || users.length === 0,
          onChange: (event) => setDraft(structuredClone(users.find((user) => user.id === event.target.value) ?? null))
        },
        ...users?.length ? [] : [(0, import_react4.createElement)("option", { key: "empty", value: "" }, "\u7528\u6237\u8D44\u6E90\u5E93\u4E3A\u7A7A")],
        ...(users ?? []).map((user) => (0, import_react4.createElement)("option", { key: user.id, value: user.id }, user.name))
      )),
      (0, import_react4.createElement)("p", { className: "dtu-note" }, `\u5F53\u524D\u4F1A\u8BDD\uFF1A${sessionId || "\u65E0"}\uFF1B\u7ED1\u5B9A\uFF1A${activeName}`),
      (0, import_react4.createElement)("div", { className: "dtu-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.text),
      draft === null ? (0, import_react4.createElement)("p", { className: "dtu-note" }, users === null ? "\u6B63\u5728\u52A0\u8F7D\u7528\u6237\u8D44\u6E90\u2026" : "\u521B\u5EFA\u4E00\u4E2A\u53EA\u542B\u540D\u5B57\u548C\u63CF\u8FF0\u7684\u7528\u6237\u8D44\u6E90\u3002") : (0, import_react4.createElement)(
        "div",
        { className: "dtu-editor" },
        (0, import_react4.createElement)(Field4, { label: "\u540D\u5B57\uFF08\u7528\u4E8E {{user}} \u5B8F\uFF09" }, (0, import_react4.createElement)("input", { className: "dtu-input", value: draft.name, maxLength: 200, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })),
        (0, import_react4.createElement)(Field4, { label: "\u63CF\u8FF0\uFF08\u8FDB\u5165 personaDescription marker\uFF1B\u7F3A marker \u65F6\u7531 loader \u7A33\u5B9A\u964D\u7EA7\uFF09" }, (0, import_react4.createElement)("textarea", { className: "dtu-textarea", value: draft.description, maxLength: 1e5, onChange: (event) => setDraft((current) => ({ ...current, description: event.target.value })) })),
        (0, import_react4.createElement)(
          "div",
          { className: "dtu-actions" },
          (0, import_react4.createElement)("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy, onClick: save }, "\u4FDD\u5B58\u8D44\u6E90"),
          (0, import_react4.createElement)("button", { className: "dtu-button", type: "button", disabled: busy || !sessionId, onClick: bind }, selectedUserId === draft.id ? "\u5237\u65B0\u4F1A\u8BDD\u7ED1\u5B9A" : "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD")
        ),
        (0, import_react4.createElement)("button", { className: "dtu-button", type: "button", disabled: busy || !sessionId || selectedUserId === null, onClick: unbind }, "\u89E3\u9664\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A"),
        (0, import_react4.createElement)("p", { className: "dtu-note" }, "\u7528\u6237\u8D44\u6E90\u4E0D\u5305\u542B\u5934\u50CF\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6 DSH Agent \u8EAB\u4EFD\u3002loader \u53EA\u5728\u7EDF\u4E00 Tavern profile \u4E2D\u89E3\u6790\u540D\u5B57\u5B8F\u5E76\u653E\u7F6E\u4E00\u6B21\u63CF\u8FF0\u3002"),
        (0, import_react4.createElement)("div", { className: "dtu-footer" }, (0, import_react4.createElement)("button", { className: "dtu-button dtu-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664\u7528\u6237"))
      )
    )
  );
}
function installUserStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-user"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern-user";
  style.textContent = css4;
  document.head.append(style);
}

// packages/client/src/state.js
var TAVERN_MENU_ITEMS = Object.freeze([
  { id: "preset", label: "\u9884\u8BBE", available: true },
  { id: "world-info", label: "\u4E16\u754C\u4FE1\u606F", available: true },
  { id: "character", label: "\u89D2\u8272\u5361", available: true },
  { id: "user", label: "\u7528\u6237", available: true }
]);
var TAVERN_LAUNCHER_SIZE = 44;
var TAVERN_LAUNCHER_PANEL = Object.freeze({ width: 220, height: 244 });
function clampLauncherAnchor(position, viewport2) {
  const width = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport2?.width) || TAVERN_LAUNCHER_SIZE);
  const height = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport2?.height) || TAVERN_LAUNCHER_SIZE);
  const margin = 8;
  return {
    x: Math.min(width - TAVERN_LAUNCHER_SIZE - margin, Math.max(margin, Number(position?.x) || margin)),
    y: Math.min(height - TAVERN_LAUNCHER_SIZE - margin, Math.max(margin, Number(position?.y) || margin))
  };
}
function launcherPlacement(anchor, viewport2, expanded = false) {
  const point = clampLauncherAnchor(anchor, viewport2);
  const opensLeft = point.x + TAVERN_LAUNCHER_PANEL.width / 2 > viewport2.width / 2;
  const opensUp = point.y + TAVERN_LAUNCHER_PANEL.height / 2 > viewport2.height;
  return {
    side: opensLeft ? "left" : "right",
    vertical: opensUp ? "up" : "down",
    left: expanded && opensLeft ? point.x - TAVERN_LAUNCHER_PANEL.width + TAVERN_LAUNCHER_SIZE : point.x,
    top: expanded && opensUp ? point.y - TAVERN_LAUNCHER_PANEL.height + TAVERN_LAUNCHER_SIZE : point.y,
    anchor: point
  };
}

// packages/client/src/index.js
var css5 = `
.dtv-layer{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:Inter,var(--dsw-font-family),sans-serif;color:var(--dsw-alias-label-primary)}
.dtv-launcher{position:absolute;z-index:2;width:44px;height:44px;pointer-events:auto;overflow:hidden;border:0 solid transparent;border-radius:22px;background:transparent;box-shadow:none;transition:width .22s ease,height .22s ease,border-radius .22s ease,background-color .18s ease,box-shadow .18s ease;display:block}
.dtv-launcher[data-open=true]{width:220px;height:244px;border-width:1px;border-color:var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 12px 34px rgba(0,0,0,.24))}
.dtv-ball-row{position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:flex-start;pointer-events:none}.dtv-launcher[data-side=left] .dtv-ball-row{justify-content:flex-end}.dtv-launcher[data-vertical=up] .dtv-ball-row{top:auto;bottom:0;align-items:flex-end}
.dtv-ball{pointer-events:auto;touch-action:none;user-select:none;width:44px;height:44px;flex:none;border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 76%,white);border-radius:50%;background:var(--dsw-alias-state-business-primary);box-shadow:var(--ds-shadow-2,0 5px 18px rgba(0,0,0,.22));color:#fff;font-size:17px;font-weight:750;cursor:grab;transition:filter .15s ease,transform .18s ease}.dtv-ball:hover{filter:brightness(1.08)}.dtv-ball:active{cursor:grabbing}.dtv-launcher[data-open=true] .dtv-ball{transform:scale(.82)}
.dtv-menu{position:absolute;left:8px;right:8px;top:52px;bottom:8px;padding:1px;display:flex;flex-direction:column;gap:4px;opacity:0;transform:translateY(-6px);transition:opacity .13s ease .1s,transform .18s ease .08s}.dtv-launcher[data-open=true] .dtv-menu{opacity:1;transform:none}.dtv-launcher[data-vertical=up] .dtv-menu{top:8px;bottom:52px;transform:translateY(6px)}.dtv-launcher[data-open=true][data-vertical=up] .dtv-menu{transform:none}
.dtv-menu-title{padding:5px 8px 7px;font-size:11px;font-weight:650;color:var(--dsw-alias-label-tertiary)}
.dtv-menu-item{height:36px;border:0;border-radius:8px;padding:0 10px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between}.dtv-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-menu-item[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip));font-weight:650}.dtv-menu-item[data-available=false]::after{content:'\u89C4\u5212\u4E2D';font-size:10px;color:var(--dsw-alias-label-tertiary)}
.dtv-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}
.dtv-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtv-title{font-size:14px;font-weight:650;flex:1}.dtv-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtv-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtv-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtv-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtv-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtv-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtv-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-button:disabled{opacity:.5;cursor:default}
.dtv-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:7px}.dtv-resource-title{font-size:12px;font-weight:650}.dtv-resource-meta{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}.dtv-list{margin:0;padding-left:18px;font-size:11px;line-height:1.55}
.dtv-book-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.dtv-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);overflow:hidden}.dtv-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:11px}.dtv-entry>summary::-webkit-details-marker{display:none}.dtv-entry-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dtv-entry[data-enabled=true] .dtv-entry-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dtv-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtv-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px}.dtv-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dtv-field{display:flex;flex-direction:column;gap:4px}.dtv-label{font-size:10px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dtv-input,.dtv-select,.dtv-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:7px 8px}.dtv-input,.dtv-select{height:32px}.dtv-textarea{min-height:94px;resize:vertical;line-height:1.45}.dtv-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dtv-checks{display:flex;flex-wrap:wrap;gap:10px}.dtv-check{display:flex;gap:5px;align-items:center;font-size:10px}.dtv-entry-actions{display:flex;justify-content:flex-end}.dtv-danger{color:var(--dsw-alias-state-error)}
`;
var LAUNCHER_STORAGE_KEY = "dsh-tavern:launcher-position:v1";
function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}
function initialLauncherAnchor() {
  try {
    const stored = window.localStorage.getItem(LAUNCHER_STORAGE_KEY);
    if (stored !== null) return clampLauncherAnchor(JSON.parse(stored), viewport());
  } catch {
  }
  return clampLauncherAnchor({ x: window.innerWidth - 60, y: 14 }, viewport());
}
function persistLauncherAnchor(anchor) {
  try {
    window.localStorage.setItem(LAUNCHER_STORAGE_KEY, JSON.stringify(anchor));
  } catch {
  }
}
function TavernShell({ useSessions }) {
  const [menuOpen, setMenuOpen] = (0, import_react5.useState)(false);
  const [surface, setSurface] = (0, import_react5.useState)(null);
  const [anchor, setAnchor] = (0, import_react5.useState)(initialLauncherAnchor);
  const drag = (0, import_react5.useRef)(null);
  const suppressClick = (0, import_react5.useRef)(false);
  const sessionId = useSessions((state) => state.current);
  const sessionBlank = useSessions((state) => state.current === void 0 || state.current === null ? true : state.byId?.[state.current]?.blank === true);
  const close = () => setSurface(null);
  (0, import_react5.useEffect)(() => {
    const onResize = () => setAnchor((current) => {
      const next = clampLauncherAnchor(current, viewport());
      persistLauncherAnchor(next);
      return next;
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const startDrag = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: anchor,
      latest: anchor,
      moved: false
    };
  };
  const moveDrag = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    if (Math.hypot(dx, dy) >= 4) drag.current.moved = true;
    if (!drag.current.moved) return;
    const next = clampLauncherAnchor({
      x: drag.current.origin.x + dx,
      y: drag.current.origin.y + dy
    }, viewport());
    drag.current.latest = next;
    setAnchor(next);
  };
  const endDrag = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (drag.current.moved) {
      suppressClick.current = true;
      persistLauncherAnchor(drag.current.latest);
    }
    drag.current = null;
  };
  const toggleMenu = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setMenuOpen((value) => !value);
  };
  const open = (id) => {
    setMenuOpen(false);
    setSurface(id);
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  };
  let panel = null;
  if (surface === "preset") {
    panel = (0, import_react5.createElement)("div", { className: "dtv-panel" }, (0, import_react5.createElement)(PresetSidebar, {
      closePanel: close,
      openPanel: () => {
      },
      sessionId,
      autoOpen: false
    }));
  } else if (surface === "character") {
    panel = (0, import_react5.createElement)(CharacterPanel, { sessionId, sessionBlank, close });
  } else if (surface === "world-info") {
    panel = (0, import_react5.createElement)(WorldBookPanel, { sessionId, close });
  } else if (surface === "user") {
    panel = (0, import_react5.createElement)(UserPanel, { sessionId, sessionBlank, close });
  }
  const placement = launcherPlacement(anchor, viewport(), menuOpen);
  return (0, import_react5.createElement)(
    "div",
    { className: "dtv-layer" },
    panel,
    (0, import_react5.createElement)(
      "div",
      {
        className: "dtv-launcher",
        "data-open": menuOpen,
        "data-side": placement.side,
        "data-vertical": placement.vertical,
        style: { left: placement.left, top: placement.top }
      },
      (0, import_react5.createElement)("div", { className: "dtv-ball-row" }, (0, import_react5.createElement)("button", {
        className: "dtv-ball",
        type: "button",
        title: "\u62D6\u52A8\u53EF\u79FB\u52A8\uFF1B\u70B9\u51FB\u5C55\u5F00 Tavern \u8D44\u6E90\u9762\u677F",
        "aria-label": "\u62D6\u52A8\u53EF\u79FB\u52A8\uFF1B\u70B9\u51FB\u5C55\u5F00 Tavern \u8D44\u6E90\u9762\u677F",
        "aria-expanded": menuOpen,
        onPointerDown: startDrag,
        onPointerMove: moveDrag,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onClick: toggleMenu
      }, "T")),
      menuOpen ? (0, import_react5.createElement)(
        "div",
        { className: "dtv-menu", role: "menu" },
        (0, import_react5.createElement)("div", { className: "dtv-menu-title" }, "dsh-tavern"),
        ...TAVERN_MENU_ITEMS.map((item) => (0, import_react5.createElement)("button", {
          className: "dtv-menu-item",
          type: "button",
          role: "menuitem",
          key: item.id,
          "data-available": item.available,
          "data-active": surface === item.id,
          "aria-current": surface === item.id ? "page" : void 0,
          onClick: () => open(item.id)
        }, item.label))
      ) : null
    )
  );
}
function installStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-shell"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern-shell";
  style.textContent = css5;
  document.head.append(style);
}
var name = "dsh-tavern";
var inject = ["slots", "layout"];
function apply(ctx) {
  installPresetStyles();
  installCharacterStyles();
  installWorldBookStyles();
  installUserStyles();
  installStyles();
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "dsh-tavern-launcher",
    order: 80,
    inject: () => ({})
  }, TavernShell));
}

		return module.exports;
	}
});
