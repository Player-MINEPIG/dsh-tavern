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

// packages/preset/src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
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
.dtt-prompts{display:flex;flex-direction:column;gap:7px}.dtt-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dtt-prompt-summary{display:flex;align-items:center;gap:7px;padding:8px;cursor:pointer;font-size:12px}.dtt-prompt-summary::marker{color:var(--dsw-alias-label-tertiary)}.dtt-prompt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtt-role{font-size:10px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}.dtt-prompt-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:8px}.dtt-row-actions{display:flex;gap:6px}.dtt-row-actions .dtt-button{height:28px;padding:0 8px;flex:1}
.dtt-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);display:grid;grid-template-columns:1fr auto;gap:8px}
.dtt-open-button{height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font-size:11px;cursor:pointer;padding:0 9px}.dtt-open-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
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
function PromptEditor({ prompt, index, total, onPatch, onMove, onDelete }) {
  return (0, import_react.createElement)(
    "details",
    { className: "dtt-prompt" },
    (0, import_react.createElement)(
      "summary",
      { className: "dtt-prompt-summary" },
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
        (0, import_react.createElement)("button", { className: "dtt-button", type: "button", disabled: index === 0, onClick: () => onMove(-1) }, "\u4E0A\u79FB"),
        (0, import_react.createElement)("button", { className: "dtt-button", type: "button", disabled: index === total - 1, onClick: () => onMove(1) }, "\u4E0B\u79FB"),
        (0, import_react.createElement)("button", { className: "dtt-button dtt-danger", type: "button", onClick: onDelete }, "\u5220\u9664")
      )
    )
  );
}
function PresetSidebar({ closePanel, openPanel }) {
  const [catalog, setCatalog] = (0, import_react.useState)({ presets: [], selectedId: null, storageDir: "" });
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [status, setStatus] = (0, import_react.useState)({ text: "\u52A0\u8F7D\u4E2D\u2026", error: false });
  const [advanced, setAdvanced] = (0, import_react.useState)(false);
  const fileRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const timers = [0, 200, 800].map((delay) => window.setTimeout(openPanel, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);
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
  const loadPreset = (0, import_react.useCallback)(async (id) => {
    if (id === null) {
      setDraft(null);
      return;
    }
    const data = await api(`/presets/${encodeURIComponent(id)}`);
    setDraft(data.preset);
  }, []);
  const refresh = (0, import_react.useCallback)(async (preferredId) => {
    const data = await api("/presets");
    setCatalog(data);
    const id = preferredId ?? data.selectedId;
    await loadPreset(id ?? null);
  }, [loadPreset]);
  (0, import_react.useEffect)(() => {
    run(() => refresh(), "\u9884\u8BBE\u5DF2\u52A0\u8F7D");
  }, [refresh, run]);
  const choose = (0, import_react.useCallback)((id) => run(async () => {
    await api("/select", { method: "POST", body: body({ id: id || null }) });
    await refresh(id || null);
  }, id ? "\u9884\u8BBE\u5DF2\u9009\u62E9\uFF1B\u4E0B\u4E00\u6761\u6D88\u606F\u5C06\u643A\u5E26\u6B64 preset" : "\u5DF2\u505C\u7528 preset"), [refresh, run]);
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
      body: body({ name: draft.name, sampling: draft.sampling, prompts: draft.prompts })
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
  const movePrompt = (index, delta) => setDraft((current) => {
    const prompts = [...current.prompts];
    const target = index + delta;
    if (target < 0 || target >= prompts.length) return current;
    [prompts[index], prompts[target]] = [prompts[target], prompts[index]];
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
      (0, import_react.createElement)("div", { className: "dtt-title" }, "Tavern \u9884\u8BBE", catalog.selectedId ? (0, import_react.createElement)("span", { className: "dtt-active" }, "\u25CF \u5DF2\u542F\u7528") : null),
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
          value: catalog.selectedId ?? "",
          disabled: busy,
          onChange: (event) => choose(event.target.value)
        },
        (0, import_react.createElement)("option", { value: "" }, "\u4E0D\u4F7F\u7528\u9884\u8BBE"),
        ...catalog.presets.map((preset) => (0, import_react.createElement)("option", { key: preset.id, value: preset.id }, `${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`))
      )),
      (0, import_react.createElement)("p", { className: "dtt-note" }, `\u5B58\u50A8\u76EE\u5F55\uFF1A${catalog.storageDir || "\u52A0\u8F7D\u4E2D\u2026"}`),
      (0, import_react.createElement)("div", { className: "dtt-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.text),
      draft === null ? (0, import_react.createElement)("p", { className: "dtt-note" }, "\u8BF7\u9009\u62E9\u6216\u521B\u5EFA\u9884\u8BBE\u4EE5\u5F00\u59CB\u914D\u7F6E\u3002") : (0, import_react.createElement)(
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
        (0, import_react.createElement)("button", { className: "dtt-button", type: "button", onClick: () => setAdvanced((value) => !value) }, advanced ? "\u6536\u8D77 ST \u517C\u5BB9\u53C2\u6570" : "\u5C55\u5F00 ST \u517C\u5BB9\u53C2\u6570"),
        advanced ? (0, import_react.createElement)("div", { className: "dtt-grid" }, ...ST_NUMBER_FIELDS.map(([key, label]) => (0, import_react.createElement)(NumberField, {
          key,
          label,
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value)
        }))) : null,
        advanced ? (0, import_react.createElement)("p", { className: "dtt-note" }, "\u8FD9\u4E9B\u5B57\u6BB5\u4F1A\u88AB\u5B8C\u6574\u4FDD\u5B58\uFF1Bdsh 0.1.0 \u5F53\u524D\u8BF7\u6C42\u534F\u8BAE\u672A\u66B4\u9732\u7684\u53C2\u6570\u4E0D\u4F1A\u5F3A\u884C\u4E0B\u53D1\u7ED9\u9002\u914D\u5668\u3002") : null,
        (0, import_react.createElement)(
          "div",
          { className: "dtt-section" },
          (0, import_react.createElement)(
            "div",
            { className: "dtt-section-title" },
            (0, import_react.createElement)("span", null, `\u63D0\u793A\u8BCD (${draft.prompts.length})`),
            (0, import_react.createElement)("button", { className: "dtt-button", type: "button", onClick: addPrompt }, "\uFF0B \u6DFB\u52A0")
          ),
          (0, import_react.createElement)("div", { className: "dtt-prompts" }, ...draft.prompts.map((prompt, index) => (0, import_react.createElement)(PromptEditor, {
            key: `${prompt.identifier}-${index}`,
            prompt,
            index,
            total: draft.prompts.length,
            onPatch: (patch) => patchPrompt(index, patch),
            onMove: (delta) => movePrompt(index, delta),
            onDelete: () => deletePrompt(index)
          })))
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
  return (0, import_react.createElement)("button", { className: "dtt-open-button", type: "button", onClick: openPanel, title: "\u6253\u5F00 Tavern \u9884\u8BBE\u4FA7\u8FB9\u680F" }, "\u9884\u8BBE");
}
function installStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern";
  style.textContent = css;
  document.head.append(style);
}
var name = "dsh-tavern";
var inject = ["slots", "layout"];
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

		return module.exports;
	}
});
