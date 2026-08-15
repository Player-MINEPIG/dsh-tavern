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
var import_react7 = require("react");

// packages/client/src/i18n.js
var DEFAULT_UI_SETTINGS = Object.freeze({ locale: "zh-CN", scale: 1 });
var SUPPORTED_LOCALES = Object.freeze(["zh-CN", "en"]);
var UI_SCALE_OPTIONS = Object.freeze([0.75, 0.85, 1, 1.15, 1.25, 1.5]);
var MESSAGE_CATALOG = Object.freeze({
  "zh-CN": Object.freeze({
    "common.unavailable": "\u754C\u9762\u6587\u672C\u6682\u4E0D\u53EF\u7528",
    "settings.menu": "\u754C\u9762\u8BBE\u7F6E",
    "settings.title": "Tavern \u754C\u9762\u8BBE\u7F6E",
    "settings.language": "\u754C\u9762\u8BED\u8A00",
    "settings.language.zh": "\u7B80\u4F53\u4E2D\u6587",
    "settings.language.en": "English",
    "settings.scale": "Tavern UI \u7F29\u653E",
    "settings.scale.help": "\u4EC5\u7F29\u653E Tavern \u60AC\u6D6E\u5165\u53E3\u3001\u8D44\u6E90\u9762\u677F\u548C Trace\uFF0C\u4E0D\u5F71\u54CD DSH \u4E3B\u754C\u9762\u3002",
    "settings.currentScale": "\u5F53\u524D\u7F29\u653E\uFF1A{scale}%",
    "settings.reset": "\u6062\u590D\u9ED8\u8BA4",
    "settings.saving": "\u6B63\u5728\u4FDD\u5B58\u8BBE\u7F6E\u2026",
    "settings.saved": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u5E76\u5C06\u5728\u5237\u65B0\u548C\u4F1A\u8BDD\u5207\u6362\u540E\u4FDD\u6301\u3002",
    "settings.loadError": "\u65E0\u6CD5\u8BFB\u53D6\u754C\u9762\u8BBE\u7F6E\uFF1A{message}",
    "settings.saveError": "\u65E0\u6CD5\u4FDD\u5B58\u754C\u9762\u8BBE\u7F6E\uFF1A{message}",
    "settings.close": "\u5173\u95ED\u754C\u9762\u8BBE\u7F6E\u4FA7\u8FB9\u680F",
    "trace.storage.total": "\u603B\u8BA1\u6700\u591A {value}",
    "trace.storage.perSession": "\u6BCF\u4F1A\u8BDD\u6700\u591A {value} \u6761",
    "trace.storage.sessions": "\u6700\u591A {value} \u4E2A\u4F1A\u8BDD",
    "trace.storage.perRecord": "\u5355\u6761\u6700\u591A {value}",
    "trace.storage.summary": "\u63D2\u4EF6\u6709\u754C\u5B58\u50A8\uFF1A{limits}\uFF1B\u5237\u65B0\u6216\u5BBF\u4E3B\u91CD\u542F\u540E\u53EF\u6062\u590D\u3002",
    "trace.keywords.primary": "\u4E3B\uFF1A{values}",
    "trace.keywords.secondary": "\u9644\u52A0\uFF1A{values}",
    "trace.keywords.configured": "\u914D\u7F6E\u5173\u952E\u8BCD\uFF1A{value}",
    "trace.keywords.matched": "\u672C\u8F6E\u547D\u4E2D\uFF1A{value}",
    "trace.bookBudget": "\u9884\u7B97\uFF1A{used}{limit} tokens \xB7 {decisionCount}",
    "trace.decisionCount.one": "{count} \u6761\u51B3\u7B56",
    "trace.decisionCount.other": "{count} \u6761\u51B3\u7B56",
    "trace.decision.group": "\u7EC4 {name}{detail}",
    "trace.decision.probability": "\u6982\u7387 {value}%{roll}",
    "trace.decision.budget": "\u9884\u7B97 {value} tokens",
    "trace.decision.position": "\u4F4D\u7F6E {requested}{result}",
    "trace.recordAligned": "\u8BE5\u8BB0\u5F55\u5DF2\u5BF9\u9F50 DSH request/header #{sequence}{reused}\u3002Tavern profile \u6821\u9A8C\uFF1A{profile}\uFF1B\u91C7\u6837\u5B57\u6BB5\uFF1A{config}\u3002",
    "trace.activationPending": "\u5339\u914D\u57FA\u4E8E\u672C\u6B65\u9AA4 assembly \u7684\u4E34\u65F6\u6FC0\u6D3B\u4E0A\u4E0B\u6587\uFF1A\u6301\u4E45\u5386\u53F2 + {included}/{pending} \u6761\u672C\u8F6E claimed \u8F93\u5165\uFF1B\u4E0D\u4FDD\u5B58\u8F93\u5165\u6B63\u6587{truncated}\u3002",
    "trace.diagnostics": "\u8BCA\u65AD\uFF08{count}\uFF09",
    "world.currentSession": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\u3002\u53EF\u7ED1\u5B9A\u96F6\u672C\u3001\u4E00\u672C\u6216\u591A\u672C\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u7ED1\u5B9A\u987A\u5E8F\u4FDD\u6301\u7A33\u5B9A\u3002",
    "world.catalogItem": "{name}\uFF08{count} \u6761\uFF09",
    "world.documentMeta": "{count} \u6761 \xB7 \u672A\u77E5\u5B57\u6BB5\u5728\u4FDD\u5B58\u548C\u5BFC\u51FA\u65F6\u7A33\u5B9A\u4FDD\u7559",
    "world.embeddedMeta": "{count} \u6761\u3002\u5B83\u4E0E\u72EC\u7ACB\u4E66\u5171\u7528 matcher/loader\uFF1B\u5220\u9664\u72EC\u7ACB\u4E66\u4E0D\u4F1A\u4FEE\u6539\u6216\u89E3\u7ED1\u89D2\u8272\u5361\u5185\u5D4C\u4E66\u3002",
    "world.embeddedEmpty": "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u89D2\u8272\u5361\u7ED1\u5B9A\u7684\u5185\u5D4C\u4E16\u754C\u4E66\u3002\u7ED1\u5B9A\u542B character_book \u7684\u89D2\u8272\u5361\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
    "world.diagnostics": "\u8FD0\u884C\u8BCA\u65AD\uFF08{count}\uFF09",
    "character.embeddedBook": "\u5185\u5D4C character_book \u5DF2\u65E0\u635F\u4FDD\u7559\uFF08{count} \u6761\uFF09\uFF1B\u7ED1\u5B9A\u89D2\u8272\u540E\u7531 Tavern loader \u8C03\u7528\u4E16\u754C\u4FE1\u606F matcher\uFF0C\u89E3\u7ED1\u540E\u4E0D\u518D\u53C2\u4E0E\u540E\u7EED\u8BF7\u6C42\u3002",
    "template.currentSettingsReminder": "\u6A21\u677F\u53EA\u80FD\u7528\u5F53\u524D\u4F1A\u8BDD\u7684 Tavern \u8BBE\u7F6E\u521B\u5EFA\u6216\u66F4\u65B0\u3002\u8BF7\u5728\u60AC\u6D6E\u7403\u7684\u9884\u8BBE\u3001\u89D2\u8272\u5361\u3001\u4E16\u754C\u4E66\u548C\u7528\u6237\u9762\u677F\u4E2D\u67E5\u770B\u6216\u4FEE\u6539\u5F53\u524D\u914D\u7F6E\uFF0C\u518D\u56DE\u5230\u8FD9\u91CC\u4FDD\u5B58\u3002",
    "template.preview.greeting": "\u5F00\u573A\u5E8F\u53F7\uFF1A{value}"
  }),
  en: Object.freeze({
    "common.unavailable": "Interface text unavailable",
    "settings.menu": "UI settings",
    "settings.title": "Tavern UI settings",
    "settings.language": "Interface language",
    "settings.language.zh": "\u7B80\u4F53\u4E2D\u6587",
    "settings.language.en": "English",
    "settings.scale": "Tavern UI scale",
    "settings.scale.help": "Scales only the Tavern launcher, resource panels, and Trace\u2014not the DSH interface.",
    "settings.currentScale": "Current scale: {scale}%",
    "settings.reset": "Restore defaults",
    "settings.saving": "Saving settings\u2026",
    "settings.saved": "Settings saved and retained across refreshes and session changes.",
    "settings.loadError": "Could not load UI settings: {message}",
    "settings.saveError": "Could not save UI settings: {message}",
    "settings.close": "Close the UI settings sidebar",
    "trace.storage.total": "up to {value} total",
    "trace.storage.perSession": "up to {value} entries per session",
    "trace.storage.sessions": "up to {value} sessions",
    "trace.storage.perRecord": "up to {value} per entry",
    "trace.storage.summary": "Bounded plugin storage: {limits}. Restored after refresh or host restart.",
    "trace.keywords.primary": "Primary: {values}",
    "trace.keywords.secondary": "Secondary: {values}",
    "trace.keywords.configured": "Configured keywords: {value}",
    "trace.keywords.matched": "Matched this request: {value}",
    "trace.bookBudget": "Budget: {used}{limit} tokens \xB7 {decisionCount}",
    "trace.decisionCount.one": "{count} decision",
    "trace.decisionCount.other": "{count} decisions",
    "trace.decision.group": "Group {name}{detail}",
    "trace.decision.probability": "Probability {value}%{roll}",
    "trace.decision.budget": "Budget {value} tokens",
    "trace.decision.position": "Position {requested}{result}",
    "trace.recordAligned": "This record is aligned with DSH request/header #{sequence}{reused}. Tavern profile validation: {profile}; sampler fields: {config}.",
    "trace.activationPending": "Matching uses this step\u2019s temporary activation context: durable history + {included}/{pending} claimed messages from this turn; input bodies are not stored{truncated}.",
    "trace.diagnostics": "Diagnostics ({count})",
    "world.currentSession": "Current session: {session}. Bind zero, one, or multiple standalone world books; binding order remains stable.",
    "world.catalogItem": "{name} ({count} entries)",
    "world.documentMeta": "{count} entries \xB7 Unknown fields are preserved across saves and exports",
    "world.embeddedMeta": "{count} entries. It shares the matcher/loader with standalone books; deleting a standalone book never edits or unbinds this embedded book.",
    "world.embeddedEmpty": "The current session has no character-bound embedded world book. Bind a character card with character_book to show it here.",
    "world.diagnostics": "Runtime diagnostics ({count})",
    "character.embeddedBook": "Embedded character_book preserved losslessly ({count} entries); when the character is bound, the Tavern loader invokes the World Info matcher, and unbinding removes it from later requests.",
    "template.currentSettingsReminder": "Templates can only be created or updated from the current session\u2019s Tavern settings. Review or change the current configuration in the launcher\u2019s Preset, Character, World book, and User panels, then return here to save it.",
    "template.preview.greeting": "Greeting index: {value}"
  })
});
var SOURCE_EN = Object.freeze({
  "\u9884\u8BBE": "Preset",
  "\u89D2\u8272\u5361": "Character card",
  "\u89D2\u8272\u5361\u56FE\u7247": "Character card image",
  "\u4E16\u754C\u4E66": "World book",
  "\u7528\u6237": "User",
  "\u754C\u9762\u8BBE\u7F6E": "UI settings",
  "\u8BED\u8A00\u4E0E\u7F29\u653E": "Language and scale",
  "\u672A\u9009\u62E9\u9884\u8BBE": "No preset selected",
  "\u672A\u7ED1\u5B9A\u89D2\u8272": "No character bound",
  "\u672A\u7ED1\u5B9A\u4E16\u754C\u4E66": "No world book bound",
  "\u672A\u7ED1\u5B9A\u7528\u6237": "No user bound",
  "\u65E0\u4F1A\u8BDD": "No session",
  "\u65E0": "None",
  "\u672A\u77E5": "Unknown",
  "\u672A\u77E5\u4F5C\u8005": "Unknown author",
  "\u52A0\u8F7D\u4E2D\u2026": "Loading\u2026",
  "\u5237\u65B0": "Refresh",
  "\u5220\u9664": "Delete",
  "\u4FDD\u5B58": "Save",
  "\u4FDD\u5B58\u4FEE\u6539": "Save changes",
  "\u5DF2\u4FDD\u5B58": "Saved",
  "\u91CD\u65B0\u8F7D\u5165": "Reload",
  "\u65B0\u589E\u6761\u76EE": "Add entry",
  "\u65B0\u5EFA\u7528\u6237": "New user",
  "\u521B\u5EFA\u9884\u8BBE": "Create preset",
  "\u5BFC\u5165 ST JSON": "Import ST JSON",
  "\u5BFC\u5165 JSON / PNG": "Import JSON / PNG",
  "\u5BFC\u51FA JSON": "Export JSON",
  "\u5BFC\u51FA\u539F\u4EF6": "Export original",
  "\u5F53\u524D\u9009\u62E9": "Current selection",
  "\u4E0D\u4F7F\u7528\u9884\u8BBE": "Do not use a preset",
  "\u57FA\u672C\u8BBE\u7F6E": "Basic settings",
  "\u9AD8\u7EA7\u8BBE\u7F6E": "Advanced settings",
  "\u6536\u8D77\u9AD8\u7EA7\u8BBE\u7F6E": "Hide advanced settings",
  "\u5C55\u5F00\u9AD8\u7EA7\u8BBE\u7F6E": "Show advanced settings",
  "\u4FDD\u5B58\u5E76\u5E94\u7528": "Save and apply",
  "\u5904\u7406\u4E2D\u2026": "Working\u2026",
  "\u6D4F\u89C8\u89D2\u8272\u5E93": "Browse character library",
  "\u6D4F\u89C8\u7528\u6237\u8D44\u6E90": "Browse user resources",
  "\u6D4F\u89C8\u72EC\u7ACB\u4E16\u754C\u4E66": "Browse standalone world books",
  "\u89D2\u8272\u5E93\u4E3A\u7A7A": "Character library is empty",
  "\u7528\u6237\u8D44\u6E90\u5E93\u4E3A\u7A7A": "User library is empty",
  "\u8D44\u6E90\u5E93\u4E3A\u7A7A": "Library is empty",
  "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002": "The standalone world-book library is empty.",
  "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD": "Bind to current session",
  "\u66F4\u65B0\u4F1A\u8BDD\u7ED1\u5B9A": "Update session binding",
  "\u5237\u65B0\u4F1A\u8BDD\u7ED1\u5B9A": "Refresh session binding",
  "\u89E3\u9664\u7ED1\u5B9A": "Unbind",
  "\u89E3\u9664\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A": "Unbind from current session",
  "\u5220\u9664\u89D2\u8272\u5361": "Delete character card",
  "\u5220\u9664\u7528\u6237": "Delete user",
  "\u5220\u9664\u72EC\u7ACB\u4E66": "Delete standalone book",
  "\u540D\u79F0": "Name",
  "\u89D2\u8272": "Role",
  "\u5185\u5BB9": "Content",
  "\u542F\u7528": "Enabled",
  "\u5DF2\u7981\u7528": "Disabled",
  "\u5E38\u9A7B": "Always active",
  "\u4F7F\u7528\u9644\u52A0\u5173\u952E\u8BCD": "Use secondary keywords",
  "\u533A\u5206\u5927\u5C0F\u5199": "Case sensitive",
  "\u5168\u8BCD\u5339\u914D": "Whole-word matching",
  "\u4E3B\u5173\u952E\u8BCD": "Primary keywords",
  "\u9644\u52A0\u5173\u952E\u8BCD": "Secondary keywords",
  "\u9644\u52A0\u5173\u952E\u8BCD\u903B\u8F91": "Secondary keyword logic",
  "\u65E0\u4E3B\u5173\u952E\u8BCD": "No primary keywords",
  "\u6392\u5E8F\u6743\u91CD": "Sort weight",
  "\u63D2\u5165\u4F4D\u7F6E": "Insertion position",
  "\u4F4D\u7F6E": "Position",
  "\u987A\u5E8F": "Order",
  "\u6982\u7387": "Probability",
  "\u6B63\u6587": "Body",
  "\u6761\u76EE\u6807\u9898": "Entry title",
  "\u6761\u76EE\u540D\u79F0 / \u5907\u6CE8": "Entry name / note",
  "\u4E16\u754C\u4E66\u540D\u79F0": "World-book name",
  "\u5220\u9664\u6761\u76EE": "Delete entry",
  "\u65B0\u589E\u5185\u5D4C\u6761\u76EE": "Add embedded entry",
  "\u4FDD\u5B58\u5185\u5D4C\u4E66": "Save embedded book",
  "\u5185\u5D4C\u4E66\u5DF2\u4FDD\u5B58": "Embedded book saved",
  "\u72EC\u7ACB\u4E16\u754C\u4E66": "Standalone world books",
  "\u89D2\u8272\u5361\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66": "Character-bound world book",
  "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66": "Embedded character world book",
  "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4FE1\u606F": "Embedded character World Info",
  "\u4E16\u754C\u4FE1\u606F\uFF08Lorebook\uFF09": "World Info (Lorebook)",
  "\u8FD0\u884C\u8BCA\u65AD": "Runtime diagnostics",
  "\u517C\u5BB9\u8B66\u544A": "Compatibility warnings",
  "\u9700\u8981 loader/\u5176\u4ED6\u6A21\u5757\u5904\u7406": "Requires loader/other module handling",
  "\u5F53\u524D\u5F00\u573A\u53C2\u8003\u5185\u5BB9": "Current greeting reference",
  "\u5F00\u573A\u53C2\u8003": "Greeting reference",
  "\u540D\u5B57\uFF08\u7528\u4E8E {{user}} \u5B8F\uFF09": "Name (used by the {{user}} macro)",
  "\u63CF\u8FF0\uFF08\u8FDB\u5165 personaDescription marker\uFF1B\u7F3A marker \u65F6\u7531 loader \u7A33\u5B9A\u964D\u7EA7\uFF09": "Description (placed at the personaDescription marker, with a stable loader fallback)",
  "\u4FDD\u5B58\u8D44\u6E90": "Save resource",
  "\u9884\u8BBE\u540D\u79F0": "Preset name",
  "\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4": "Use model default",
  "DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD": "DSH system prompt",
  "\u4FDD\u7559 DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF0C\u5E76\u8FFD\u52A0\u9884\u8BBE\uFF08\u63A8\u8350\uFF09": "Keep the DSH system prompt and append the preset (recommended)",
  "\u4EC5\u4F7F\u7528\u9884\u8BBE\uFF0C\u79FB\u9664 DSH \u7CFB\u7EDF\u6BB5\uFF08\u9AD8\u7EA7\uFF09": "Use only the preset and remove DSH system sections (advanced)",
  "\u63D0\u793A\u8BCD": "Prompts",
  "\uFF0B \u6DFB\u52A0": "+ Add",
  "\u62D6\u62FD\u6392\u5217\u987A\u5E8F": "Drag to reorder",
  "\u677E\u5F00\u540E\u653E\u7F6E\u4E8E\u6B64": "Release to place here",
  "\u5DF2\u542F\u7528": "Enabled",
  "\u5DF2\u7ED1\u5B9A": "Bound",
  "\u672A\u7ED1\u5B9A": "Not bound",
  "\u89C4\u5212\u4E2D": "Planned",
  "\u5173\u95ED\u53F3\u4FA7\u680F": "Close sidebar",
  "\u5173\u95ED\u9884\u8BBE\u4FA7\u8FB9\u680F": "Close preset sidebar",
  "\u5173\u95ED\u89D2\u8272\u5361\u9762\u677F": "Close character-card panel",
  "\u5173\u95ED\u89D2\u8272\u5361\u4FA7\u8FB9\u680F": "Close character-card sidebar",
  "\u5173\u95ED\u7528\u6237\u9762\u677F": "Close user panel",
  "\u5173\u95ED\u7528\u6237\u4FA7\u8FB9\u680F": "Close user sidebar",
  "\u62D6\u52A8\u53EF\u79FB\u52A8\uFF1B\u70B9\u51FB\u5C55\u5F00 Tavern \u8D44\u6E90\u9762\u677F": "Drag to move; click to open Tavern resource panels",
  "\u6B63\u5728\u52A0\u8F7D\u9884\u8BBE\u2026": "Loading presets\u2026",
  "\u6B63\u5728\u52A0\u8F7D\u89D2\u8272\u5E93\u2026": "Loading character library\u2026",
  "\u6B63\u5728\u52A0\u8F7D\u7528\u6237\u8D44\u6E90\u2026": "Loading user resources\u2026",
  "\u6B63\u5728\u8BFB\u53D6\u4E16\u754C\u4FE1\u606F\u2026": "Reading World Info\u2026",
  "\u6B63\u5728\u8BFB\u53D6\u5BA1\u8BA1\u8BB0\u5F55\u2026": "Reading audit records\u2026",
  "\u7528\u6237\u8D44\u6E90\u5DF2\u52A0\u8F7D": "User resources loaded",
  "\u7528\u6237\u8D44\u6E90\u5DF2\u5237\u65B0": "User resources refreshed",
  "\u7528\u6237\u8D44\u6E90\u5DF2\u521B\u5EFA\uFF1B\u4FDD\u5B58\u540D\u5B57\u548C\u63CF\u8FF0\u540E\u518D\u7ED1\u5B9A": "User created; save its name and description before binding",
  "\u540D\u5B57\u548C\u63CF\u8FF0\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u7ACB\u5373\u4F7F\u7528\u65B0\u5185\u5BB9": "Name and description saved; bound sessions will use them on the next request",
  "\u7528\u6237\u5DF2\u7ED1\u5B9A\uFF1B\u5F53\u524D\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u4F7F\u7528\u8BE5\u540D\u5B57\u548C\u63CF\u8FF0": "User bound; the current session will use this name and description on its next request",
  "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u7528\u6237\u7ED1\u5B9A": "User unbound from the current session",
  "\u7528\u6237\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664": "User deleted and related session bindings cleared",
  "\u68C0\u6D4B\u5230\u5176\u4ED6 Tavern \u8D44\u6E90\u53D8\u5316\uFF1B\u4E3A\u4FDD\u7559\u672C\u9762\u677F\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u672A\u81EA\u52A8\u5237\u65B0\u3002": "Other Tavern resources changed. This panel was not refreshed so its unsaved changes are preserved.",
  "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u65B0\u5EFA\u7528\u6237\u5417\uFF1F": "This user resource or its world-book binding has unsaved changes. Discard them and create a user?",
  "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF1B\u9009\u62E9\u8BE5\u7528\u6237\u7684\u4F1A\u8BDD\u4F1A\u5728\u4E0B\u4E00\u6B21\u7EC4\u88C5\u65F6\u81EA\u52A8\u4F7F\u7528": "The user\u2019s world-book binding was saved; sessions using this user will apply it on their next assembly",
  "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u5207\u6362\u5417\uFF1F": "This user resource or its world-book binding has unsaved changes. Discard them and switch?",
  "\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u52A0\u8F7D": "User resource and world-book binding loaded",
  "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5173\u95ED\u5417\uFF1F": "This user resource or its world-book binding has unsaved changes. Close anyway?",
  "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u4FEE\u6539\uFF1F": "Discard unsaved user-resource or world-book-binding changes?",
  "\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF1A": "Unsaved changes: ",
  "\u540D\u5B57/\u63CF\u8FF0": "Name/description",
  "\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A": "User world-book binding",
  "\u5F53\u524D\u663E\u793A\u7684\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5747\u5DF2\u4FDD\u5B58\u3002": "The displayed user resource and world-book binding are saved.",
  "\u4FDD\u5B58\u8D44\u6E90\uFF08\u672A\u4FDD\u5B58\uFF09": "Save resource (unsaved)",
  "\u8D44\u6E90\u5DF2\u4FDD\u5B58": "Resource saved",
  "\u8BF7\u5148\u4FDD\u5B58\u4FEE\u6539": "Save changes first",
  "\u7528\u6237\u7ED1\u5B9A\u7684\u72EC\u7ACB\u4E16\u754C\u4E66": "Standalone world books bound to this user",
  "\u9009\u62E9\u8BE5\u7528\u6237\u65F6\uFF0Cloader \u4F1A\u81EA\u52A8\u7EC4\u5408\u8FD9\u91CC\u7684\u4E16\u754C\u4E66\u4E0E\u5F53\u524D\u4F1A\u8BDD\u663E\u5F0F\u9009\u62E9\u7684\u4E16\u754C\u4E66\uFF1B\u91CD\u590D\u7684\u540C\u4E00\u672C\u4E66\u53EA\u6267\u884C\u4E00\u6B21\u3002": "When this user is selected, the loader combines these books with the session\u2019s explicit world books; a duplicate book runs only once.",
  "\u6B63\u5728\u52A0\u8F7D\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u2026": "Loading the standalone world-book library\u2026",
  "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002\u8BF7\u5148\u5728\u4E16\u754C\u4E66\u9762\u677F\u521B\u5EFA\u6216\u5BFC\u5165\u3002": "The standalone world-book library is empty. Create or import one in the world-book panel first.",
  "\u4FDD\u5B58\u4E16\u754C\u4E66\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09": "Save world-book binding (unsaved)",
  "\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58": "World-book binding saved",
  "\u6E05\u7A7A\u5F85\u4FDD\u5B58\u9009\u62E9": "Clear pending selection",
  "\u7528\u6237\u8D44\u6E90\u6B63\u6587\u4ECD\u4E25\u683C\u53EA\u6709\u540D\u5B57\u548C\u63CF\u8FF0\uFF1B\u4E16\u754C\u4E66\u5173\u7CFB\u4FDD\u5B58\u5728 loader \u7684\u72EC\u7ACB\u7ED3\u6784\u5316\u7B56\u7565\u4E2D\u3002\u7528\u6237\u8D44\u6E90\u4E0D\u5305\u542B\u5934\u50CF\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6 DSH Agent \u8EAB\u4EFD\u3002": "The user resource remains strictly name and description only; world-book relationships are stored in a separate structured loader policy. User resources have no avatar and do not override the DSH Agent identity.",
  "\u89D2\u8272\u5E93\u5DF2\u52A0\u8F7D": "Character library loaded",
  "\u89D2\u8272\u72B6\u6001\u5DF2\u5237\u65B0": "Character status refreshed",
  "\u89D2\u8272\u5361\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5230\u4F1A\u8BDD": "Character card imported; it is not yet bound to a session",
  "\u89D2\u8272\u9009\u62E9\u5DF2\u4FDD\u5B58\uFF1B\u5B9E\u9645\u5BF9\u8BDD\u52A0\u8F7D\u7531 Tavern loader \u7EDF\u4E00\u5904\u7406": "Character selection saved; the Tavern loader handles runtime loading",
  "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u89D2\u8272\u7ED1\u5B9A": "Character unbound from the current session",
  "\u89D2\u8272\u5361\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664": "Character card deleted and related bindings cleared",
  "\u9884\u8BBE\u5DF2\u52A0\u8F7D": "Preset loaded",
  "\u9884\u8BBE\u72B6\u6001\u5DF2\u5237\u65B0": "Preset status refreshed",
  "\u5DF2\u521B\u5EFA\u5E76\u9009\u62E9\u65B0\u9884\u8BBE": "New preset created and selected",
  "ST \u9884\u8BBE\u5DF2\u5BFC\u5165\u5E76\u9009\u62E9": "ST preset imported and selected",
  "\u9884\u8BBE\u914D\u7F6E\u5DF2\u4FDD\u5B58": "Preset settings saved",
  "\u9884\u8BBE\u5DF2\u5220\u9664": "Preset deleted",
  "\u5F53\u524D\u7ED1\u5B9A\u5DF2\u5E94\u7528": "Current binding applied",
  "\u6E05\u7A7A\u5F85\u5E94\u7528\u9009\u62E9": "Clear pending selection",
  "\u5E94\u7528\u4F1A\u8BDD\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09": "Apply session binding (unsaved)",
  "\u9762\u677F\u663E\u793A\u7684\u7ED1\u5B9A\u5DF2\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD\u3002": "The binding shown in this panel is applied to the current session.",
  "\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u5F53\u524D\u52FE\u9009\u5C1A\u672A\u5E94\u7528\u5230\u4F1A\u8BDD\u3002": "The binding has unsaved changes; the current selection is not yet applied.",
  "\u672C\u8F6E\u6CA1\u6709\u53EF\u5BA1\u8BA1\u7684\u4E16\u754C\u4E66\u5339\u914D\u6765\u6E90\u3002": "This request has no auditable world-book source.",
  "\u5237\u65B0\u6216\u5BBF\u4E3B\u91CD\u542F\u540E\u53EF\u6062\u590D\u3002": "Restored after refresh or host restart.",
  "\u672A\u4F7F\u7528": "Not used",
  "\u65E0\u914D\u7F6E\u5173\u952E\u8BCD": "No configured keywords",
  "\u65E0\u5173\u952E\u8BCD\u547D\u4E2D": "No keyword matches",
  "\u5DF2\u63D2\u5165": "Inserted",
  "\u5DF2\u62D2\u7EDD": "Rejected",
  "\u7B49\u5F85\u6743\u5A01 header": "Waiting for authoritative header",
  "\u7EC4\u5408\u4E0E\u63D2\u5165": "Assembly and insertion",
  "\u4E16\u754C\u4E66\u5339\u914D\u51B3\u7B56": "World-book match decisions",
  "\u65B0\u9884\u8BBE": "New preset",
  "\u65B0\u63D0\u793A\u8BCD": "New prompt",
  "\u65B0\u7528\u6237": "New user",
  "\u65B0\u4F1A\u8BDD": "New session",
  "\u5F53\u524D\u8BBE\u7F6E\u6216\u914D\u7F6E\u6A21\u677F": "Current settings or configuration template",
  "\u65B0\u4F1A\u8BDD\u4E0E\u914D\u7F6E\u6A21\u677F": "New session and configuration templates",
  "\u5173\u95ED\u65B0\u4F1A\u8BDD\u4FA7\u8FB9\u680F": "Close the new-session sidebar",
  "\u7EF4\u6301\u5F53\u524D Tavern \u8BBE\u7F6E\u65B0\u5F00\u5BF9\u8BDD": "Start a new conversation with the current Tavern settings",
  "\u53EA\u7EE7\u627F preset\u3001\u89D2\u8272\u5361\u4E0E greeting/\u5F00\u5173\u3001\u7528\u6237\u548C\u72EC\u7ACB\u4E16\u754C\u4E66\u9009\u62E9\u3002DSH \u5386\u53F2\u3001Tavern Trace\u3001Inbox\u3001\u8FD0\u884C\u4E2D turn/step \u548C\u5176\u4ED6\u8FD0\u884C\u6001\u4E0D\u4F1A\u590D\u5236\u3002": "Carries only the preset, character and greeting/options, user, and standalone world-book selections. DSH history, Tavern Trace, Inbox, active turns/steps, and other runtime state are not copied.",
  "\u6CA1\u6709\u53EF\u7528\u7684 DSH \u76EE\u6807\u5DE5\u4F5C\u533A\u3002\u8BF7\u5148\u5728 DSH \u4FA7\u680F\u4E2D\u52A0\u5165\u6216\u6253\u5F00\u5DE5\u4F5C\u533A\u3002": "No DSH target workspace is available. Add or open a workspace in the DSH sidebar first.",
  "\u914D\u7F6E\u6A21\u677F": "Configuration templates",
  "\u4FDD\u5B58\u7684 Tavern \u914D\u7F6E": "Saved Tavern configuration",
  "\u72EC\u7ACB\u4E16\u754C\u4E66\uFF08\u6309\u7ED1\u5B9A\u987A\u5E8F\uFF09": "Standalone world books (binding order)",
  "\u5361\u5185 system_prompt\uFF1A": "Character system_prompt: ",
  "post_history_instructions\uFF1A": "post_history_instructions: ",
  "\u5DF2\u9009\u62E9\u6A21\u677F": "Selected template",
  "\u672A\u9009\u62E9\u6A21\u677F": "No template selected",
  "\u6A21\u677F\u540D\u79F0": "Template name",
  "\u65B0\u914D\u7F6E\u6A21\u677F": "New configuration template",
  "\u7531\u5F53\u524D\u8BBE\u7F6E\u521B\u5EFA": "Create from current settings",
  "\u4EC5\u4FDD\u5B58\u540D\u79F0": "Save name only",
  "\u7528\u5F53\u524D\u8BBE\u7F6E\u66F4\u65B0": "Update from current settings",
  "\u5220\u9664\u6A21\u677F": "Delete template",
  "\u4FDD\u5B58\u5185\u5BB9\uFF1A": "Saved content: ",
  "\u7A7A Tavern \u914D\u7F6E": "Empty Tavern configuration",
  "\u8BE5\u6A21\u677F\u6682\u4E0D\u53EF\u7528\u4E8E\u521B\u5EFA\uFF1A": "This template cannot currently be used:",
  "\u6839\u636E\u6240\u9009\u6A21\u677F\u65B0\u5F00\u5E72\u51C0\u5BF9\u8BDD": "Start a clean conversation from the selected template",
  "\u6A21\u677F\u4E0E\u65B0\u4F1A\u8BDD\u64CD\u4F5C\u5DF2\u5C31\u7EEA\u3002": "Template and new-session actions are ready.",
  "DSH \u53EF\u80FD\u590D\u7528\u540C\u5DE5\u4F5C\u533A\u4E2D\u5DF2\u6709\u7684\u771F\u5B9E blank session\uFF1B\u8FD9\u662F\u5176\u516C\u5F00 New Session \u8BED\u4E49\u3002\u63D2\u4EF6\u4F1A\u5728\u5BFC\u822A\u524D\u539F\u5B50\u66FF\u6362\u8BE5 blank session \u7684 Tavern \u9009\u62E9\u3002": "DSH may reuse an existing real blank session in the same workspace; this is its public New Session behavior. The plugin atomically replaces that blank session\u2019s Tavern selection before navigation.",
  "\u6A21\u677F\u9009\u62E9\u5DF2\u66F4\u65B0": "Template selection updated",
  "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u518D\u4FDD\u5B58\u5F53\u524D Tavern \u8BBE\u7F6E": "Open a session before saving its current Tavern settings",
  "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6A21\u677F": "Select a template first",
  "\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD\u5E76\u9009\u62E9\u6A21\u677F": "Open a session and select a template first",
  "\u6A21\u677F\u5DF2\u5220\u9664": "Template deleted",
  "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u6765\u6E90\u4F1A\u8BDD": "Open a source session first",
  "\u5F53\u524D\u4F1A\u8BDD\u4E0D\u5C5E\u4E8E DSH \u5DE5\u4F5C\u533A\uFF1B\u8BF7\u5148\u628A\u4F1A\u8BDD\u52A0\u5165\u5DE5\u4F5C\u533A": "The current session is not in a DSH workspace; add it to a workspace first",
  "\u5DF2\u521B\u5EFA\u6A21\u677F\uFF1A": "Template created: ",
  "\u5DF2\u91CD\u547D\u540D\u6A21\u677F\uFF1A": "Template renamed: ",
  "\u5DF2\u7528\u5F53\u524D\u8BBE\u7F6E\u66F4\u65B0\u6A21\u677F\uFF1A": "Template updated from current settings: ",
  "\u5DF2\u5207\u6362\u5230\u5E72\u51C0\u4F1A\u8BDD\uFF1A": "Switched to clean session: ",
  "\u5220\u9664\u914D\u7F6E\u6A21\u677F\u201C": "Delete configuration template \u201C",
  "\u201D\uFF1F\u8FD9\u4E0D\u4F1A\u5220\u9664\u4EFB\u4F55 DSH \u4F1A\u8BDD\u3002": "\u201D? This will not delete any DSH session.",
  " \u672C\u4E16\u754C\u4E66": " world books",
  "\u4FDD\u5B58\u4F1A\u66F4\u65B0\u63D2\u4EF6\u4FDD\u5B58\u7684\u89D2\u8272\u5361\u526F\u672C\u53CA\u5176 JSON \u5BFC\u51FA\uFF1B\u4E3A\u907F\u514D\u7834\u574F\u7B7E\u540D\u6216\u56FE\u7247\u6570\u636E\uFF0C\u6700\u521D\u5BFC\u5165\u7684 PNG/JSON artifact \u4ECD\u4FDD\u6301\u4E0D\u53D8\u3002matcher \u4F1A\u5728\u9996\u6B21\u8BF7\u6C42\u7EC4\u88C5\u524D\u628A\u672C\u6B65\u9AA4 claimed \u8F93\u5165\u4E0E Session \u5386\u53F2\u7EC4\u5408\u626B\u63CF\uFF0C\u4E0D\u4F1A\u5411\u5386\u53F2\u5199\u5165\u526F\u672C\u3002": "Saving updates the plugin copy of the character card and its JSON export. The original PNG/JSON artifact remains unchanged. Before the first request assembly, the matcher scans this step\u2019s claimed input together with Session history without writing a duplicate into history.",
  "\u5B9E\u9645\u6FC0\u6D3B\u3001\u6392\u5E8F\u3001\u6982\u7387\u548C\u9884\u7B97\u7531\u5171\u4EAB matcher \u786E\u5B9A\uFF1B\u6700\u7EC8\u6CE8\u5165\u4ECD\u7531 Tavern loader \u7EDF\u4E00\u5B8C\u6210\u3002\u5F53\u524D\u626B\u63CF\u4F1A\u628A\u672C\u6B65\u9AA4 claimed \u8F93\u5165\u4E0E\u6301\u4E45\u5386\u53F2\u7EC4\u5408\u6210\u4E34\u65F6\u4E0A\u4E0B\u6587\uFF0C\u56E0\u6B64\u5355\u6B65\u9AA4\u4F1A\u8BDD\u4E5F\u80FD\u5728\u9996\u6B21\u8BF7\u6C42\u89E6\u53D1\u5173\u952E\u8BCD\u3002": "The shared matcher determines activation, ordering, probability, and budget, and the Tavern loader performs final injection. Scanning combines this step\u2019s claimed input with durable history in a temporary context, so a single-step session can trigger keywords on its first request.",
  "\u5339\u914D\u57FA\u4E8E\u672C\u6B65\u9AA4 assembly \u7684\u4E34\u65F6\u6FC0\u6D3B\u4E0A\u4E0B\u6587\uFF1A\u6301\u4E45\u5386\u53F2 + ": "Matching uses this step\u2019s temporary activation context: durable history + ",
  " \u6761\u672C\u8F6E claimed \u8F93\u5165\uFF1B\u4E0D\u4FDD\u5B58\u8F93\u5165\u6B63\u6587": " claimed messages from this turn; input bodies are not stored",
  "\uFF1B\u626B\u63CF\u8F93\u5165\u5DF2\u6309\u4E0A\u9650\u622A\u65AD": "; scan input was truncated to the configured limit",
  "\u4E3B\u5173\u952E\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF1B\u4EFB\u4E00\u547D\u4E2D\uFF09": "Primary keywords (one per line; any match)",
  "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09": "Secondary keywords (one per line)",
  "\u4E3B\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09": "Primary keywords (Chinese or English comma separators)",
  "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09": "Secondary keywords (Chinese or English comma separators)",
  "AND ANY\uFF1A\u547D\u4E2D\u4EFB\u4E00": "AND ANY: match any",
  "AND ALL\uFF1A\u547D\u4E2D\u5168\u90E8": "AND ALL: match all",
  "NOT ANY\uFF1A\u4E0D\u80FD\u547D\u4E2D\u4EFB\u4E00": "NOT ANY: match none",
  "NOT ALL\uFF1A\u4E0D\u80FD\u5168\u90E8\u547D\u4E2D": "NOT ALL: not all may match",
  "\u6761\u76EE\u5185\u5BB9\uFF08\u89E6\u53D1\u540E\u6CE8\u5165 system profile\uFF09": "Entry content (injected into the system profile when triggered)",
  "\u89D2\u8272\u5B9A\u4E49\u4E4B\u524D": "Before character definition",
  "\u89D2\u8272\u5B9A\u4E49\u4E4B\u540E": "After character definition",
  "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09": "Before author note (approximate)",
  "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09": "After author note (approximate)",
  "\u6307\u5B9A\u6DF1\u5EA6\uFF08\u8FD1\u4F3C\uFF09": "At depth (approximate)",
  "\u793A\u4F8B\u6D88\u606F\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09": "Before example messages (approximate)",
  "\u793A\u4F8B\u6D88\u606F\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09": "After example messages (approximate)",
  "Outlet\uFF08\u5F53\u524D\u4E0D\u6CE8\u5165\uFF09": "Outlet (not currently injected)",
  "\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4FE1\u606F\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u624D\u4F1A\u5199\u5165\u89D2\u8272\u5361\u526F\u672C\u3002": "Delete this World Info entry? It is written to the saved character-card copy only after saving.",
  "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u6761\u76EE\u4FEE\u6539\u5E76\u91CD\u65B0\u8F7D\u5165\uFF1F": "Discard unsaved entry changes and reload?",
  "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F": "Discard unsaved changes?",
  "\u6709\u5C1A\u672A\u4FDD\u5B58\u7684\u6761\u76EE\u4FEE\u6539\u3002": "There are unsaved entry changes.",
  "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7528\u4E16\u754C\u4FE1\u606F\u3002\u7ED1\u5B9A\u542B character_book \u7684\u89D2\u8272\u5361\u540E\uFF0C\u5176\u5185\u5D4C\u6761\u76EE\u4F1A\u81EA\u52A8\u7531 loader \u5339\u914D\uFF1B\u89E3\u7ED1\u89D2\u8272\u4F1A\u540C\u65F6\u79FB\u9664\u8BE5\u6765\u6E90\u3002": "No World Info is available for this session. Bind a character card containing character_book to let the loader match its entries; unbinding removes that source.",
  "\u4FDD\u5B58\u4F1A\u66F4\u65B0\u63D2\u4EF6\u4FDD\u5B58\u7684\u89D2\u8272\u5361\u526F\u672C\u53CA\u5176 JSON \u5BFC\u51FA\uFF1B\u4E3A\u907F\u514D\u7834\u574F\u7B7E\u540D\u6216\u56FE\u7247\u6570\u636E\uFF0C\u6700\u521D\u5BFC\u5165\u7684 PNG/JSON artifact \u4ECD\u4FDD\u6301\u4E0D\u53D8\u3002\u5F53\u524D matcher \u626B\u63CF\u5DF2\u8FDB\u5165 Session \u7684\u5386\u53F2\uFF1B\u521A\u63D0\u4EA4\u7684\u8F93\u5165\u53EF\u80FD\u5728\u540C\u4E00\u53EF\u89C1\u56DE\u5408\u7684\u4E0B\u4E00 agent step\uFF08\u5982\u5DE5\u5177\u7EE7\u7EED\uFF09\u6216\u4E0B\u4E00\u7528\u6237\u56DE\u5408\u89E6\u53D1\u5173\u952E\u8BCD\u3002": "Saving updates the plugin copy of the character card and its JSON export. The originally imported PNG/JSON artifact remains unchanged to preserve signatures and image data. The matcher scans durable session history; newly submitted input may trigger on the next agent step or user turn.",
  "ST marker \u4E0D\u4F1A\u4F5C\u4E3A\u72EC\u7ACB\u63D0\u793A\u8BCD\u6CE8\u5165": "ST markers are not injected as standalone prompts",
  "\u542F\u7528\u63D0\u793A\u8BCD": "Enable prompt",
  "\u6B63\u5728\u540C\u6B65\u5F53\u524D\u4F1A\u8BDD\u7684\u9884\u8BBE\u72B6\u6001\u2026": "Syncing preset state for the current session\u2026",
  "\u9884\u8BBE\u5DF2\u9009\u62E9\uFF1B\u4E0B\u4E00\u6761\u6D88\u606F\u5C06\u643A\u5E26\u6B64 preset\u3002\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664\u3002": "Preset selected; the next request will use it. Existing session history is unchanged.",
  "\u5DF2\u505C\u7528 preset\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664": "Preset disabled; existing session history is unchanged",
  "\u8BF7\u9009\u62E9\u6216\u521B\u5EFA\u9884\u8BBE\u4EE5\u5F00\u59CB\u914D\u7F6E\u3002": "Select or create a preset to begin configuring it.",
  "\u8FD9\u4E9B\u5B57\u6BB5\u4F1A\u88AB\u5B8C\u6574\u4FDD\u5B58\uFF1Bdsh 0.1.0 \u5F53\u524D\u8BF7\u6C42\u534F\u8BAE\u672A\u66B4\u9732\u7684\u53C2\u6570\u4E0D\u4F1A\u5F3A\u884C\u4E0B\u53D1\u7ED9\u9002\u914D\u5668\u3002": "These fields are saved in full. Parameters not exposed by the current dsh request protocol are not forced into the adapter.",
  "\u8B66\u544A\uFF1A\u8FD9\u4F1A\u79FB\u9664\u6A21\u578B\u53EF\u89C1\u7684 Harness \u8EAB\u4EFD\u3001Agent persona \u548C\u5DE5\u5177\u8BF4\u660E\uFF0C\u53EF\u80FD\u7834\u574F\u5DE5\u5177\u8C03\u7528\u6216\u7ED3\u6784\u5316\u8F93\u51FA\uFF1B\u6C99\u7BB1\u4E0E\u5BA1\u6279\u7B49\u6267\u884C\u5C42\u5B89\u5168\u4ECD\u7136\u6709\u6548\u3002": "Warning: this removes the model-visible Harness identity, Agent persona, and tool instructions, which may break tool use or structured output. Execution-layer sandboxing and approvals remain active.",
  "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u89D2\u8272": "Create or open a session before binding a character",
  "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u4E16\u754C\u4E66": "Create or open a session before binding world books",
  "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u5E76\u9009\u62E9\u7528\u6237\u8D44\u6E90": "Create or open a session and select a user resource first",
  "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u66F4\u6362\u89D2\u8272\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F": "This session already has history. Changing the character affects only future requests and does not rewrite messages. Continue?",
  "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u5207\u6362\u7528\u6237\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F": "This session already has history. Changing the user affects only future requests and does not rewrite messages. Continue?",
  "\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u7ED1\u7684\u4F1A\u8BDD": "There is no session to unbind",
  "\u89D2\u8272\u5E93\u5DF2\u5237\u65B0": "Character library refreshed",
  "\u89D2\u8272\u8BE6\u60C5\u5DF2\u52A0\u8F7D": "Character details loaded",
  "\u5BFC\u5165\u4E00\u5F20\u5408\u6210\u6216\u81EA\u6709\u6388\u6743\u7684 SillyTavern \u89D2\u8272\u5361\u4EE5\u67E5\u770B\u8BE6\u60C5\u3002": "Import a synthetic or properly licensed SillyTavern character card to view its details.",
  "\u5141\u8BB8 loader \u4F18\u5148\u91C7\u7528\u5361\u5185 system_prompt": "Allow the loader to prefer the card system_prompt",
  "\u5141\u8BB8 loader \u91C7\u7528 post_history_instructions\uFF08\u5B9E\u9645\u4F4D\u7F6E\u7531 loader \u51B3\u5B9A\uFF09": "Allow the loader to use post_history_instructions (the loader determines placement)",
  "\u89D2\u8272\u5361\u6A21\u5757\u8D1F\u8D23\u4FDD\u5B58\u6807\u51C6\u5316\u8D44\u6E90\u548C\u4F1A\u8BDD\u9009\u62E9\uFF1B\u5B9E\u9645 system profile \u4E0E\u5185\u5D4C\u4E16\u754C\u4FE1\u606F\u5339\u914D\u7531 Tavern loader \u5728\u6BCF\u6B21\u8BF7\u6C42\u65F6\u7EDF\u4E00\u5904\u7406\uFF0C\u4E0D\u4F1A\u4F2A\u9020 assistant \u5386\u53F2\u3002": "The character-card module stores normalized resources and session selection. The Tavern loader handles the system profile and embedded World Info on each request without fabricating assistant history.",
  "System prompt\uFF08\u7531 loader \u6309\u7ED1\u5B9A\u8BBE\u7F6E\u5904\u7406\uFF09": "System prompt (handled by the loader according to binding settings)",
  "Post-history instructions\uFF08\u7531 loader \u8FD1\u4F3C\u653E\u7F6E\uFF09": "Post-history instructions (approximately placed by the loader)",
  "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u52A0\u8F7D": "World-book library loaded",
  "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u5237\u65B0": "World-book library refreshed",
  "\u4E16\u754C\u4E66\u8BE6\u60C5\u5DF2\u52A0\u8F7D": "World-book details loaded",
  "\u5DF2\u521B\u5EFA\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD": "Standalone world book created; not yet bound to the current session",
  "\u4E16\u754C\u4E66\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD": "World book imported; not yet bound to the current session",
  "\u4E16\u754C\u4E66\u4FEE\u6539\u5DF2\u6301\u4E45\u5316\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9": "World-book changes saved; future requests will use the new content",
  "\u5F53\u524D\u4F1A\u8BDD\u7684\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58": "World-book binding saved for the current session",
  "\u72EC\u7ACB\u4E16\u754C\u4E66\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u7406": "Standalone world book deleted and related session bindings cleared",
  "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9": "Embedded character world book saved; future requests will use the new content",
  "\u4E16\u754C\u4FE1\u606F\uFF08World Book\uFF09": "World Info (World Book)",
  "\u5173\u95ED\u4E16\u754C\u4E66\u4FA7\u8FB9\u680F": "Close world-book sidebar",
  "\u5BFC\u5165 JSON": "Import JSON",
  "\u65B0\u5EFA\u4E16\u754C\u4E66": "New world book",
  "\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A": "Current session binding",
  "\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002": "Delete this world-book entry? The change takes effect after saving.",
  "\u5220\u9664\u8FD9\u4E2A\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002": "Delete this embedded character world-book entry? The change takes effect after saving.",
  "\u5B9E\u9645\u6FC0\u6D3B\u3001\u6392\u5E8F\u3001\u6982\u7387\u548C\u9884\u7B97\u7531\u5171\u4EAB matcher \u786E\u5B9A\uFF1B\u6700\u7EC8\u6CE8\u5165\u4ECD\u7531 Tavern loader \u7EDF\u4E00\u5B8C\u6210\u3002\u5F53\u524D\u626B\u63CF\u57FA\u4E8E\u5DF2\u6301\u4E45\u5316\u7684\u4F1A\u8BDD\u5386\u53F2\uFF1B\u521A\u63D0\u4EA4\u7684\u8F93\u5165\u53EF\u80FD\u5728\u540C\u4E00\u53EF\u89C1\u56DE\u5408\u7684\u4E0B\u4E00 agent step\uFF08\u5982\u5DE5\u5177\u7EE7\u7EED\uFF09\u6216\u4E0B\u4E00\u7528\u6237\u56DE\u5408\u89E6\u53D1\u3002": "The shared matcher determines activation, ordering, probability, and budget; the Tavern loader performs final injection. Scanning uses durable session history, so newly submitted input may trigger on the next agent step or user turn.",
  "\u521B\u5EFA\u4E00\u4E2A\u53EA\u542B\u540D\u5B57\u548C\u63CF\u8FF0\u7684\u7528\u6237\u8D44\u6E90\u3002": "Create a user resource containing only a name and description.",
  "\u7528\u6237\u8D44\u6E90\u4E0D\u5305\u542B\u5934\u50CF\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6 DSH Agent \u8EAB\u4EFD\u3002loader \u53EA\u5728\u7EDF\u4E00 Tavern profile \u4E2D\u89E3\u6790\u540D\u5B57\u5B8F\u5E76\u653E\u7F6E\u4E00\u6B21\u63CF\u8FF0\u3002": "User resources contain no avatar and do not override the DSH Agent identity. The loader resolves the name macro and places the description once in the unified Tavern profile.",
  "\u5E38\u9A7B\u6761\u76EE": "Always-active entry",
  "\u4E3B\u5173\u952E\u8BCD\u547D\u4E2D": "Primary keyword matched",
  "\u4E3B\u5173\u952E\u8BCD\u672A\u547D\u4E2D": "Primary keyword missed",
  "\u9644\u52A0\u5173\u952E\u8BCD\u4EFB\u4E00\u547D\u4E2D": "Any secondary keyword matched",
  "\u9644\u52A0\u5173\u952E\u8BCD\u5747\u672A\u547D\u4E2D": "No secondary keyword matched",
  "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u90E8\u547D\u4E2D": "All secondary keywords matched",
  "\u9644\u52A0\u5173\u952E\u8BCD\u672A\u5168\u90E8\u547D\u4E2D": "Not all secondary keywords matched",
  "\u9644\u52A0\u5173\u952E\u8BCD\u6392\u9664\u6761\u4EF6\u901A\u8FC7": "Secondary exclusion condition passed",
  "\u9644\u52A0\u5173\u952E\u8BCD\u89E6\u53D1\u6392\u9664": "Secondary keyword triggered exclusion",
  "\u9644\u52A0\u5173\u952E\u8BCD\u975E\u5168\u4E2D\u6761\u4EF6\u901A\u8FC7": "Secondary not-all condition passed",
  "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u4E2D\u800C\u6392\u9664": "All secondary keywords matched and excluded the entry",
  "\u6761\u76EE\u5DF2\u7981\u7528": "Entry disabled",
  "\u9700\u8981\u5916\u90E8\u5411\u91CF\u5339\u914D": "External vector match required",
  "\u4E92\u65A5\u7EC4\u672A\u80DC\u51FA": "Did not win the inclusion group",
  "\u6982\u7387\u68C0\u67E5\u62D2\u7EDD": "Rejected by probability check",
  "\u8D85\u51FA token \u9884\u7B97": "Token budget exceeded",
  "\u6B63\u6587\u4E3A\u7A7A\uFF0C\u672A\u63D2\u5165": "Empty body; not inserted",
  "Outlet \u65E0\u7A33\u5B9A\u63D2\u5165 seam": "Outlet has no stable insertion seam",
  "\u5C1A\u672A\u89C2\u5BDF\u5230\u53EF\u5BF9\u9F50\u7684 DSH request/header\uFF1B\u8FD9\u4E0D\u4EE3\u8868\u8BF7\u6C42\u5DF2\u7ECF\u53D1\u9001\u3002\u5237\u65B0\u540E\u4ECD\u4F1A\u4FDD\u7559\u8BE5\u5F85\u786E\u8BA4\u8BB0\u5F55\u3002": "No alignable DSH request/header has been observed; this does not mean the request was sent. The pending record remains after refresh.",
  "\u5339\u914D\u57FA\u4E8E system assembly \u5F53\u65F6\u53EF\u89C1\u7684\u6301\u4E45\u5316\u4F1A\u8BDD\u5386\u53F2\uFF1B\u521A\u63D0\u4EA4\u7684\u8F93\u5165\u4F1A\u5728\u4E0B\u4E00\u6B21 agent step \u626B\u63CF\u65F6\u53EF\u89C1\uFF0C\u8BE5 step \u53EF\u80FD\u4ECD\u5C5E\u4E8E\u540C\u4E00\u53EF\u89C1\u56DE\u5408\uFF08\u5982\u5DE5\u5177\u7EE7\u7EED\uFF09\uFF0C\u4E5F\u53EF\u80FD\u5C5E\u4E8E\u4E0B\u4E00\u7528\u6237\u56DE\u5408\u3002": "Matching uses durable session history visible during system assembly. Newly submitted input becomes visible on the next agent step, which may be in the same visible turn or the next user turn.",
  "\u9690\u79C1\u8FB9\u754C\uFF1A\u8FD9\u91CC\u53EA\u4FDD\u5B58\u8D44\u6E90\u6458\u8981\u3001\u914D\u7F6E/\u547D\u4E2D\u5173\u952E\u8BCD\u3001\u51B3\u7B56\u539F\u56E0\u3001\u4F4D\u7F6E\u3001\u9884\u7B97\u548C SHA-256 \u6458\u8981\uFF1B\u4E0D\u4FDD\u5B58 preset/\u89D2\u8272/user/\u4E16\u754C\u4E66\u6B63\u6587\u3001\u5B8C\u6574 system\u3001\u804A\u5929\u5386\u53F2\u3001header \u5185\u5BB9\u6216 tool payload\u3002": "Privacy boundary: this stores only resource summaries, configured/matched keywords, decision reasons, placement, budgets, and SHA-256 digests\u2014not resource bodies, full system text, chat history, header content, or tool payloads.",
  "\u4E0E Conversation / Trajectory \u5E76\u5217\u7684 loader \u5BA1\u8BA1\u89C6\u56FE\u3002DSH request/header \u59CB\u7EC8\u662F\u6700\u7EC8\u53D1\u9001 system\u3001tools \u4E0E\u751F\u6548 config \u7684\u6743\u5A01\u3002": "A loader audit view alongside Conversation and Trajectory. The DSH request/header remains authoritative for the final system, tools, and effective config.",
  "\u6B64\u4F1A\u8BDD\u8FD8\u6CA1\u6709 Tavern \u8BF7\u6C42\u5BA1\u8BA1\u8BB0\u5F55\u3002\u53D1\u9001\u4E0B\u4E00\u6761\u6D88\u606F\u540E\u518D\u67E5\u770B\u3002": "This session has no Tavern request audit records yet. Send the next message and check again.",
  "\u65E0\u5173\u952E\u8BCD": "No keywords",
  "\u987A\u5E8F\uFF08\u9AD8\u503C\u4F18\u5148\uFF09": "Order (higher values first)",
  "\uFF08\u8FD1\u4F3C\uFF09": " (approximate)",
  " \u2192 \u672A\u63D2\u5165": " \u2192 not inserted",
  "\uFF08\u6CBF\u7528\u4E0A\u4E00\u4EFD header\uFF09": " (reused previous header)",
  "\u672A\u627E\u5230": "Not found",
  "\u8BE5\u8BB0\u5F55\u5DF2\u5BF9\u9F50 DSH request/header #": "This record is aligned with DSH request/header #",
  "\u3002Tavern profile \u6821\u9A8C\uFF1A": ". Tavern profile validation: ",
  "\uFF1B\u91C7\u6837\u5B57\u6BB5\uFF1A": "; sampler fields: ",
  "\u5339\u914D\u57FA\u4E8E\u672C\u6B65\u9AA4 system assembly \u5F53\u65F6\u53EF\u89C1\u7684\u6301\u4E45\u5316\u4F1A\u8BDD\u5386\u53F2\uFF1B\u6CA1\u6709\u91CD\u590D\u9644\u52A0 pending \u8F93\u5165\u3002": "Matching uses durable session history visible during this step\u2019s system assembly; pending input was not appended a second time.",
  "\u4E00\u81F4": "Consistent",
  "\u672C\u8F6E\u65E0 profile": "No profile this request",
  "\u4E0D\u4E00\u81F4": "Inconsistent",
  "\u4E00\u81F4\u6216\u65E0\u5B57\u6BB5": "Consistent or no fields",
  "\u5185\u5D4C character_book \u5DF2\u65E0\u635F\u4FDD\u7559": "Embedded character_book preserved losslessly",
  "\u672A\u77E5\u5B8F\uFF1A": "Unknown macros: ",
  "\u9884\u7B97\uFF1A": "Budget: ",
  "\u5173\u95ED": "Close ",
  "\u4FA7\u8FB9\u680F": " sidebar"
});
var SOURCE_REPLACEMENTS = Object.entries(SOURCE_EN).sort((left, right) => right[0].length - left[0].length);
var RAW_TEXT = /* @__PURE__ */ Symbol("dsh-tavern.raw-text");
var current = { ...DEFAULT_UI_SETTINGS };
function fill(template, values) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => String(values?.[key] ?? ""));
}
function translate(key, values = {}, fallback) {
  const messages = MESSAGE_CATALOG[current.locale] ?? MESSAGE_CATALOG["zh-CN"];
  const template = messages[key];
  if (typeof template === "string") return fill(template, values);
  if (typeof fallback === "string" && fallback !== "") return fill(fallback, values);
  return messages["common.unavailable"];
}
function translateVisibleText(value) {
  if (typeof value !== "string" || current.locale !== "en" || !/[\u3400-\u9fff]/u.test(value)) return value;
  if (SOURCE_EN[value] !== void 0) return SOURCE_EN[value];
  let output = value;
  for (const [source, translated] of SOURCE_REPLACEMENTS) output = output.split(source).join(translated);
  return output.replaceAll("\u5F53\u524D\u4F1A\u8BDD\uFF1A", "Current session: ").replaceAll("\u7ED1\u5B9A\uFF1A", "Binding: ").replaceAll("\u72B6\u6001\u540C\u6B65\u5931\u8D25\uFF1A", "Status sync failed: ").replaceAll("\u6761\u76EE ", "Entry ").replaceAll("\u65B0\u6761\u76EE ", "New entry ").replaceAll(" \u672C", " books").replaceAll(" \u6761", " entries").replaceAll("\u8F6E\u6B21 ", "Turn ").replaceAll("\u6B65\u9AA4 ", "Step ").replaceAll("\u5C1D\u8BD5 ", "Attempt ").replaceAll("\u8BCA\u65AD\uFF08", "Diagnostics (").replaceAll("\uFF08", " (").replaceAll("\uFF09", ")").replaceAll("\uFF1B", "; ").replaceAll("\uFF1A", ": ").replaceAll("\u3001", ", ");
}
function rawText(value) {
  return Object.freeze({
    [RAW_TEXT]: true,
    value: value === null || value === void 0 ? "" : String(value),
    toString() {
      return this.value;
    }
  });
}
function uiMessage(key, values = {}, fallback) {
  return rawText(translate(key, values, fallback));
}
function isRawText(value) {
  return value?.[RAW_TEXT] === true && typeof value.value === "string";
}
function unwrapText(value) {
  return isRawText(value) ? value.value : String(value ?? "");
}
function uiText(strings, ...values) {
  let output = "";
  for (let index = 0; index < strings.length; index += 1) {
    output += translateVisibleText(strings[index]);
    if (index < values.length) output += unwrapText(values[index]);
  }
  return rawText(output);
}
function localizeChild(value) {
  if (isRawText(value)) return value.value;
  if (typeof value === "string") return translateVisibleText(value);
  if (Array.isArray(value)) return value.map(localizeChild);
  return value;
}
function createLocalizedElement(createElement8) {
  return (type, props, ...children) => {
    let localizedProps = props;
    if (props !== null && props !== void 0) {
      localizedProps = { ...props };
      for (const key of ["title", "aria-label", "placeholder", "alt"]) {
        if (isRawText(localizedProps[key])) localizedProps[key] = localizedProps[key].value;
        else if (typeof localizedProps[key] === "string") localizedProps[key] = translateVisibleText(localizedProps[key]);
      }
    }
    return createElement8(type, localizedProps, ...children.map(localizeChild));
  };
}
function getClientUiSettings() {
  return { ...current };
}
function setClientUiSettings(value, { announce = true } = {}) {
  const locale = SUPPORTED_LOCALES.includes(value?.locale) ? value.locale : DEFAULT_UI_SETTINGS.locale;
  const numericScale = Number(value?.scale);
  const scale = Number.isFinite(numericScale) && numericScale >= 0.75 && numericScale <= 1.5 ? Number(numericScale.toFixed(2)) : DEFAULT_UI_SETTINGS.scale;
  current = { locale, scale };
  if (announce && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("dsh-tavern:ui-settings", { detail: getClientUiSettings() }));
  }
  return getClientUiSettings();
}

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
var h = createLocalizedElement(import_react.createElement);
var API_ROOT = "/dsh-tavern/api";
function announceTavernRefresh() {
  window.dispatchEvent(new CustomEvent("dsh-tavern:refresh", { detail: { source: "preset" } }));
}
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
.dtt-title{font-size:16px;font-weight:650;flex:1;min-width:0}.dtt-active{font-size:13px;color:var(--dsw-alias-state-success);margin-left:7px}
.dtt-icon{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtt-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtt-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.dtt-toolbar{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtt-button{height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-size:13px}.dtt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtt-button:disabled{opacity:.5;cursor:default}.dtt-button-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtt-danger{color:var(--dsw-alias-state-error)}
.dtt-field{display:flex;flex-direction:column;gap:5px}.dtt-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtt-input,.dtt-select,.dtt-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}.dtt-input,.dtt-select{height:36px;padding:0 9px}.dtt-textarea{min-height:110px;resize:vertical;padding:8px;line-height:1.5}.dtt-input:focus,.dtt-select:focus,.dtt-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.dtt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dtt-section{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtt-section-title{font-size:14px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.dtt-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dtt-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);word-break:break-word}.dtt-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtt-prompts{display:flex;flex-direction:column;gap:7px}.dtt-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;transition:border-color .12s,box-shadow .12s}.dtt-prompt[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dtt-prompt[data-dragging=true]>*{opacity:0}.dtt-drop-placeholder{box-sizing:border-box;height:42px;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);font-size:12px;font-weight:600;pointer-events:none}.dtt-prompt-summary{display:flex;align-items:center;gap:7px;padding:8px;cursor:pointer;font-size:13px}.dtt-prompt-summary::marker{color:var(--dsw-alias-label-tertiary)}.dtt-drag{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:grab;padding:1px 2px;font-size:15px;line-height:1;touch-action:none;user-select:none}.dtt-drag:active{cursor:grabbing}.dtt-prompt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtt-role{font-size:12px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}.dtt-prompt-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:8px}.dtt-row-actions{display:flex;gap:6px}.dtt-row-actions .dtt-button{height:30px;padding:0 8px;flex:1}
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
  return h(
    "label",
    { className: "dtt-field" },
    h("span", { className: "dtt-label" }, label),
    children
  );
}
function NumberField({ label, value, onChange, min, step = "any" }) {
  return h(Field, { label }, h("input", {
    className: "dtt-input",
    type: "number",
    value: value ?? "",
    min,
    step,
    onChange: (event) => onChange(event.target.value === "" ? void 0 : Number(event.target.value))
  }));
}
function PromptEditor({ prompt, index, dragging, onPatch, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDelete }) {
  return h(
    "details",
    {
      className: "dtt-prompt",
      "data-prompt-index": index,
      "data-dragging": dragging || void 0
    },
    h(
      "summary",
      { className: "dtt-prompt-summary" },
      h("button", {
        className: "dtt-drag",
        type: "button",
        title: "\u62D6\u62FD\u6392\u5217\u987A\u5E8F",
        "aria-label": uiText`拖拽“${prompt.name || prompt.identifier}”排列顺序`,
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
      h("input", {
        type: "checkbox",
        checked: prompt.enabled === true,
        disabled: prompt.marker === true,
        title: prompt.marker === true ? "ST marker \u4E0D\u4F1A\u4F5C\u4E3A\u72EC\u7ACB\u63D0\u793A\u8BCD\u6CE8\u5165" : "\u542F\u7528\u63D0\u793A\u8BCD",
        onClick: (event) => event.stopPropagation(),
        onChange: (event) => onPatch({ enabled: event.target.checked })
      }),
      h("span", { className: "dtt-prompt-name" }, rawText(prompt.name || prompt.identifier)),
      h("span", { className: "dtt-role" }, rawText(prompt.marker ? "marker" : prompt.role))
    ),
    h(
      "div",
      { className: "dtt-prompt-body" },
      h(Field, { label: "\u540D\u79F0" }, h("input", {
        className: "dtt-input",
        value: prompt.name,
        onChange: (event) => onPatch({ name: event.target.value })
      })),
      h(Field, { label: "\u89D2\u8272" }, h(
        "select",
        {
          className: "dtt-select",
          value: prompt.role,
          disabled: prompt.marker === true,
          onChange: (event) => onPatch({ role: event.target.value })
        },
        h("option", { value: "system" }, "System"),
        h("option", { value: "user" }, "User"),
        h("option", { value: "assistant" }, "Assistant")
      )),
      h(Field, { label: "\u5185\u5BB9" }, h("textarea", {
        className: "dtt-textarea",
        value: prompt.content,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ content: event.target.value })
      })),
      h(
        "div",
        { className: "dtt-row-actions" },
        h("button", { className: "dtt-button dtt-danger", type: "button", onClick: onDelete }, "\u5220\u9664")
      )
    )
  );
}
function DropPlaceholder() {
  return h("div", {
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
  const [catalog2, setCatalog] = (0, import_react.useState)(null);
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
    const onRefresh = (event) => {
      if (event.detail?.source === "preset") return;
      run(() => refresh(), "\u9884\u8BBE\u72B6\u6001\u5DF2\u5237\u65B0");
    };
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => window.removeEventListener("dsh-tavern:refresh", onRefresh);
  }, [refresh, run]);
  const choose = (0, import_react.useCallback)((id) => run(async () => {
    await api("/select", { method: "POST", body: body({ id: id || null, sessionId }) });
    await refresh(id || null);
    announceTavernRefresh();
  }, id ? "\u9884\u8BBE\u5DF2\u9009\u62E9\uFF1B\u4E0B\u4E00\u6761\u6D88\u606F\u5C06\u643A\u5E26\u6B64 preset\u3002\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664\u3002" : "\u5DF2\u505C\u7528 preset\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u5386\u53F2\u4E0D\u4F1A\u88AB\u6E05\u9664"), [refresh, run, sessionId]);
  const createPreset = (0, import_react.useCallback)(() => run(async () => {
    const created = await api("/presets", { method: "POST", body: body({ name: translateVisibleText("\u65B0\u9884\u8BBE") }) });
    await api("/select", { method: "POST", body: body({ id: created.preset.id, sessionId }) });
    await refresh(created.preset.id);
    announceTavernRefresh();
  }, "\u5DF2\u521B\u5EFA\u5E76\u9009\u62E9\u65B0\u9884\u8BBE"), [refresh, run, sessionId]);
  const importFile = (0, import_react.useCallback)((file) => run(async () => {
    const content = await file.text();
    const imported = await api("/import", {
      method: "POST",
      body: body({ name: file.name.replace(/\.json$/i, ""), content })
    });
    await api("/select", { method: "POST", body: body({ id: imported.preset.id, sessionId }) });
    await refresh(imported.preset.id);
    announceTavernRefresh();
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "ST \u9884\u8BBE\u5DF2\u5BFC\u5165\u5E76\u9009\u62E9"), [refresh, run, sessionId]);
  const save = (0, import_react.useCallback)(() => run(async () => {
    const result = await api(`/presets/${encodeURIComponent(draft.id)}`, {
      method: "PUT",
      body: body({ name: draft.name, systemPromptMode: draft.systemPromptMode, sampling: draft.sampling, prompts: draft.prompts })
    });
    setDraft(result.preset);
    await refresh(result.preset.id);
    announceTavernRefresh();
  }, "\u9884\u8BBE\u914D\u7F6E\u5DF2\u4FDD\u5B58"), [draft, refresh, run]);
  const remove = (0, import_react.useCallback)(() => run(async () => {
    if (!window.confirm(unwrapText(uiText`删除预设“${draft.name}”？`))) return;
    await api(`/presets/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    await refresh(null);
    announceTavernRefresh();
  }, "\u9884\u8BBE\u5DF2\u5220\u9664"), [draft, refresh, run]);
  const patchSampling = (patch) => setDraft((current2) => ({
    ...current2,
    sampling: { ...current2.sampling, ...patch }
  }));
  const patchSt = (key, value) => patchSampling({
    st: { ...draft.sampling.st, [key]: value }
  });
  const patchPrompt = (index, patch) => setDraft((current2) => ({
    ...current2,
    prompts: current2.prompts.map((prompt, at) => at === index ? { ...prompt, ...patch } : prompt)
  }));
  const movePrompt = (from, boundary) => setDraft((current2) => {
    const prompts = reorderAtBoundary(current2.prompts, from, boundary);
    if (prompts === current2.prompts) return current2;
    return { ...current2, prompts };
  });
  const deletePrompt = (index) => setDraft((current2) => ({
    ...current2,
    prompts: current2.prompts.filter((_prompt, at) => at !== index)
  }));
  const addPrompt = () => setDraft((current2) => ({
    ...current2,
    prompts: [...current2.prompts, {
      identifier: `prompt-${Date.now().toString(36)}`,
      name: translateVisibleText("\u65B0\u63D0\u793A\u8BCD"),
      role: "system",
      content: "",
      enabled: true,
      marker: false,
      systemPrompt: false,
      st: {}
    }]
  }));
  return h(
    "div",
    { className: "dtt-root" },
    h(
      "div",
      { className: "dtt-header" },
      h("div", { className: "dtt-title" }, "Tavern \u9884\u8BBE", catalog2?.selectedId ? h("span", { className: "dtt-active" }, "\u25CF \u5DF2\u542F\u7528") : null),
      h("button", { className: "dtt-icon", type: "button", title: "\u5173\u95ED\u53F3\u4FA7\u680F", "aria-label": "\u5173\u95ED\u9884\u8BBE\u4FA7\u8FB9\u680F", onClick: closePanel }, "\u2715")
    ),
    h(
      "div",
      { className: "dtt-body" },
      h(
        "div",
        { className: "dtt-toolbar" },
        h("button", { className: "dtt-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, "\u5BFC\u5165 ST JSON"),
        h("button", { className: "dtt-button", type: "button", disabled: busy, onClick: createPreset }, "\u521B\u5EFA\u9884\u8BBE"),
        h("input", {
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
      h(Field, { label: "\u5F53\u524D\u9009\u62E9" }, h(
        "select",
        {
          className: "dtt-select",
          value: catalog2?.selectedId ?? "",
          disabled: busy || catalog2 === null,
          onChange: (event) => choose(event.target.value)
        },
        h("option", { value: "" }, "\u4E0D\u4F7F\u7528\u9884\u8BBE"),
        ...(catalog2?.presets ?? []).map((preset) => h("option", { key: preset.id, value: preset.id }, uiText`${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`))
      )),
      h("div", { className: "dtt-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.error ? rawText(status.text) : status.text),
      draft === null ? h("p", { className: "dtt-note" }, catalog2 === null ? "\u6B63\u5728\u52A0\u8F7D\u9884\u8BBE\u2026" : "\u8BF7\u9009\u62E9\u6216\u521B\u5EFA\u9884\u8BBE\u4EE5\u5F00\u59CB\u914D\u7F6E\u3002") : h(
        "div",
        { className: "dtt-section" },
        h("div", { className: "dtt-section-title" }, "\u57FA\u672C\u8BBE\u7F6E"),
        h(Field, { label: "\u9884\u8BBE\u540D\u79F0" }, h("input", {
          className: "dtt-input",
          value: draft.name,
          onChange: (event) => setDraft((current2) => ({ ...current2, name: event.target.value }))
        })),
        h(
          "div",
          { className: "dtt-grid" },
          h(NumberField, { label: "Temperature", value: draft.sampling.temperature, onChange: (temperature) => patchSampling({ temperature }), min: 0 }),
          h(NumberField, { label: "Max tokens", value: draft.sampling.maxTokens, onChange: (maxTokens) => patchSampling({ maxTokens }), min: 1, step: 1 })
        ),
        h(Field, { label: "Reasoning effort" }, h(
          "select",
          {
            className: "dtt-select",
            value: draft.sampling.reasoningEffort ?? "",
            onChange: (event) => patchSampling({ reasoningEffort: event.target.value || void 0 })
          },
          h("option", { value: "" }, "\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4"),
          h("option", { value: "low" }, "Low"),
          h("option", { value: "medium" }, "Medium"),
          h("option", { value: "high" }, "High"),
          h("option", { value: "xhigh" }, "Extra high")
        )),
        h("button", { className: "dtt-button", type: "button", onClick: () => setAdvanced((value) => !value) }, advanced ? "\u6536\u8D77\u9AD8\u7EA7\u8BBE\u7F6E" : "\u5C55\u5F00\u9AD8\u7EA7\u8BBE\u7F6E"),
        advanced ? h("div", { className: "dtt-grid" }, ...ST_NUMBER_FIELDS.map(([key, label]) => h(NumberField, {
          key,
          label,
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value)
        }))) : null,
        advanced ? h("p", { className: "dtt-note" }, "\u8FD9\u4E9B\u5B57\u6BB5\u4F1A\u88AB\u5B8C\u6574\u4FDD\u5B58\uFF1Bdsh 0.1.0 \u5F53\u524D\u8BF7\u6C42\u534F\u8BAE\u672A\u66B4\u9732\u7684\u53C2\u6570\u4E0D\u4F1A\u5F3A\u884C\u4E0B\u53D1\u7ED9\u9002\u914D\u5668\u3002") : null,
        advanced ? h(Field, { label: "DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD" }, h(
          "select",
          {
            className: "dtt-select",
            value: draft.systemPromptMode === "replace" ? "replace" : "append",
            onChange: (event) => setDraft((current2) => ({ ...current2, systemPromptMode: event.target.value }))
          },
          h("option", { value: "append" }, "\u4FDD\u7559 DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF0C\u5E76\u8FFD\u52A0\u9884\u8BBE\uFF08\u63A8\u8350\uFF09"),
          h("option", { value: "replace" }, "\u4EC5\u4F7F\u7528\u9884\u8BBE\uFF0C\u79FB\u9664 DSH \u7CFB\u7EDF\u6BB5\uFF08\u9AD8\u7EA7\uFF09")
        )) : null,
        advanced && draft.systemPromptMode === "replace" ? h("p", { className: "dtt-status", "data-error": true }, "\u8B66\u544A\uFF1A\u8FD9\u4F1A\u79FB\u9664\u6A21\u578B\u53EF\u89C1\u7684 Harness \u8EAB\u4EFD\u3001Agent persona \u548C\u5DE5\u5177\u8BF4\u660E\uFF0C\u53EF\u80FD\u7834\u574F\u5DE5\u5177\u8C03\u7528\u6216\u7ED3\u6784\u5316\u8F93\u51FA\uFF1B\u6C99\u7BB1\u4E0E\u5BA1\u6279\u7B49\u6267\u884C\u5C42\u5B89\u5168\u4ECD\u7136\u6709\u6548\u3002") : null,
        h(
          "div",
          { className: "dtt-section" },
          h(
            "div",
            { className: "dtt-section-title" },
            h("span", null, `\u63D0\u793A\u8BCD (${draft.prompts.length})`),
            h("button", { className: "dtt-button", type: "button", onClick: addPrompt }, "\uFF0B \u6DFB\u52A0")
          ),
          h(
            "div",
            { className: "dtt-prompts" },
            ...draft.prompts.flatMap((prompt, index) => [
              dragFrom !== null && dropIndex === index ? h(DropPlaceholder, { key: `drop-${index}` }) : null,
              h(PromptEditor, {
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
            dragFrom !== null && dropIndex === draft.prompts.length ? h(DropPlaceholder, { key: "drop-end" }) : null
          )
        ),
        h(
          "div",
          { className: "dtt-footer" },
          h("button", { className: "dtt-button dtt-button-primary", type: "button", disabled: busy, onClick: save }, busy ? "\u5904\u7406\u4E2D\u2026" : "\u4FDD\u5B58\u5E76\u5E94\u7528"),
          h("button", { className: "dtt-button dtt-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664")
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
var h2 = createLocalizedElement(import_react2.createElement);
var API_ROOT2 = "/dsh-tavern/api";
function announceTavernRefresh2() {
  window.dispatchEvent(new CustomEvent("dsh-tavern:refresh", { detail: { source: "character" } }));
}
var css2 = `
.dcc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dcc-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dcc-title{font-size:16px;font-weight:650;flex:1}.dcc-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dcc-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dcc-toolbar,.dcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dcc-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box}.dcc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcc-button:disabled{opacity:.5;cursor:default}.dcc-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dcc-danger{color:var(--dsw-alias-state-error)}.dcc-field{display:flex;flex-direction:column;gap:5px}.dcc-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dcc-select{box-sizing:border-box;width:100%;height:36px;padding:0 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.dcc-note,.dcc-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dcc-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dcc-status[data-error=true]{color:var(--dsw-alias-state-error)}.dcc-card{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dcc-card-head{display:flex;gap:11px}.dcc-avatar{width:76px;height:100px;object-fit:cover;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-container)}.dcc-card-title{font-size:16px;font-weight:650;margin:0 0 5px}.dcc-tags{display:flex;gap:5px;flex-wrap:wrap}.dcc-tag{font-size:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px;color:var(--dsw-alias-label-secondary)}.dcc-check{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.4}.dcc-detail{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px}.dcc-detail summary{cursor:pointer;font-size:13px;font-weight:600}.dcc-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.5;margin:8px 0 0;max-height:260px;overflow:auto}.dcc-diags{margin:7px 0 0;padding-left:18px;font-size:13px;line-height:1.5}.dcc-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
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
  return h2("label", { className: "dcc-field" }, h2("span", { className: "dcc-label" }, label), children);
}
function TextDetail({ label, value }) {
  if (typeof value !== "string" || value === "") return null;
  return h2(
    "details",
    { className: "dcc-detail" },
    h2("summary", null, label),
    h2("p", { className: "dcc-text" }, rawText(value))
  );
}
function DiagnosticList({ title, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return h2(
    "details",
    { className: "dcc-detail" },
    h2("summary", null, uiText`${translateVisibleText(title)} (${items.length})`),
    h2("ul", { className: "dcc-diags" }, ...items.map((item, index) => h2("li", { key: `${item.code}-${index}` }, rawText(`${item.message}${item.path ? ` [${item.path}]` : ""}`))))
  );
}
function CharacterPanel({ sessionId, sessionBlank, close }) {
  const [catalog2, setCatalog] = (0, import_react2.useState)(null);
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
  (0, import_react2.useEffect)(() => {
    const onRefresh = (event) => {
      if (event.detail?.source === "character") return;
      run(() => refresh(detail?.id), "\u89D2\u8272\u72B6\u6001\u5DF2\u5237\u65B0");
    };
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => window.removeEventListener("dsh-tavern:refresh", onRefresh);
  }, [detail?.id, refresh, run]);
  const importFile = (0, import_react2.useCallback)((file) => run(async () => {
    const response = await fetch(`${API_ROOT2}/characters/import?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status));
    await refresh(data.character.id);
    announceTavernRefresh2();
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "\u89D2\u8272\u5361\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5230\u4F1A\u8BDD"), [refresh, run]);
  const bind = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw new Error("\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u89D2\u8272");
    if (selection?.characterCardId !== binding?.characterCardId && sessionBlank === false && !window.confirm(translateVisibleText("\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u66F4\u6362\u89D2\u8272\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F"))) return;
    const data = await api2("/character-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...binding })
    });
    setSelection(data.selection);
    setBinding(data.selection);
    announceTavernRefresh2();
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
    announceTavernRefresh2();
  }, "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u89D2\u8272\u7ED1\u5B9A"), [detail, run, sessionId]);
  const remove = (0, import_react2.useCallback)(() => run(async () => {
    if (detail === null || !window.confirm(unwrapText(uiText`删除角色卡“${detail.name}”？原始导入文件也会被删除。`))) return;
    await api2(`/characters/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
    await refresh(null);
    announceTavernRefresh2();
  }, "\u89D2\u8272\u5361\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664"), [detail, refresh, run]);
  const greetings = characterGreetingOptions(detail);
  const activeName = selection === null ? translateVisibleText("\u672A\u7ED1\u5B9A\u89D2\u8272") : catalog2?.characters.find((item) => item.id === selection.characterCardId)?.name ?? selection.characterCardId;
  return h2(
    "div",
    { className: "dcc-panel" },
    h2(
      "div",
      { className: "dcc-header" },
      h2("div", { className: "dcc-title" }, "Tavern \u89D2\u8272\u5361"),
      h2("button", { className: "dcc-close", type: "button", title: "\u5173\u95ED\u89D2\u8272\u5361\u9762\u677F", "aria-label": "\u5173\u95ED\u89D2\u8272\u5361\u4FA7\u8FB9\u680F", onClick: close }, "\u2715")
    ),
    h2(
      "div",
      { className: "dcc-body" },
      h2(
        "div",
        { className: "dcc-toolbar" },
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, "\u5BFC\u5165 JSON / PNG"),
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => run(() => refresh(detail?.id), "\u89D2\u8272\u5E93\u5DF2\u5237\u65B0") }, "\u5237\u65B0"),
        h2("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,.png,application/json,image/png", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      h2(Field2, { label: "\u6D4F\u89C8\u89D2\u8272\u5E93" }, h2(
        "select",
        {
          className: "dcc-select",
          value: detail?.id ?? "",
          disabled: busy || catalog2 === null || catalog2.characters.length === 0,
          onChange: (event) => run(() => loadDetail(event.target.value), "\u89D2\u8272\u8BE6\u60C5\u5DF2\u52A0\u8F7D")
        },
        ...catalog2?.characters.length ? [] : [h2("option", { key: "empty", value: "" }, "\u89D2\u8272\u5E93\u4E3A\u7A7A")],
        ...(catalog2?.characters ?? []).map((item) => h2("option", { key: item.id, value: item.id }, uiText`${item.name} · ${item.sourceFormat}`))
      )),
      h2("p", { className: "dcc-note" }, uiText`当前会话：${sessionId || translateVisibleText("\u65E0")}；绑定：${activeName}`),
      h2("div", { className: "dcc-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.error ? rawText(status.text) : status.text),
      detail === null ? h2("p", { className: "dcc-note" }, catalog2 === null ? "\u6B63\u5728\u52A0\u8F7D\u89D2\u8272\u5E93\u2026" : "\u5BFC\u5165\u4E00\u5F20\u5408\u6210\u6216\u81EA\u6709\u6388\u6743\u7684 SillyTavern \u89D2\u8272\u5361\u4EE5\u67E5\u770B\u8BE6\u60C5\u3002") : h2(
        "div",
        { className: "dcc-card" },
        h2(
          "div",
          { className: "dcc-card-head" },
          detail.source.container === "png" ? h2("img", { className: "dcc-avatar", src: `${API_ROOT2}/characters/${encodeURIComponent(detail.id)}/artifact`, alt: uiText`${detail.name} 角色卡图片` }) : null,
          h2(
            "div",
            null,
            h2("h3", { className: "dcc-card-title" }, rawText(detail.name)),
            h2("p", { className: "dcc-meta" }, rawText(`${detail.source.format}${detail.source.specVersion ? ` \xB7 ${detail.source.specVersion}` : ""} \xB7 ${detail.source.container}`)),
            h2("p", { className: "dcc-meta" }, rawText(`${detail.data.creator || translateVisibleText("\u672A\u77E5\u4F5C\u8005")}${detail.data.characterVersion ? ` \xB7 ${detail.data.characterVersion}` : ""}`)),
            h2("div", { className: "dcc-tags" }, ...detail.data.tags.map((tag, index) => h2("span", { className: "dcc-tag", key: `${tag}-${index}` }, rawText(tag))))
          )
        ),
        h2(Field2, { label: "\u5F00\u573A\u53C2\u8003" }, h2("select", {
          className: "dcc-select",
          value: binding?.character?.greetingIndex ?? 0,
          onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, greetingIndex: Number(event.target.value) } }))
        }, ...greetings.map((item) => h2("option", { key: item.index, value: item.index }, item.label)))),
        h2("label", { className: "dcc-check" }, h2("input", { type: "checkbox", checked: binding?.character?.preferCharacterSystemPrompt !== false, onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, preferCharacterSystemPrompt: event.target.checked } })) }), h2("span", null, "\u5141\u8BB8 loader \u4F18\u5148\u91C7\u7528\u5361\u5185 system_prompt")),
        h2("label", { className: "dcc-check" }, h2("input", { type: "checkbox", checked: binding?.character?.preferCharacterPostHistory !== false, onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, preferCharacterPostHistory: event.target.checked } })) }), h2("span", null, "\u5141\u8BB8 loader \u91C7\u7528 post_history_instructions\uFF08\u5B9E\u9645\u4F4D\u7F6E\u7531 loader \u51B3\u5B9A\uFF09")),
        h2(
          "div",
          { className: "dcc-actions" },
          h2("button", { className: "dcc-button dcc-primary", type: "button", disabled: busy || !sessionId, onClick: bind }, selection?.characterCardId === detail.id ? "\u66F4\u65B0\u4F1A\u8BDD\u7ED1\u5B9A" : "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD"),
          h2("button", { className: "dcc-button", type: "button", disabled: busy || !sessionId || selection === null, onClick: unbind }, "\u89E3\u9664\u7ED1\u5B9A")
        ),
        h2("p", { className: "dcc-note" }, "\u89D2\u8272\u5361\u6A21\u5757\u8D1F\u8D23\u4FDD\u5B58\u6807\u51C6\u5316\u8D44\u6E90\u548C\u4F1A\u8BDD\u9009\u62E9\uFF1B\u5B9E\u9645 system profile \u4E0E\u5185\u5D4C\u4E16\u754C\u4FE1\u606F\u5339\u914D\u7531 Tavern loader \u5728\u6BCF\u6B21\u8BF7\u6C42\u65F6\u7EDF\u4E00\u5904\u7406\uFF0C\u4E0D\u4F1A\u4F2A\u9020 assistant \u5386\u53F2\u3002"),
        h2(TextDetail, { label: "Creator notes", value: detail.data.creatorNotes }),
        h2(TextDetail, { label: "Description", value: detail.data.description }),
        h2(TextDetail, { label: "Personality", value: detail.data.personality }),
        h2(TextDetail, { label: "Scenario", value: detail.data.scenario }),
        h2(TextDetail, { label: "\u5F53\u524D\u5F00\u573A\u53C2\u8003\u5185\u5BB9", value: greetings[binding?.character?.greetingIndex ?? 0]?.text }),
        h2(TextDetail, { label: "Message examples", value: detail.data.messageExample }),
        h2(TextDetail, { label: "System prompt\uFF08\u7531 loader \u6309\u7ED1\u5B9A\u8BBE\u7F6E\u5904\u7406\uFF09", value: detail.data.systemPrompt }),
        h2(TextDetail, { label: "Post-history instructions\uFF08\u7531 loader \u8FD1\u4F3C\u653E\u7F6E\uFF09", value: detail.data.postHistoryInstructions }),
        detail.data.characterBook !== null ? h2("div", { className: "dcc-status" }, uiMessage("character.embeddedBook", { count: Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : translateVisibleText("\u672A\u77E5") })) : null,
        h2(DiagnosticList, { title: "\u517C\u5BB9\u8B66\u544A", items: detail.compatibility.warnings }),
        h2(DiagnosticList, { title: "\u9700\u8981 loader/\u5176\u4ED6\u6A21\u5757\u5904\u7406", items: detail.compatibility.unsupportedFeatures }),
        detail.compatibility.unknownMacroNames.length > 0 ? h2("div", { className: "dcc-status" }, uiText`未知宏：${detail.compatibility.unknownMacroNames.join(", ")}`) : null,
        h2(
          "div",
          { className: "dcc-actions" },
          h2("a", { className: "dcc-button", href: `${API_ROOT2}/characters/${encodeURIComponent(detail.id)}/artifact`, download: "" }, "\u5BFC\u51FA\u539F\u4EF6"),
          h2("a", { className: "dcc-button", href: `${API_ROOT2}/characters/${encodeURIComponent(detail.id)}/json`, download: "" }, "\u5BFC\u51FA JSON")
        ),
        h2("div", { className: "dcc-footer" }, h2("button", { className: "dcc-button dcc-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664\u89D2\u8272\u5361"))
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
var h3 = createLocalizedElement(import_react3.createElement);
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
.dwb-panel{position:absolute;top:0;right:0;bottom:0;width:min(500px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dwb-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dwb-title{font-size:16px;font-weight:650;flex:1}.dwb-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dwb-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:11px}.dwb-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dwb-actions{display:flex;gap:7px;flex-wrap:wrap}.dwb-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.dwb-button:disabled{opacity:.5;cursor:default}.dwb-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dwb-danger{color:var(--dsw-alias-state-error)}.dwb-field{display:flex;flex-direction:column;gap:4px}.dwb-label{font-size:12px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dwb-input,.dwb-select,.dwb-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px 8px}.dwb-input,.dwb-select{height:36px}.dwb-textarea{min-height:110px;resize:vertical;line-height:1.5}.dwb-note,.dwb-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dwb-status{font-size:13px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dwb-status[data-error=true]{color:var(--dsw-alias-state-error)}.dwb-status[data-warning=true]{color:var(--dsw-alias-state-warning,#b46b00)}.dwb-section-title{font-size:15px;font-weight:700;margin:5px 0 0}.dwb-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:8px}.dwb-resource-title{font-size:14px;font-weight:650}.dwb-bindings{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dwb-check{display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.45}.dwb-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dwb-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:13px}.dwb-entry>summary::-webkit-details-marker{display:none}.dwb-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dwb-entry[data-enabled=true] .dwb-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dwb-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwb-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px}.dwb-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dwb-checks{display:flex;flex-wrap:wrap;gap:10px}.dwb-list{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
.dwb-source-section{border:1px solid var(--dsw-alias-border-l2);border-radius:11px;padding:10px;background:color-mix(in srgb,var(--dsw-specific-tip) 35%,transparent);display:flex;flex-direction:column;gap:9px}.dwb-source-section>.dwb-section-title{margin:0}.dwb-source-section>.dwb-resource{background:var(--dsw-alias-bg-base)}
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
  return h3("label", { className: "dwb-field" }, h3("span", { className: "dwb-label" }, label), children);
}
function parseKeywords(value) {
  return value.split(/[,，]/u).map((item) => item.trim()).filter(Boolean);
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
  return h3(
    "details",
    { className: "dwb-entry", "data-enabled": entry.enabled === true },
    h3(
      "summary",
      null,
      h3("span", { className: "dwb-dot" }),
      h3("span", { className: "dwb-entry-name" }, entry.comment || entry.name ? rawText(entry.comment || entry.name) : uiText`条目 ${entry.id ?? index}`),
      h3("span", { className: "dwb-entry-state" }, entry.constant ? "\u5E38\u9A7B" : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(", ")) : "\u65E0\u5173\u952E\u8BCD")
    ),
    h3(
      "div",
      { className: "dwb-entry-body" },
      h3(Field3, { label: "\u6761\u76EE\u6807\u9898" }, h3("input", { className: "dwb-input", value: entry.comment ?? entry.name ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      h3(Field3, { label: "\u4E3B\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09" }, h3("input", { className: "dwb-input", value: (entry.keys ?? []).join(", "), onChange: (event) => patch({ keys: parseKeywords(event.target.value) }) })),
      h3(Field3, { label: "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09" }, h3("input", { className: "dwb-input", value: secondaryKeys.join(", "), onChange: (event) => {
        const keys = parseKeywords(event.target.value);
        patch({ secondary_keys: keys, selective: keys.length > 0 });
      } })),
      secondaryKeys.length > 0 ? h3(Field3, { label: "Secondary logic" }, h3(
        "select",
        {
          className: "dwb-select",
          value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? "and_any",
          onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true, extensions: { ...entry.extensions ?? {}, selectiveLogic: event.target.value } })
        },
        h3("option", { value: "and_any" }, "AND ANY\uFF1A\u547D\u4E2D\u4EFB\u4E00"),
        h3("option", { value: "and_all" }, "AND ALL\uFF1A\u547D\u4E2D\u5168\u90E8"),
        h3("option", { value: "not_any" }, "NOT ANY\uFF1A\u4E0D\u80FD\u547D\u4E2D\u4EFB\u4E00"),
        h3("option", { value: "not_all" }, "NOT ALL\uFF1A\u4E0D\u80FD\u5168\u90E8\u547D\u4E2D")
      )) : null,
      h3(Field3, { label: "\u6B63\u6587" }, h3("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      h3(
        "div",
        { className: "dwb-grid" },
        h3(Field3, { label: "\u4F4D\u7F6E" }, h3("select", { className: "dwb-select", value: position, onChange: (event) => {
          const value = Number(event.target.value);
          patch({ position: value === 0 ? "before_char" : value === 1 ? "after_char" : entry.position, extensions: { ...entry.extensions ?? {}, position: value } });
        } }, ...POSITIONS.map(([_value, label], value) => h3("option", { key: value, value }, label)))),
        h3(Field3, { label: "\u987A\u5E8F\uFF08\u9AD8\u503C\u4F18\u5148\uFF09" }, h3("input", { className: "dwb-input", type: "number", value: entry.insertion_order ?? 100, onChange: (event) => patch({ insertion_order: Number(event.target.value) }) })),
        h3(Field3, { label: "\u6982\u7387\uFF080\u2013100\uFF09" }, h3("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? entry.extensions?.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), extensions: { ...entry.extensions ?? {}, probability: Number(event.target.value), useProbability: true } }) }))
      ),
      h3(
        "div",
        { className: "dwb-checks" },
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), "\u542F\u7528"),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), "\u5E38\u9A7B"),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: (event) => patch({ case_sensitive: event.target.checked, extensions: { ...entry.extensions ?? {}, case_sensitive: event.target.checked } }) }), "\u533A\u5206\u5927\u5C0F\u5199"),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: (event) => patch({ match_whole_words: event.target.checked, extensions: { ...entry.extensions ?? {}, match_whole_words: event.target.checked } }) }), "\u5168\u8BCD\u5339\u914D")
      ),
      h3("div", { className: "dwb-actions" }, h3("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, "\u5220\u9664\u6761\u76EE"))
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
    comment: unwrapText(uiText`新条目 ${uid}`),
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
  return h3(
    "details",
    { className: "dwb-entry", "data-enabled": entry.enabled === true },
    h3(
      "summary",
      null,
      h3("span", { className: "dwb-dot" }),
      h3("span", { className: "dwb-entry-name" }, entry.comment ? rawText(entry.comment) : uiText`条目 ${entry.uid ?? index}`),
      h3("span", { className: "dwb-entry-state" }, entry.constant ? "\u5E38\u9A7B" : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(", ")) : "\u65E0\u5173\u952E\u8BCD")
    ),
    h3(
      "div",
      { className: "dwb-entry-body" },
      h3(Field3, { label: "\u6761\u76EE\u6807\u9898" }, h3("input", { className: "dwb-input", value: entry.comment ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      h3(Field3, { label: "\u4E3B\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09" }, h3("input", { className: "dwb-input", value: (entry.keys ?? []).join(", "), onChange: (event) => patch({ keys: parseKeywords(event.target.value) }) })),
      h3(Field3, { label: "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09" }, h3("input", { className: "dwb-input", value: secondary.join(", "), onChange: (event) => {
        const keys = parseKeywords(event.target.value);
        patch({ secondaryKeys: keys, selective: keys.length > 0 });
      } })),
      secondary.length > 0 ? h3(Field3, { label: "Secondary logic" }, h3(
        "select",
        { className: "dwb-select", value: entry.selectiveLogic ?? "and_any", onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true }) },
        h3("option", { value: "and_any" }, "AND ANY\uFF1A\u547D\u4E2D\u4EFB\u4E00"),
        h3("option", { value: "and_all" }, "AND ALL\uFF1A\u547D\u4E2D\u5168\u90E8"),
        h3("option", { value: "not_any" }, "NOT ANY\uFF1A\u4E0D\u80FD\u547D\u4E2D\u4EFB\u4E00"),
        h3("option", { value: "not_all" }, "NOT ALL\uFF1A\u4E0D\u80FD\u5168\u90E8\u547D\u4E2D")
      )) : null,
      h3(Field3, { label: "\u6B63\u6587" }, h3("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      h3(
        "div",
        { className: "dwb-grid" },
        h3(Field3, { label: "\u4F4D\u7F6E" }, h3("select", { className: "dwb-select", value: entry.position, onChange: (event) => patch({ position: event.target.value }) }, ...POSITIONS.map(([value, label]) => h3("option", { key: value, value }, label)))),
        h3(Field3, { label: "\u987A\u5E8F\uFF08\u9AD8\u503C\u4F18\u5148\uFF09" }, h3("input", { className: "dwb-input", type: "number", value: entry.insertionOrder ?? 100, onChange: (event) => patch({ insertionOrder: Number(event.target.value) }) })),
        h3(Field3, { label: "\u6982\u7387\uFF080\u2013100\uFF09" }, h3("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), useProbability: true }) }))
      ),
      h3(
        "div",
        { className: "dwb-checks" },
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), "\u542F\u7528"),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), "\u5E38\u9A7B"),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.caseSensitive === true, onChange: (event) => patch({ caseSensitive: event.target.checked }) }), "\u533A\u5206\u5927\u5C0F\u5199"),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.matchWholeWords === true, onChange: (event) => patch({ matchWholeWords: event.target.checked }) }), "\u5168\u8BCD\u5339\u914D")
      ),
      h3("div", { className: "dwb-actions" }, h3("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, "\u5220\u9664\u6761\u76EE"))
    )
  );
}
function WorldBookPanel({ sessionId, close }) {
  const [catalog2, setCatalog] = (0, import_react3.useState)(null);
  const [document2, setDocument] = (0, import_react3.useState)(null);
  const [draft, setDraft] = (0, import_react3.useState)(null);
  const [selection, setSelection] = (0, import_react3.useState)([]);
  const [appliedSelection, setAppliedSelection] = (0, import_react3.useState)([]);
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
    const activeView2 = await api3(`/active${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`);
    const characterId = activeView2.resources?.characterCard?.id ?? null;
    let embeddedBook = null;
    if (characterId !== null) {
      const character = await api3(`/characters/${encodeURIComponent(characterId)}`);
      embeddedBook = character.character?.data?.characterBook ?? null;
    }
    if (currentGeneration !== generation.current) return;
    const ids = selected.selection?.worldBookIds ?? [];
    setCatalog(list);
    setSelection(ids);
    setAppliedSelection(ids);
    setActive(activeView2);
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
    setAppliedSelection(data.selection.worldBookIds);
    window.dispatchEvent(new Event("dsh-tavern:refresh"));
  }, "\u5F53\u524D\u4F1A\u8BDD\u7684\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58");
  const remove = () => run(async () => {
    if (document2 === null || !window.confirm(unwrapText(uiText`删除独立世界书“${document2.name}”？角色卡内嵌世界书不会受到影响。`))) return;
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
    setDraft((current2) => {
      const next = structuredClone(current2);
      next.entries[index] = { ...next.entries[index], ...patch };
      return next;
    });
    setDirty(true);
  };
  const entries = draft?.entries ?? [];
  const embeddedEntries = embeddedDraft?.entries ?? [];
  const embedded = active?.resources?.worldBooks?.filter((item) => item.kind === "embedded-character-book") ?? [];
  const diagnostics = active?.diagnostics?.filter((item) => String(item.code ?? "").includes("WORLD_BOOK")) ?? [];
  const selectionDirty = selection.length !== appliedSelection.length || selection.some((id, index) => id !== appliedSelection[index]);
  return h3(
    "div",
    { className: "dwb-panel" },
    h3("div", { className: "dwb-header" }, h3("div", { className: "dwb-title" }, "\u4E16\u754C\u4FE1\u606F\uFF08World Book\uFF09"), h3("button", { className: "dwb-close", type: "button", onClick: close, "aria-label": "\u5173\u95ED\u4E16\u754C\u4E66\u4FA7\u8FB9\u680F" }, "\u2715")),
    h3(
      "div",
      { className: "dwb-body" },
      h3(
        "div",
        { className: "dwb-toolbar" },
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, "\u5BFC\u5165 JSON"),
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: create }, "\u65B0\u5EFA\u4E16\u754C\u4E66"),
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => {
          if (!dirty || window.confirm(translateVisibleText("\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F"))) run(() => refresh(), "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u5237\u65B0");
        } }, "\u5237\u65B0"),
        h3("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,application/json", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      h3("p", { className: "dwb-note" }, uiMessage("world.currentSession", { session: sessionId || translateVisibleText("\u65E0") })),
      h3("div", { className: "dwb-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.error ? rawText(status.text) : status.text),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "standalone" },
        h3("h2", { className: "dwb-section-title" }, "\u72EC\u7ACB\u4E16\u754C\u4E66"),
        h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, "\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A"),
          catalog2?.worldBooks.length ? h3("div", { className: "dwb-bindings" }, ...catalog2.worldBooks.map((item) => h3(
            "label",
            { className: "dwb-check", key: item.id },
            h3("input", { type: "checkbox", checked: selection.includes(item.id), onChange: (event) => setSelection((current2) => event.target.checked ? [...current2, item.id] : current2.filter((id) => id !== item.id)) }),
            uiMessage("world.catalogItem", { name: item.name, count: item.entryCount })
          ))) : h3("p", { className: "dwb-note" }, "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002"),
          selectionDirty ? h3("div", { className: "dwb-status", "data-warning": true }, "\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u5F53\u524D\u52FE\u9009\u5C1A\u672A\u5E94\u7528\u5230\u4F1A\u8BDD\u3002") : h3("p", { className: "dwb-note" }, "\u9762\u677F\u663E\u793A\u7684\u7ED1\u5B9A\u5DF2\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD\u3002"),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !sessionId || !selectionDirty, onClick: saveSelection }, selectionDirty ? "\u5E94\u7528\u4F1A\u8BDD\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09" : "\u5F53\u524D\u7ED1\u5B9A\u5DF2\u5E94\u7528"),
            h3("button", { className: "dwb-button", type: "button", disabled: busy || !sessionId || selection.length === 0, onClick: () => setSelection([]) }, "\u6E05\u7A7A\u5F85\u5E94\u7528\u9009\u62E9")
          )
        ),
        h3(Field3, { label: "\u6D4F\u89C8\u72EC\u7ACB\u4E16\u754C\u4E66" }, h3(
          "select",
          { className: "dwb-select", value: document2?.id ?? "", disabled: busy || !catalog2?.worldBooks.length, onChange: (event) => {
            if (!dirty || window.confirm(translateVisibleText("\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F"))) load(event.target.value);
          } },
          ...catalog2?.worldBooks.length ? [] : [h3("option", { key: "empty", value: "" }, "\u8D44\u6E90\u5E93\u4E3A\u7A7A")],
          ...(catalog2?.worldBooks ?? []).map((item) => h3("option", { key: item.id, value: item.id }, rawText(item.name)))
        )),
        draft === null ? null : h3(
          "div",
          { className: "dwb-resource" },
          h3(Field3, { label: "\u4E16\u754C\u4E66\u540D\u79F0" }, h3("input", { className: "dwb-input", value: draft.name ?? "", onChange: (event) => {
            setDraft((current2) => ({ ...current2, name: event.target.value }));
            setDirty(true);
          } })),
          h3("p", { className: "dwb-meta" }, uiMessage("world.documentMeta", { count: entries.length })),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button", type: "button", onClick: () => {
              setDraft((current2) => ({ ...current2, entries: [...current2.entries, createWorldBookEntry(current2.entries)] }));
              setDirty(true);
            } }, "\u65B0\u589E\u6761\u76EE"),
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !dirty, onClick: save }, dirty ? "\u4FDD\u5B58\u4FEE\u6539" : "\u5DF2\u4FDD\u5B58"),
            h3("a", { className: "dwb-button", href: `${API_ROOT3}/world-books/${encodeURIComponent(document2.id)}/json`, download: "" }, "\u5BFC\u51FA JSON"),
            h3("button", { className: "dwb-button dwb-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664\u72EC\u7ACB\u4E66")
          ),
          ...entries.map((entry, index) => h3(EntryEditor, { key: `${String(entry.uid)}-${index}`, entry, index, update: updateEntry, remove: (itemIndex) => {
            if (window.confirm(translateVisibleText("\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002"))) {
              setDraft((current2) => ({ ...current2, entries: current2.entries.filter((_item, candidate) => candidate !== itemIndex) }));
              setDirty(true);
            }
          } }))
        )
      ),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "character" },
        h3("h2", { className: "dwb-section-title" }, "\u89D2\u8272\u5361\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66"),
        embeddedDraft !== null ? h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, embeddedDraft.name || embedded[0]?.name ? rawText(embeddedDraft.name || embedded[0]?.name) : "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66"),
          h3("p", { className: "dwb-note" }, uiMessage("world.embeddedMeta", { count: embeddedEntries.length })),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button", type: "button", onClick: () => {
              const ids = embeddedEntries.map((entry) => Number(entry.id)).filter(Number.isSafeInteger);
              const id = ids.length === 0 ? 0 : Math.max(...ids) + 1;
              setEmbeddedDraft((current2) => ({ ...structuredClone(current2), entries: [...current2.entries, { id, keys: [], secondary_keys: [], comment: unwrapText(uiText`新条目 ${id}`), content: "", enabled: true, constant: false, selective: false, insertion_order: 100, position: "after_char", extensions: { position: 1, probability: 100, useProbability: true } }] }));
              setEmbeddedDirty(true);
            } }, "\u65B0\u589E\u5185\u5D4C\u6761\u76EE"),
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !embeddedDirty, onClick: saveEmbedded }, embeddedDirty ? "\u4FDD\u5B58\u5185\u5D4C\u4E66" : "\u5185\u5D4C\u4E66\u5DF2\u4FDD\u5B58")
          ),
          ...embeddedEntries.map((entry, index) => h3(EmbeddedEntryEditor, { key: `${String(entry.id)}-${index}`, entry, index, update: (itemIndex, value) => {
            setEmbeddedDraft((current2) => {
              const next = structuredClone(current2);
              next.entries[itemIndex] = { ...next.entries[itemIndex], ...value };
              return next;
            });
            setEmbeddedDirty(true);
          }, remove: (itemIndex) => {
            if (window.confirm(translateVisibleText("\u5220\u9664\u8FD9\u4E2A\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002"))) {
              setEmbeddedDraft((current2) => ({ ...structuredClone(current2), entries: current2.entries.filter((_item, candidate) => candidate !== itemIndex) }));
              setEmbeddedDirty(true);
            }
          } }))
        ) : h3("p", { className: "dwb-note" }, uiMessage("world.embeddedEmpty"))
      ),
      diagnostics.length > 0 ? h3("details", { className: "dwb-resource" }, h3("summary", { className: "dwb-resource-title" }, uiMessage("world.diagnostics", { count: diagnostics.length })), h3("ul", { className: "dwb-list" }, ...diagnostics.map((item, index) => h3("li", { key: `${item.code}-${index}` }, rawText(item.message))))) : null,
      h3("p", { className: "dwb-note" }, "\u5B9E\u9645\u6FC0\u6D3B\u3001\u6392\u5E8F\u3001\u6982\u7387\u548C\u9884\u7B97\u7531\u5171\u4EAB matcher \u786E\u5B9A\uFF1B\u6700\u7EC8\u6CE8\u5165\u4ECD\u7531 Tavern loader \u7EDF\u4E00\u5B8C\u6210\u3002\u5F53\u524D\u626B\u63CF\u4F1A\u628A\u672C\u6B65\u9AA4 claimed \u8F93\u5165\u4E0E\u6301\u4E45\u5386\u53F2\u7EC4\u5408\u6210\u4E34\u65F6\u4E0A\u4E0B\u6587\uFF0C\u56E0\u6B64\u5355\u6B65\u9AA4\u4F1A\u8BDD\u4E5F\u80FD\u5728\u9996\u6B21\u8BF7\u6C42\u89E6\u53D1\u5173\u952E\u8BCD\u3002")
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

// packages/user/src/client-state.js
function sameOrderedIds(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((id, index) => id === right[index]);
}
function userResourceDirty(draft, saved) {
  if (draft === null || saved === null) return draft !== saved;
  return draft.id !== saved.id || draft.name !== saved.name || draft.description !== saved.description;
}
function userPanelDirty(draft, saved, worldBookIds, appliedWorldBookIds) {
  return userResourceDirty(draft, saved) || !sameOrderedIds(worldBookIds, appliedWorldBookIds);
}

// packages/user/src/client.js
var h4 = createLocalizedElement(import_react4.createElement);
var API_ROOT4 = "/dsh-tavern/api";
var css4 = `
.dtu-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dtu-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtu-title{font-size:16px;font-weight:650;flex:1}.dtu-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dtu-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtu-toolbar,.dtu-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtu-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px}.dtu-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtu-button:disabled{opacity:.5;cursor:default}.dtu-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtu-danger{color:var(--dsw-alias-state-error)}.dtu-field{display:flex;flex-direction:column;gap:5px}.dtu-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtu-input,.dtu-textarea,.dtu-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:8px 9px}.dtu-input,.dtu-select{height:36px}.dtu-textarea{min-height:220px;line-height:1.5;resize:vertical}.dtu-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtu-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtu-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtu-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}.dtu-editor{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtu-bindings{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px}.dtu-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.4}.dtu-section-title{font-size:14px;margin:4px 0 0}.dtu-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
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
  return h4("label", { className: "dtu-field" }, h4("span", { className: "dtu-label" }, label), children);
}
function notifyRefresh() {
  window.dispatchEvent(new Event("dsh-tavern:refresh"));
}
function UserPanel({ sessionId, sessionBlank, close }) {
  const [users, setUsers] = (0, import_react4.useState)(null);
  const [draft, setDraft] = (0, import_react4.useState)(null);
  const [savedDraft, setSavedDraft] = (0, import_react4.useState)(null);
  const [worldBooks, setWorldBooks] = (0, import_react4.useState)(null);
  const [worldBookIds, setWorldBookIds] = (0, import_react4.useState)([]);
  const [appliedWorldBookIds, setAppliedWorldBookIds] = (0, import_react4.useState)([]);
  const [selectedUserId, setSelectedUserId] = (0, import_react4.useState)(null);
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [status, setStatus] = (0, import_react4.useState)({ text: "\u52A0\u8F7D\u4E2D\u2026", error: false });
  const generation = (0, import_react4.useRef)(0);
  const draftId = (0, import_react4.useRef)(null);
  const dirtyRef = (0, import_react4.useRef)(false);
  draftId.current = draft?.id ?? null;
  const dirty = userPanelDirty(draft, savedDraft, worldBookIds, appliedWorldBookIds);
  dirtyRef.current = dirty;
  const resourceDirty = userResourceDirty(draft, savedDraft);
  const bindingDirty = !sameOrderedIds(worldBookIds, appliedWorldBookIds);
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
    const current2 = ++generation.current;
    const [catalog2, worldBookCatalog, binding] = await Promise.all([
      api4("/users"),
      api4("/world-books"),
      sessionId ? api4(`/user-selection?sessionId=${encodeURIComponent(sessionId)}`) : Promise.resolve({ selection: null })
    ]);
    const availableIds = new Set(catalog2.users.map((user) => user.id));
    const preferred = availableIds.has(preferredId) ? preferredId : availableIds.has(binding.selection?.userId) ? binding.selection.userId : null;
    const id = preferred ?? catalog2.users[0]?.id ?? null;
    const relation = id === null ? { binding: { worldBookIds: [] } } : await api4(`/users/${encodeURIComponent(id)}/world-books`);
    if (current2 !== generation.current) return;
    setUsers(catalog2.users);
    setWorldBooks(worldBookCatalog.worldBooks);
    setSelectedUserId(binding.selection?.userId ?? null);
    const nextDraft = id === null ? null : structuredClone(catalog2.users.find((user) => user.id === id) ?? null);
    const ids = relation.binding?.worldBookIds ?? [];
    setDraft(nextDraft);
    setSavedDraft(nextDraft === null ? null : structuredClone(nextDraft));
    setWorldBookIds(ids);
    setAppliedWorldBookIds(ids);
  }, [sessionId]);
  (0, import_react4.useEffect)(() => {
    run(() => refresh(), "\u7528\u6237\u8D44\u6E90\u5DF2\u52A0\u8F7D");
    const onRefresh = () => {
      if (dirtyRef.current) {
        setStatus({ text: "\u68C0\u6D4B\u5230\u5176\u4ED6 Tavern \u8D44\u6E90\u53D8\u5316\uFF1B\u4E3A\u4FDD\u7559\u672C\u9762\u677F\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u672A\u81EA\u52A8\u5237\u65B0\u3002", error: false });
        return;
      }
      run(() => refresh(draftId.current), "\u7528\u6237\u8D44\u6E90\u5DF2\u5237\u65B0");
    };
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => {
      generation.current += 1;
      window.removeEventListener("dsh-tavern:refresh", onRefresh);
    };
  }, [refresh, run]);
  (0, import_react4.useEffect)(() => {
    if (!dirty) return void 0;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const create = (0, import_react4.useCallback)(() => {
    if (dirty && !window.confirm(translateVisibleText("\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u65B0\u5EFA\u7528\u6237\u5417\uFF1F"))) return;
    run(async () => {
      const data = await api4("/users", { method: "POST", body: JSON.stringify({ name: translateVisibleText("\u65B0\u7528\u6237"), description: "" }) });
      draftId.current = data.user.id;
      await refresh(data.user.id);
      notifyRefresh();
    }, "\u7528\u6237\u8D44\u6E90\u5DF2\u521B\u5EFA\uFF1B\u4FDD\u5B58\u540D\u5B57\u548C\u63CF\u8FF0\u540E\u518D\u7ED1\u5B9A");
  }, [dirty, refresh, run]);
  const save = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null) return;
    const data = await api4(`/users/${encodeURIComponent(draft.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: draft.name, description: draft.description })
    });
    draftId.current = data.user.id;
    setDraft(data.user);
    setSavedDraft(structuredClone(data.user));
    setUsers((current2) => current2?.map((user) => user.id === data.user.id ? data.user : user) ?? current2);
    notifyRefresh();
  }, "\u540D\u5B57\u548C\u63CF\u8FF0\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u7ACB\u5373\u4F7F\u7528\u65B0\u5185\u5BB9"), [draft, run]);
  const saveWorldBooks = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null) return;
    const data = await api4(`/users/${encodeURIComponent(draft.id)}/world-books`, {
      method: "PUT",
      body: JSON.stringify({ worldBookIds })
    });
    const ids = data.binding.worldBookIds;
    setWorldBookIds(ids);
    setAppliedWorldBookIds(ids);
    notifyRefresh();
  }, "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF1B\u9009\u62E9\u8BE5\u7528\u6237\u7684\u4F1A\u8BDD\u4F1A\u5728\u4E0B\u4E00\u6B21\u7EC4\u88C5\u65F6\u81EA\u52A8\u4F7F\u7528"), [draft, run, worldBookIds]);
  const chooseUser = (0, import_react4.useCallback)((id) => {
    if (dirty && !window.confirm(translateVisibleText("\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u5207\u6362\u5417\uFF1F"))) return;
    run(() => refresh(id), "\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u52A0\u8F7D");
  }, [dirty, refresh, run]);
  const bind = (0, import_react4.useCallback)(() => run(async () => {
    if (!sessionId || draft === null) throw new Error("\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u5E76\u9009\u62E9\u7528\u6237\u8D44\u6E90");
    if (selectedUserId !== draft.id && sessionBlank === false && !window.confirm(translateVisibleText("\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u5207\u6362\u7528\u6237\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F"))) return;
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
    if (draft === null || !window.confirm(unwrapText(uiText`删除用户“${draft.name}”？所有会话中的用户选择和该用户的世界书关系都会清除。`))) return;
    await api4(`/users/${encodeURIComponent(draft.id)}`, { method: "DELETE", body: "{}" });
    draftId.current = null;
    await refresh(null);
    notifyRefresh();
  }, "\u7528\u6237\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664"), [draft, refresh, run]);
  const activeName = selectedUserId === null ? translateVisibleText("\u672A\u7ED1\u5B9A\u7528\u6237") : users?.find((user) => user.id === selectedUserId)?.name ?? selectedUserId;
  const requestClose = () => {
    if (!dirty || window.confirm(translateVisibleText("\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5173\u95ED\u5417\uFF1F"))) close();
  };
  const dirtyParts = [
    resourceDirty ? translateVisibleText("\u540D\u5B57/\u63CF\u8FF0") : "",
    bindingDirty ? translateVisibleText("\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A") : ""
  ].filter(Boolean);
  const dirtyText = uiText`有未保存修改：${dirtyParts.join(getClientUiSettings().locale === "en" ? ", " : "\u3001")}。`;
  return h4(
    "div",
    { className: "dtu-panel" },
    h4(
      "div",
      { className: "dtu-header" },
      h4("div", { className: "dtu-title" }, "Tavern \u7528\u6237"),
      h4("button", { className: "dtu-close", type: "button", title: "\u5173\u95ED\u7528\u6237\u9762\u677F", "aria-label": "\u5173\u95ED\u7528\u6237\u4FA7\u8FB9\u680F", onClick: requestClose }, "\u2715")
    ),
    h4(
      "div",
      { className: "dtu-body" },
      h4(
        "div",
        { className: "dtu-toolbar" },
        h4("button", { className: "dtu-button", type: "button", disabled: busy, onClick: create }, "\u65B0\u5EFA\u7528\u6237"),
        h4("button", { className: "dtu-button", type: "button", disabled: busy, onClick: () => {
          if (!dirty || window.confirm(translateVisibleText("\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u4FEE\u6539\uFF1F"))) run(() => refresh(draft?.id), "\u7528\u6237\u8D44\u6E90\u5DF2\u5237\u65B0");
        } }, "\u5237\u65B0")
      ),
      h4(Field4, { label: "\u6D4F\u89C8\u7528\u6237\u8D44\u6E90" }, h4(
        "select",
        {
          className: "dtu-select",
          value: draft?.id ?? "",
          disabled: busy || users === null || users.length === 0,
          onChange: (event) => chooseUser(event.target.value)
        },
        ...users?.length ? [] : [h4("option", { key: "empty", value: "" }, "\u7528\u6237\u8D44\u6E90\u5E93\u4E3A\u7A7A")],
        ...(users ?? []).map((user) => h4("option", { key: user.id, value: user.id }, rawText(user.name)))
      )),
      h4("p", { className: "dtu-note" }, uiText`当前会话：${sessionId || translateVisibleText("\u65E0")}；绑定：${activeName}`),
      h4("div", { className: "dtu-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, status.error ? rawText(status.text) : status.text),
      dirty ? h4("div", { className: "dtu-status", "data-warning": true, role: "status" }, dirtyText) : h4("p", { className: "dtu-note" }, "\u5F53\u524D\u663E\u793A\u7684\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5747\u5DF2\u4FDD\u5B58\u3002"),
      draft === null ? h4("p", { className: "dtu-note" }, users === null ? "\u6B63\u5728\u52A0\u8F7D\u7528\u6237\u8D44\u6E90\u2026" : "\u521B\u5EFA\u4E00\u4E2A\u53EA\u542B\u540D\u5B57\u548C\u63CF\u8FF0\u7684\u7528\u6237\u8D44\u6E90\u3002") : h4(
        "div",
        { className: "dtu-editor" },
        h4(Field4, { label: "\u540D\u5B57\uFF08\u7528\u4E8E {{user}} \u5B8F\uFF09" }, h4("input", { className: "dtu-input", value: draft.name, maxLength: 200, onChange: (event) => setDraft((current2) => ({ ...current2, name: event.target.value })) })),
        h4(Field4, { label: "\u63CF\u8FF0\uFF08\u8FDB\u5165 personaDescription marker\uFF1B\u7F3A marker \u65F6\u7531 loader \u7A33\u5B9A\u964D\u7EA7\uFF09" }, h4("textarea", { className: "dtu-textarea", value: draft.description, maxLength: 1e5, onChange: (event) => setDraft((current2) => ({ ...current2, description: event.target.value })) })),
        h4(
          "div",
          { className: "dtu-actions" },
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !resourceDirty, onClick: save }, resourceDirty ? "\u4FDD\u5B58\u8D44\u6E90\uFF08\u672A\u4FDD\u5B58\uFF09" : "\u8D44\u6E90\u5DF2\u4FDD\u5B58"),
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !sessionId || dirty, onClick: bind }, dirty ? "\u8BF7\u5148\u4FDD\u5B58\u4FEE\u6539" : selectedUserId === draft.id ? "\u5237\u65B0\u4F1A\u8BDD\u7ED1\u5B9A" : "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD")
        ),
        h4("h2", { className: "dtu-section-title" }, "\u7528\u6237\u7ED1\u5B9A\u7684\u72EC\u7ACB\u4E16\u754C\u4E66"),
        h4("p", { className: "dtu-note" }, "\u9009\u62E9\u8BE5\u7528\u6237\u65F6\uFF0Cloader \u4F1A\u81EA\u52A8\u7EC4\u5408\u8FD9\u91CC\u7684\u4E16\u754C\u4E66\u4E0E\u5F53\u524D\u4F1A\u8BDD\u663E\u5F0F\u9009\u62E9\u7684\u4E16\u754C\u4E66\uFF1B\u91CD\u590D\u7684\u540C\u4E00\u672C\u4E66\u53EA\u6267\u884C\u4E00\u6B21\u3002"),
        worldBooks?.length ? h4("div", { className: "dtu-bindings" }, ...worldBooks.map((book) => h4(
          "label",
          { className: "dtu-check", key: book.id },
          h4("input", {
            type: "checkbox",
            checked: worldBookIds.includes(book.id),
            onChange: (event) => setWorldBookIds((current2) => event.target.checked ? [...current2, book.id] : current2.filter((id) => id !== book.id))
          }),
          h4("span", null, uiText`${book.name}（${book.entryCount} 条）`)
        ))) : h4("p", { className: "dtu-note" }, worldBooks === null ? "\u6B63\u5728\u52A0\u8F7D\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u2026" : "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002\u8BF7\u5148\u5728\u4E16\u754C\u4E66\u9762\u677F\u521B\u5EFA\u6216\u5BFC\u5165\u3002"),
        h4(
          "div",
          { className: "dtu-actions" },
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !bindingDirty, onClick: saveWorldBooks }, bindingDirty ? "\u4FDD\u5B58\u4E16\u754C\u4E66\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09" : "\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58"),
          h4("button", { className: "dtu-button", type: "button", disabled: busy || worldBookIds.length === 0, onClick: () => setWorldBookIds([]) }, "\u6E05\u7A7A\u5F85\u4FDD\u5B58\u9009\u62E9")
        ),
        h4("button", { className: "dtu-button", type: "button", disabled: busy || !sessionId || selectedUserId === null, onClick: unbind }, "\u89E3\u9664\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A"),
        h4("p", { className: "dtu-note" }, "\u7528\u6237\u8D44\u6E90\u6B63\u6587\u4ECD\u4E25\u683C\u53EA\u6709\u540D\u5B57\u548C\u63CF\u8FF0\uFF1B\u4E16\u754C\u4E66\u5173\u7CFB\u4FDD\u5B58\u5728 loader \u7684\u72EC\u7ACB\u7ED3\u6784\u5316\u7B56\u7565\u4E2D\u3002\u7528\u6237\u8D44\u6E90\u4E0D\u5305\u542B\u5934\u50CF\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6 DSH Agent \u8EAB\u4EFD\u3002"),
        h4("div", { className: "dtu-footer" }, h4("button", { className: "dtu-button dtu-danger", type: "button", disabled: busy, onClick: remove }, "\u5220\u9664\u7528\u6237"))
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

// packages/tavern-trace/src/client.js
var import_react5 = require("react");
var h5 = createLocalizedElement(import_react5.createElement);
var TRACE_API = "/dsh-tavern/api/traces";
var css5 = `
.dttrace-root{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dttrace-toolbar{min-height:48px;box-sizing:border-box;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:10px;flex:none}.dttrace-title{font-size:16px;font-weight:680;flex:1}.dttrace-button{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 10px;font-size:13px;cursor:pointer}.dttrace-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dttrace-body{min-height:0;overflow:auto;padding:12px max(14px,calc((100% - 880px)/2));display:flex;flex-direction:column;gap:10px}.dttrace-note,.dttrace-status{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dttrace-status{padding:9px 10px;border-radius:8px;background:var(--dsw-specific-tip)}.dttrace-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dttrace-record{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);overflow:hidden}.dttrace-record>summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;align-items:center;gap:8px}.dttrace-record>summary::-webkit-details-marker{display:none}.dttrace-round{font-size:14px;font-weight:670}.dttrace-time{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-left:auto}.dttrace-badge{border-radius:999px;padding:2px 7px;font-size:11px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}.dttrace-badge[data-ok=true]{background:color-mix(in srgb,var(--dsw-alias-state-success,#2fa36b) 18%,transparent);color:var(--dsw-alias-state-success,#2fa36b)}
.dttrace-content{border-top:1px solid var(--dsw-alias-border-l1);padding:11px 12px;display:flex;flex-direction:column;gap:10px}.dttrace-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dttrace-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;min-width:0}.dttrace-label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}.dttrace-value{font-size:13px;font-weight:620;margin-top:3px;overflow-wrap:anywhere}.dttrace-meta{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin-top:3px;overflow-wrap:anywhere}
.dttrace-section{display:flex;flex-direction:column;gap:6px}.dttrace-section-title{font-size:14px;font-weight:670}.dttrace-book{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dttrace-decision{display:grid;grid-template-columns:76px minmax(110px,.7fr) minmax(160px,1.5fr);gap:7px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.45}.dttrace-decision:first-of-type{border-top:0}.dttrace-decision-state{font-weight:650}.dttrace-decision[data-included=true] .dttrace-decision-state{color:var(--dsw-alias-state-success,#2fa36b)}.dttrace-keywords{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dttrace-list{margin:0;padding-left:18px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
@media(max-width:760px){.dttrace-grid{grid-template-columns:1fr}.dttrace-decision{grid-template-columns:70px 1fr}.dttrace-keywords{grid-column:1/-1}}
`;
var reasonLabels = Object.freeze({
  constant: "\u5E38\u9A7B\u6761\u76EE",
  "primary-key-match": "\u4E3B\u5173\u952E\u8BCD\u547D\u4E2D",
  "primary-key-miss": "\u4E3B\u5173\u952E\u8BCD\u672A\u547D\u4E2D",
  "secondary-and_any-match": "\u9644\u52A0\u5173\u952E\u8BCD\u4EFB\u4E00\u547D\u4E2D",
  "secondary-and_any-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u5747\u672A\u547D\u4E2D",
  "secondary-and_all-match": "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u90E8\u547D\u4E2D",
  "secondary-and_all-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u672A\u5168\u90E8\u547D\u4E2D",
  "secondary-not_any-match": "\u9644\u52A0\u5173\u952E\u8BCD\u6392\u9664\u6761\u4EF6\u901A\u8FC7",
  "secondary-not_any-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u89E6\u53D1\u6392\u9664",
  "secondary-not_all-match": "\u9644\u52A0\u5173\u952E\u8BCD\u975E\u5168\u4E2D\u6761\u4EF6\u901A\u8FC7",
  "secondary-not_all-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u4E2D\u800C\u6392\u9664",
  disabled: "\u6761\u76EE\u5DF2\u7981\u7528",
  "external-vector-match-required": "\u9700\u8981\u5916\u90E8\u5411\u91CF\u5339\u914D",
  "inclusion-group-loser": "\u4E92\u65A5\u7EC4\u672A\u80DC\u51FA",
  "probability-failed": "\u6982\u7387\u68C0\u67E5\u62D2\u7EDD",
  "budget-exceeded": "\u8D85\u51FA token \u9884\u7B97",
  "empty-content": "\u6B63\u6587\u4E3A\u7A7A\uFF0C\u672A\u63D2\u5165",
  "outlet-unsupported": "Outlet \u65E0\u7A33\u5B9A\u63D2\u5165 seam"
});
function formatTime(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}
function formatBytes(value) {
  return value >= 1024 * 1024 ? `${Math.round(value / 1024 / 1024)} MiB` : `${Math.round(value / 1024)} KiB`;
}
function storageStatus(storage) {
  const parts = [translate("trace.storage.total", { value: formatBytes(storage.maxTotalBytes) })];
  if (Number.isSafeInteger(storage.maxRecordsPerSession)) parts.push(translate("trace.storage.perSession", { value: storage.maxRecordsPerSession }));
  if (Number.isSafeInteger(storage.maxSessions)) parts.push(translate("trace.storage.sessions", { value: storage.maxSessions }));
  if (Number.isSafeInteger(storage.maxRecordBytes)) parts.push(translate("trace.storage.perRecord", { value: formatBytes(storage.maxRecordBytes) }));
  return uiMessage("trace.storage.summary", { limits: parts.join(getClientUiSettings().locale === "en" ? ", " : "\u3001") });
}
function resourceCard(label, value) {
  return h5(
    "div",
    { className: "dttrace-card", key: label },
    h5("div", { className: "dttrace-label" }, label),
    h5("div", { className: "dttrace-value" }, value?.name ? rawText(value.name) : "\u672A\u4F7F\u7528"),
    value?.id ? h5("div", { className: "dttrace-meta" }, rawText(value.id)) : null
  );
}
function keywords(decision) {
  const configuredPrimary = decision.primaryKeys ?? [];
  const configuredSecondary = decision.secondaryKeys ?? [];
  const primary = decision.primaryMatches ?? [];
  const secondary = decision.secondaryMatches ?? [];
  const separator = getClientUiSettings().locale === "en" ? ", " : "\u3001";
  const configured = [
    configuredPrimary.length > 0 ? translate("trace.keywords.primary", { values: configuredPrimary.map((value) => JSON.stringify(value)).join(separator) }) : null,
    configuredSecondary.length > 0 ? translate("trace.keywords.secondary", { values: configuredSecondary.map((value) => JSON.stringify(value)).join(separator) }) : null
  ].filter(Boolean).join(" \xB7 ") || translateVisibleText("\u65E0\u914D\u7F6E\u5173\u952E\u8BCD");
  const matched = [
    primary.length > 0 ? translate("trace.keywords.primary", { values: primary.map((value) => JSON.stringify(value)).join(separator) }) : null,
    secondary.length > 0 ? translate("trace.keywords.secondary", { values: secondary.map((value) => JSON.stringify(value)).join(separator) }) : null
  ].filter(Boolean).join(" \xB7 ") || translateVisibleText("\u65E0\u5173\u952E\u8BCD\u547D\u4E2D");
  return { configured: rawText(configured), matched: rawText(matched) };
}
function decisionMeta(value) {
  const parts = [];
  if (value.secondaryLogic) parts.push(`secondary=${value.secondaryLogic}`);
  if (value.groupName) parts.push(unwrapText(uiMessage("trace.decision.group", { name: value.groupName, detail: value.groupOverride ? " / override" : value.groupWeight === null ? "" : ` / weight ${value.groupWeight}` })));
  if (value.probability !== null) {
    parts.push(unwrapText(uiMessage("trace.decision.probability", { value: value.probability, roll: value.probabilityRoll === null ? "" : ` / roll ${(value.probabilityRoll * 100).toFixed(2)}%` })));
  }
  if (value.tokenCost !== null) parts.push(unwrapText(uiMessage("trace.decision.budget", { value: value.tokenCost })));
  if (value.requestedPosition) {
    parts.push(unwrapText(uiMessage("trace.decision.position", {
      requested: value.requestedPosition,
      result: value.appliedPosition ? ` \u2192 ${value.appliedPosition}${value.approximatePosition ? translateVisibleText("\uFF08\u8FD1\u4F3C\uFF09") : ""}` : translateVisibleText(" \u2192 \u672A\u63D2\u5165")
    })));
  }
  return rawText(parts.join(" \xB7 "));
}
function WorldBookAudit({ book }) {
  const name2 = book.resource?.name || book.resource?.id;
  const decisionCount = translate(book.decisions.length === 1 ? "trace.decisionCount.one" : "trace.decisionCount.other", { count: book.decisions.length });
  return h5(
    "div",
    { className: "dttrace-book" },
    h5("div", { className: "dttrace-section-title" }, name2 ? rawText(name2) : "\u4E16\u754C\u4E66"),
    h5("div", { className: "dttrace-meta" }, uiMessage("trace.bookBudget", { used: book.budget.used, limit: book.budget.limit === null ? "" : ` / ${book.budget.limit}`, decisionCount })),
    ...book.decisions.map((item, index) => {
      const keywordState = keywords(item);
      return h5(
        "div",
        {
          className: "dttrace-decision",
          "data-included": item.decision === "included",
          key: `${item.entryId ?? "entry"}-${index}`
        },
        h5("div", { className: "dttrace-decision-state" }, item.decision === "included" ? "\u5DF2\u63D2\u5165" : "\u5DF2\u62D2\u7EDD"),
        h5(
          "div",
          null,
          h5("div", null, item.entryName ? rawText(item.entryName) : uiText`条目 ${String(item.entryId ?? index + 1)}`),
          h5("div", { className: "dttrace-meta" }, reasonLabels[item.reason] ?? rawText(item.reason))
        ),
        h5(
          "div",
          { className: "dttrace-keywords" },
          h5("div", null, uiMessage("trace.keywords.configured", { value: unwrapText(keywordState.configured) })),
          h5("div", null, uiMessage("trace.keywords.matched", { value: unwrapText(keywordState.matched) })),
          h5("div", { className: "dttrace-meta" }, decisionMeta(item))
        )
      );
    })
  );
}
function TraceRecord({ record, latest }) {
  const authority = record.authority ?? {};
  const linked = authority.headerEventSeq !== null;
  const reusedHeader = authority.headerReused ? translateVisibleText("\uFF08\u6CBF\u7528\u4E0A\u4E00\u4EFD header\uFF09") : "";
  const profileStatus = translateVisibleText(authority.tavernProfilePresent === false ? "\u672A\u627E\u5230" : authority.tavernProfilePresent === true ? "\u4E00\u81F4" : "\u672C\u8F6E\u65E0 profile");
  const configStatus = translateVisibleText(authority.tavernCallConfigApplied === false ? "\u4E0D\u4E00\u81F4" : "\u4E00\u81F4\u6216\u65E0\u5B57\u6BB5");
  return h5(
    "details",
    { className: "dttrace-record", open: latest },
    h5(
      "summary",
      null,
      h5("span", { className: "dttrace-round" }, uiText`轮次 ${record.turn} · 步骤 ${record.step}${record.attempt > 1 ? unwrapText(uiText` · 尝试 ${record.attempt}`) : ""}`),
      h5("span", { className: "dttrace-badge", "data-ok": linked || void 0 }, linked ? `request/header #${authority.headerEventSeq}` : "\u7B49\u5F85\u6743\u5A01 header"),
      h5("span", { className: "dttrace-time" }, rawText(formatTime(record.recordedAt)))
    ),
    h5(
      "div",
      { className: "dttrace-content" },
      h5("div", { className: "dttrace-status" }, linked ? uiMessage("trace.recordAligned", { sequence: authority.headerEventSeq, reused: reusedHeader, profile: profileStatus, config: configStatus }) : "\u5C1A\u672A\u89C2\u5BDF\u5230\u53EF\u5BF9\u9F50\u7684 DSH request/header\uFF1B\u8FD9\u4E0D\u4EE3\u8868\u8BF7\u6C42\u5DF2\u7ECF\u53D1\u9001\u3002\u5237\u65B0\u540E\u4ECD\u4F1A\u4FDD\u7559\u8BE5\u5F85\u786E\u8BA4\u8BB0\u5F55\u3002"),
      h5(
        "div",
        { className: "dttrace-grid" },
        resourceCard("Preset", record.resources?.preset),
        resourceCard("Character", record.resources?.characterCard),
        resourceCard("User", record.resources?.userProfile)
      ),
      h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, "\u7EC4\u5408\u4E0E\u63D2\u5165"),
        h5("div", { className: "dttrace-meta" }, rawText(`${record.assembly.profileSection} \xB7 order ${record.assembly.profileOrder} \xB7 ${record.assembly.systemPromptMode} \xB7 ${record.assembly.systemCharacters} characters \xB7 call config: ${Object.keys(record.assembly.callConfig ?? {}).join(", ") || translateVisibleText("\u65E0")}`))
      ),
      record.worldBooks?.length > 0 ? h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, "\u4E16\u754C\u4E66\u5339\u914D\u51B3\u7B56"),
        h5("div", { className: "dttrace-meta" }, record.activation?.pendingMessageCount > 0 ? uiMessage("trace.activationPending", {
          included: record.activation.includedPendingMessageCount,
          pending: record.activation.pendingMessageCount,
          truncated: record.activation.truncated ? translateVisibleText("\uFF1B\u626B\u63CF\u8F93\u5165\u5DF2\u6309\u4E0A\u9650\u622A\u65AD") : ""
        }) : "\u5339\u914D\u57FA\u4E8E\u672C\u6B65\u9AA4 system assembly \u5F53\u65F6\u53EF\u89C1\u7684\u6301\u4E45\u5316\u4F1A\u8BDD\u5386\u53F2\uFF1B\u6CA1\u6709\u91CD\u590D\u9644\u52A0 pending \u8F93\u5165\u3002"),
        ...record.worldBooks.map((book, index) => h5(WorldBookAudit, { book, key: `${book.resource?.id ?? "book"}-${index}` }))
      ) : h5("div", { className: "dttrace-note" }, "\u672C\u8F6E\u6CA1\u6709\u53EF\u5BA1\u8BA1\u7684\u4E16\u754C\u4E66\u5339\u914D\u6765\u6E90\u3002"),
      record.diagnostics?.length > 0 ? h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, uiMessage("trace.diagnostics", { count: record.diagnostics.length })),
        h5("ul", { className: "dttrace-list" }, ...record.diagnostics.map((item, index) => h5("li", { key: `${item.code}-${index}` }, rawText(`${item.code}: ${item.message}`))))
      ) : null,
      h5("p", { className: "dttrace-note" }, "\u9690\u79C1\u8FB9\u754C\uFF1A\u8FD9\u91CC\u53EA\u4FDD\u5B58\u8D44\u6E90\u6458\u8981\u3001\u914D\u7F6E/\u547D\u4E2D\u5173\u952E\u8BCD\u3001\u51B3\u7B56\u539F\u56E0\u3001\u4F4D\u7F6E\u3001\u9884\u7B97\u548C SHA-256 \u6458\u8981\uFF1B\u4E0D\u4FDD\u5B58 preset/\u89D2\u8272/user/\u4E16\u754C\u4E66\u6B63\u6587\u3001\u5B8C\u6574 system\u3001\u804A\u5929\u5386\u53F2\u3001header \u5185\u5BB9\u6216 tool payload\u3002")
    )
  );
}
function TavernTraceView({ sessionId, useSession }) {
  const lastVisibleSeq = useSession((snapshot) => snapshot.nodes.at(-1)?.seq ?? -1);
  const running = useSession((snapshot) => snapshot.running);
  const [data, setData] = (0, import_react5.useState)(null);
  const [error, setError] = (0, import_react5.useState)("");
  const [uiSettings, setUiSettings] = (0, import_react5.useState)(getClientUiSettings);
  const refresh = (0, import_react5.useCallback)(async () => {
    try {
      const response = await fetch(`${TRACE_API}?sessionId=${encodeURIComponent(sessionId)}`);
      const next = await response.json().catch(() => null);
      if (!response.ok || next?.ok === false) throw new Error(next?.error ?? `HTTP ${response.status}`);
      setData(next);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [sessionId]);
  (0, import_react5.useEffect)(() => {
    refresh();
  }, [refresh, lastVisibleSeq, running]);
  (0, import_react5.useEffect)(() => {
    const onSettings = (event) => setUiSettings(event.detail ?? getClientUiSettings());
    window.addEventListener("dsh-tavern:ui-settings", onSettings);
    return () => window.removeEventListener("dsh-tavern:ui-settings", onSettings);
  }, []);
  const records = [...data?.records ?? []].reverse();
  return h5(
    "div",
    {
      className: "dttrace-root",
      lang: uiSettings.locale,
      style: {
        zoom: uiSettings.scale,
        width: `${100 / uiSettings.scale}%`,
        height: `${100 / uiSettings.scale}%`
      }
    },
    h5(
      "div",
      { className: "dttrace-toolbar" },
      h5("div", { className: "dttrace-title" }, "Tavern Trace"),
      h5("button", { className: "dttrace-button", type: "button", onClick: refresh }, "\u5237\u65B0")
    ),
    h5(
      "div",
      { className: "dttrace-body" },
      h5("p", { className: "dttrace-note" }, "\u4E0E Conversation / Trajectory \u5E76\u5217\u7684 loader \u5BA1\u8BA1\u89C6\u56FE\u3002DSH request/header \u59CB\u7EC8\u662F\u6700\u7EC8\u53D1\u9001 system\u3001tools \u4E0E\u751F\u6548 config \u7684\u6743\u5A01\u3002"),
      error ? h5("div", { className: "dttrace-status", "data-error": true }, rawText(error)) : null,
      data === null && !error ? h5("div", { className: "dttrace-status" }, "\u6B63\u5728\u8BFB\u53D6\u5BA1\u8BA1\u8BB0\u5F55\u2026") : null,
      data !== null ? h5("div", { className: "dttrace-status" }, storageStatus(data.storage)) : null,
      records.length === 0 && data !== null ? h5("div", { className: "dttrace-status" }, "\u6B64\u4F1A\u8BDD\u8FD8\u6CA1\u6709 Tavern \u8BF7\u6C42\u5BA1\u8BA1\u8BB0\u5F55\u3002\u53D1\u9001\u4E0B\u4E00\u6761\u6D88\u606F\u540E\u518D\u67E5\u770B\u3002") : null,
      ...records.map((record, index) => h5(TraceRecord, { record, latest: index === 0, key: record.id }))
    )
  );
}
function installTavernTraceStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-trace"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern-trace";
  style.textContent = css5;
  document.head.append(style);
}
function registerTavernTraceView(ctx) {
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "tavern-trace",
    order: 20,
    label: "Tavern Trace",
    inject: () => ({})
  }, TavernTraceView));
}

// packages/session-template/src/client.js
var import_react6 = require("react");
var h6 = createLocalizedElement(import_react6.createElement);
var API_ROOT5 = "/dsh-tavern/api";
async function api5(path, options = {}) {
  const response = await fetch(`${API_ROOT5}${path}`, {
    ...options,
    headers: options.body === void 0 ? options.headers : { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`);
    error.diagnostics = data?.error?.diagnostics ?? [];
    throw error;
  }
  return data;
}
function PreviewRow({ label, value, missing = false }) {
  return h6(
    "div",
    { className: "dtv-preview-row", "data-missing": missing || void 0 },
    h6("span", { className: "dtv-preview-label" }, label),
    h6("span", { className: "dtv-preview-value" }, value)
  );
}
function resourceValue(resource, emptyLabel) {
  return resource === null || resource === void 0 ? emptyLabel : rawText(resource.name || resource.id);
}
function TemplatePreview({ template }) {
  const contents = template?.contents ?? {};
  const character = template?.selection?.character ?? contents.character ?? {};
  const books = Array.isArray(contents.worldBooks) ? contents.worldBooks : [];
  return h6(
    "div",
    { className: "dtv-preview" },
    h6("div", { className: "dtv-preview-title" }, "\u4FDD\u5B58\u7684 Tavern \u914D\u7F6E"),
    h6(PreviewRow, { label: "\u9884\u8BBE", value: resourceValue(contents.preset, "\u672A\u9009\u62E9\u9884\u8BBE"), missing: contents.preset?.missing }),
    h6(PreviewRow, { label: "\u89D2\u8272\u5361", value: resourceValue(contents.characterCard, "\u672A\u7ED1\u5B9A\u89D2\u8272"), missing: contents.characterCard?.missing }),
    contents.characterCard === null || contents.characterCard === void 0 ? null : h6(
      "div",
      { className: "dtv-preview-options" },
      h6("span", null, uiMessage("template.preview.greeting", { value: Number(character.greetingIndex ?? 0) + 1 })),
      h6("span", null, uiText`卡内 system_prompt：${character.preferCharacterSystemPrompt === false ? translateVisibleText("\u5DF2\u7981\u7528") : translateVisibleText("\u5DF2\u542F\u7528")}`),
      h6("span", null, uiText`post_history_instructions: ${character.preferCharacterPostHistory === false ? translateVisibleText("\u5DF2\u7981\u7528") : translateVisibleText("\u5DF2\u542F\u7528")}`)
    ),
    h6(PreviewRow, { label: "\u7528\u6237", value: resourceValue(contents.user, "\u672A\u7ED1\u5B9A\u7528\u6237"), missing: contents.user?.missing }),
    h6(
      "div",
      { className: "dtv-preview-row dtv-preview-books" },
      h6("span", { className: "dtv-preview-label" }, "\u72EC\u7ACB\u4E16\u754C\u4E66\uFF08\u6309\u7ED1\u5B9A\u987A\u5E8F\uFF09"),
      books.length === 0 ? h6("span", { className: "dtv-preview-value" }, "\u672A\u7ED1\u5B9A\u4E16\u754C\u4E66") : h6("ol", { className: "dtv-preview-list" }, ...books.map((book) => h6("li", { key: book.id, "data-missing": book.missing || void 0 }, rawText(book.name || book.id))))
    )
  );
}
function SessionTemplatePanel({ sessionId, workspaceId, createCleanSession, close }) {
  const [templates, setTemplates] = (0, import_react6.useState)([]);
  const [selectedId, setSelectedId] = (0, import_react6.useState)(null);
  const [name2, setName] = (0, import_react6.useState)(() => translateVisibleText("\u65B0\u914D\u7F6E\u6A21\u677F"));
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)("");
  const [status, setStatus] = (0, import_react6.useState)("");
  const selected = templates.find((item) => item.id === selectedId) ?? null;
  const refresh = (0, import_react6.useCallback)(async () => {
    const data = await api5("/session-templates");
    setTemplates(data.templates);
    setSelectedId(data.selectedId);
    const active = data.templates.find((item) => item.id === data.selectedId);
    if (active !== void 0) setName(active.name);
  }, []);
  (0, import_react6.useEffect)(() => {
    refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    const onRefresh = () => refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => window.removeEventListener("dsh-tavern:refresh", onRefresh);
  }, [refresh]);
  const run = (0, import_react6.useCallback)(async (operation, success) => {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      setStatus(typeof success === "function" ? success(result) : translateVisibleText(success));
      await refresh();
      window.dispatchEvent(new Event("dsh-tavern:refresh"));
      return result;
    } catch (reason) {
      const diagnostics2 = Array.isArray(reason?.diagnostics) ? reason.diagnostics : [];
      setError(diagnostics2[0]?.message ?? (reason instanceof Error ? reason.message : String(reason)));
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  const select = (event) => run(async () => {
    const id = event.target.value || null;
    const data = await api5("/session-templates/select", {
      method: "POST",
      body: JSON.stringify({ id })
    });
    setSelectedId(data.selectedId);
    if (data.template !== null) setName(data.template.name);
  }, "\u6A21\u677F\u9009\u62E9\u5DF2\u66F4\u65B0");
  const create = () => run(async () => {
    if (!sessionId) throw new Error(translateVisibleText("\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u518D\u4FDD\u5B58\u5F53\u524D Tavern \u8BBE\u7F6E"));
    return api5("/session-templates", {
      method: "POST",
      body: JSON.stringify({ name: name2, sourceSessionId: sessionId })
    });
  }, (result) => unwrapText(uiText`已创建模板：${result.template.name}`));
  const rename = () => run(async () => {
    if (selectedId === null) throw new Error(translateVisibleText("\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6A21\u677F"));
    return api5(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name2 })
    });
  }, (result) => unwrapText(uiText`已重命名模板：${result.template.name}`));
  const update = () => run(async () => {
    if (!sessionId || selectedId === null) throw new Error(translateVisibleText("\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD\u5E76\u9009\u62E9\u6A21\u677F"));
    return api5(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name2, sourceSessionId: sessionId })
    });
  }, (result) => unwrapText(uiText`已用当前设置更新模板：${result.template.name}`));
  const remove = () => {
    if (selectedId === null || !window.confirm(unwrapText(uiText`删除配置模板“${selected?.name ?? selectedId}”？这不会删除任何 DSH 会话。`))) return;
    run(() => api5(`/session-templates/${encodeURIComponent(selectedId)}`, { method: "DELETE", body: JSON.stringify({}) }), "\u6A21\u677F\u5DF2\u5220\u9664");
  };
  const start = (mode) => run(async () => {
    if (mode === "current" && !sessionId) throw new Error(translateVisibleText("\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u6765\u6E90\u4F1A\u8BDD"));
    if (workspaceId === null) throw new Error(translateVisibleText("\u5F53\u524D\u4F1A\u8BDD\u4E0D\u5C5E\u4E8E DSH \u5DE5\u4F5C\u533A\uFF1B\u8BF7\u5148\u628A\u4F1A\u8BDD\u52A0\u5165\u5DE5\u4F5C\u533A"));
    const source = mode === "current" ? { mode: "current", sessionId } : { mode: "template", templateId: selectedId };
    if (mode === "template" && selectedId === null) throw new Error(translateVisibleText("\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6A21\u677F"));
    return createCleanSession({ workspaceId, source });
  }, (id) => unwrapText(uiText`已切换到干净会话：${id}`));
  const diagnostics = Array.isArray(selected?.diagnostics) ? selected.diagnostics : [];
  return h6(
    "div",
    { className: "dtv-panel" },
    h6(
      "div",
      { className: "dtv-header" },
      h6("div", { className: "dtv-title" }, "\u65B0\u4F1A\u8BDD\u4E0E\u914D\u7F6E\u6A21\u677F"),
      h6("button", { className: "dtv-close", type: "button", title: "\u5173\u95ED\u65B0\u4F1A\u8BDD\u4FA7\u8FB9\u680F", "aria-label": "\u5173\u95ED\u65B0\u4F1A\u8BDD\u4FA7\u8FB9\u680F", onClick: close }, "\u2715")
    ),
    h6(
      "div",
      { className: "dtv-body" },
      h6("button", {
        className: "dtv-button dtv-primary",
        type: "button",
        disabled: busy || !sessionId || workspaceId === null,
        onClick: () => start("current")
      }, "\u7EF4\u6301\u5F53\u524D Tavern \u8BBE\u7F6E\u65B0\u5F00\u5BF9\u8BDD"),
      h6("p", { className: "dtv-note" }, "\u53EA\u7EE7\u627F preset\u3001\u89D2\u8272\u5361\u4E0E greeting/\u5F00\u5173\u3001\u7528\u6237\u548C\u72EC\u7ACB\u4E16\u754C\u4E66\u9009\u62E9\u3002DSH \u5386\u53F2\u3001Tavern Trace\u3001Inbox\u3001\u8FD0\u884C\u4E2D turn/step \u548C\u5176\u4ED6\u8FD0\u884C\u6001\u4E0D\u4F1A\u590D\u5236\u3002"),
      workspaceId === null ? h6("div", { className: "dtv-status", "data-error": true }, "\u6CA1\u6709\u53EF\u7528\u7684 DSH \u76EE\u6807\u5DE5\u4F5C\u533A\u3002\u8BF7\u5148\u5728 DSH \u4FA7\u680F\u4E2D\u52A0\u5165\u6216\u6253\u5F00\u5DE5\u4F5C\u533A\u3002") : null,
      h6(
        "div",
        { className: "dtv-resource" },
        h6("div", { className: "dtv-resource-title" }, `\u914D\u7F6E\u6A21\u677F\uFF08${templates.length}\uFF09`),
        h6(
          "label",
          { className: "dtv-field" },
          h6("span", { className: "dtv-label" }, "\u5DF2\u9009\u62E9\u6A21\u677F"),
          h6(
            "select",
            { className: "dtv-select", value: selectedId ?? "", disabled: busy, onChange: select },
            h6("option", { value: "" }, "\u672A\u9009\u62E9\u6A21\u677F"),
            ...templates.map((template) => h6("option", { key: template.id, value: template.id }, rawText(template.name)))
          )
        ),
        h6(
          "label",
          { className: "dtv-field" },
          h6("span", { className: "dtv-label" }, "\u6A21\u677F\u540D\u79F0"),
          h6("input", { className: "dtv-input", value: name2, maxLength: 120, disabled: busy, onChange: (event) => setName(event.target.value) })
        ),
        h6(
          "div",
          { className: "dtv-template-actions" },
          h6("button", { className: "dtv-button", type: "button", disabled: busy || !sessionId, onClick: create }, "\u7531\u5F53\u524D\u8BBE\u7F6E\u521B\u5EFA"),
          h6("button", { className: "dtv-button", type: "button", disabled: busy || selectedId === null, onClick: rename }, "\u4EC5\u4FDD\u5B58\u540D\u79F0"),
          h6("button", { className: "dtv-button", type: "button", disabled: busy || !sessionId || selectedId === null, onClick: update }, "\u7528\u5F53\u524D\u8BBE\u7F6E\u66F4\u65B0"),
          h6("button", { className: "dtv-button dtv-danger", type: "button", disabled: busy || selectedId === null, onClick: remove }, "\u5220\u9664\u6A21\u677F")
        ),
        h6("p", { className: "dtv-note" }, uiMessage("template.currentSettingsReminder")),
        selected === null ? null : h6(TemplatePreview, { template: selected }),
        diagnostics.length === 0 ? null : h6(
          "div",
          { className: "dtv-status", "data-error": true },
          h6("div", null, "\u8BE5\u6A21\u677F\u6682\u4E0D\u53EF\u7528\u4E8E\u521B\u5EFA\uFF1A"),
          h6("ul", { className: "dtv-list" }, ...diagnostics.map((item, index) => h6("li", { key: `${item.code}-${index}` }, rawText(item.message))))
        ),
        h6("button", {
          className: "dtv-button dtv-primary",
          type: "button",
          disabled: busy || selectedId === null || diagnostics.length > 0 || workspaceId === null,
          onClick: () => start("template")
        }, "\u6839\u636E\u6240\u9009\u6A21\u677F\u65B0\u5F00\u5E72\u51C0\u5BF9\u8BDD")
      ),
      h6("div", { className: "dtv-status", "data-error": error !== "" || void 0, role: "status" }, error ? rawText(error) : status ? rawText(status) : "\u6A21\u677F\u4E0E\u65B0\u4F1A\u8BDD\u64CD\u4F5C\u5DF2\u5C31\u7EEA\u3002"),
      h6("p", { className: "dtv-note" }, "DSH \u53EF\u80FD\u590D\u7528\u540C\u5DE5\u4F5C\u533A\u4E2D\u5DF2\u6709\u7684\u771F\u5B9E blank session\uFF1B\u8FD9\u662F\u5176\u516C\u5F00 New Session \u8BED\u4E49\u3002\u63D2\u4EF6\u4F1A\u5728\u5BFC\u822A\u524D\u539F\u5B50\u66FF\u6362\u8BE5 blank session \u7684 Tavern \u9009\u62E9\u3002")
    )
  );
}

// packages/session-template/src/client-state.js
function workspaceIdForSession(workspaces, sessionId) {
  if (!Array.isArray(workspaces) || typeof sessionId !== "string" || sessionId === "") return null;
  return workspaces.find((item) => Array.isArray(item?.sessionIds) && item.sessionIds.includes(sessionId))?.workspaceId ?? null;
}
function workspaceTargetId(workspaceState, sessionId) {
  if (typeof sessionId === "string" && sessionId !== "") {
    return workspaceIdForSession(workspaceState?.items, sessionId);
  }
  return typeof workspaceState?.recentWorkspaceId === "string" && workspaceState.recentWorkspaceId !== "" ? workspaceState.recentWorkspaceId : null;
}
var SessionConfigurationUnavailableError = class extends Error {
  constructor(diagnostics = []) {
    super(diagnostics[0]?.message ?? "\u5F53\u524D\u914D\u7F6E\u5305\u542B\u7F3A\u5931\u6216\u65E0\u6548\u8D44\u6E90\uFF0C\u65E0\u6CD5\u521B\u5EFA\u65B0\u4F1A\u8BDD");
    this.name = "SessionConfigurationUnavailableError";
    this.diagnostics = structuredClone(diagnostics);
  }
};
async function createCleanSessionWorkflow({
  workspaceId,
  source,
  preview,
  connectWorkspace,
  applySelection,
  openSession,
  refresh
}) {
  if (workspaceId === null || workspaceId === void 0 || workspaceId === "") {
    throw new Error("\u5F53\u524D\u4F1A\u8BDD\u4E0D\u5C5E\u4E8E DSH \u5DE5\u4F5C\u533A\uFF1B\u8BF7\u5148\u628A\u4F1A\u8BDD\u52A0\u5165\u5DE5\u4F5C\u533A\uFF0C\u518D\u521B\u5EFA\u5E72\u51C0\u4F1A\u8BDD");
  }
  const checked = await preview(source);
  if (checked?.available !== true) throw new SessionConfigurationUnavailableError(checked?.diagnostics);
  const targetSessionId = await connectWorkspace(workspaceId);
  await applySelection(targetSessionId, source);
  openSession(targetSessionId);
  refresh();
  return targetSessionId;
}

// packages/client/src/state.js
var TAVERN_MENU_ITEMS = Object.freeze([
  { id: "preset", label: "\u9884\u8BBE", emptyTitle: "\u672A\u9009\u62E9\u9884\u8BBE", available: true },
  { id: "character", label: "\u89D2\u8272\u5361", emptyTitle: "\u672A\u7ED1\u5B9A\u89D2\u8272", available: true },
  { id: "world-info", label: "\u4E16\u754C\u4E66", emptyTitle: "\u672A\u7ED1\u5B9A\u4E16\u754C\u4E66", available: true },
  { id: "user", label: "\u7528\u6237", emptyTitle: "\u672A\u7ED1\u5B9A\u7528\u6237", available: true },
  { id: "session-template", label: "\u65B0\u4F1A\u8BDD", emptyTitle: "\u5F53\u524D\u8BBE\u7F6E\u6216\u914D\u7F6E\u6A21\u677F", available: true, binding: false, showBinding: false },
  { id: "settings", label: "\u754C\u9762\u8BBE\u7F6E", emptyTitle: "\u8BED\u8A00\u4E0E\u7F29\u653E", available: true, binding: false, showBinding: false }
]);
var TAVERN_LAUNCHER_SIZE = 44;
var TAVERN_LAUNCHER_PANEL = Object.freeze({ width: 300, height: 376 });
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function firstRecord(...values) {
  return values.find(isRecord) ?? null;
}
function firstArray(...values) {
  return values.find(Array.isArray) ?? [];
}
function resourceTitle(resource, fallback = "") {
  if (!isRecord(resource)) return fallback;
  for (const key of ["name", "title", "displayName", "label"]) {
    if (typeof resource[key] === "string" && resource[key].trim() !== "") return resource[key].trim();
  }
  return fallback;
}
function catalog(snapshot, ...keys) {
  for (const container of [snapshot?.catalog, snapshot?.catalogs]) {
    if (!isRecord(container)) continue;
    for (const key of keys) {
      if (Array.isArray(container[key])) return container[key];
      if (Array.isArray(container[key]?.items)) return container[key].items;
    }
  }
  return [];
}
function findResourceById(items, id) {
  return items.find((item) => isRecord(item) && String(item.id ?? item.resourceId ?? "") === String(id)) ?? null;
}
function selectionIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.map((item) => isRecord(item) ? item.id ?? item.resourceId : item).filter((id) => typeof id === "string" && id !== "" || Number.isSafeInteger(id));
  return ids.filter((id, index) => ids.findIndex((item) => String(item) === String(id)) === index);
}
function singleStatus({ id, resource, items, emptyTitle }) {
  const bound = id !== null && id !== void 0 && id !== "";
  const directResource = isRecord(resource) && (resource.id === void 0 || String(resource.id) === String(id)) ? resource : null;
  const resolved = firstRecord(directResource, bound ? findResourceById(items, id) : null);
  return {
    bound,
    title: bound ? resourceTitle(resolved, String(id)) : emptyTitle,
    count: bound ? 1 : 0
  };
}
function launcherResourceStatuses(snapshot) {
  const selection = isRecord(snapshot?.selection) ? snapshot.selection : {};
  const resources = isRecord(snapshot?.resources) ? snapshot.resources : {};
  const presetResource = firstRecord(resources.preset, snapshot?.selected);
  const presetId = selection.presetId ?? presetResource?.id ?? null;
  const characterResource = firstRecord(resources.characterCard, resources.character);
  const characterId = selection.characterCardId ?? selection.characterId ?? characterResource?.id ?? null;
  const userResource = firstRecord(resources.user, resources.userProfile, resources.persona);
  const userId = selection.userId ?? selection.userProfileId ?? selection.personaId ?? userResource?.id ?? null;
  const explicitWorldIds = selectionIds(firstArray(
    selection.worldBookIds,
    selection.worldBooks,
    selection.worldBookSelection?.ids
  ));
  const resolvedWorlds = firstArray(resources.worldBooks, resources.worldBook).filter(isRecord);
  const implicitlySelectedWorlds = resolvedWorlds.filter((resource) => resource.selected !== false);
  const worldIds = explicitWorldIds.length > 0 ? explicitWorldIds : implicitlySelectedWorlds.map((resource) => resource.id ?? resource.resourceId).filter((id) => id !== void 0 && id !== null);
  const worldCatalog = catalog(snapshot, "worldBooks", "worldBook", "lorebooks");
  const selectedWorlds = worldIds.map((id) => firstRecord(
    findResourceById(resolvedWorlds, id),
    findResourceById(worldCatalog, id),
    { id }
  ));
  for (const resource of implicitlySelectedWorlds) {
    const id = resource.id ?? resource.resourceId;
    if (id === void 0 || id === null || selectedWorlds.some((item) => String(item.id ?? item.resourceId) === String(id))) continue;
    selectedWorlds.push(resource);
  }
  const worldTitles = selectedWorlds.map((resource) => resourceTitle(resource, String(resource.id ?? resource.resourceId ?? "\u5DF2\u9009\u62E9")));
  return {
    preset: singleStatus({
      id: presetId,
      resource: presetResource,
      items: catalog(snapshot, "presets", "preset"),
      emptyTitle: "\u672A\u9009\u62E9\u9884\u8BBE"
    }),
    character: singleStatus({
      id: characterId,
      resource: characterResource,
      items: catalog(snapshot, "characters", "characterCards", "character"),
      emptyTitle: "\u672A\u7ED1\u5B9A\u89D2\u8272"
    }),
    "world-info": {
      bound: selectedWorlds.length > 0,
      count: selectedWorlds.length,
      title: selectedWorlds.length === 0 ? "\u672A\u7ED1\u5B9A\u4E16\u754C\u4E66" : selectedWorlds.length === 1 ? worldTitles[0] : worldTitles.join(" \xB7 ")
    },
    user: singleStatus({
      id: userId,
      resource: userResource,
      items: catalog(snapshot, "users", "userProfiles", "personas"),
      emptyTitle: "\u672A\u7ED1\u5B9A\u7528\u6237"
    }),
    "session-template": { bound: false, count: 0, title: "\u5F53\u524D\u8BBE\u7F6E\u6216\u914D\u7F6E\u6A21\u677F" },
    settings: { bound: false, count: 0, title: "\u8BED\u8A00\u4E0E\u7F29\u653E" }
  };
}
function clampLauncherAnchor(position, viewport2, scale = 1) {
  const width = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport2?.width) || TAVERN_LAUNCHER_SIZE);
  const height = Math.max(TAVERN_LAUNCHER_SIZE, Number(viewport2?.height) || TAVERN_LAUNCHER_SIZE);
  const launcherSize = TAVERN_LAUNCHER_SIZE * Math.max(0.1, Number(scale) || 1);
  const margin = 8;
  return {
    x: Math.min(width - launcherSize - margin, Math.max(margin, Number(position?.x) || margin)),
    y: Math.min(height - launcherSize - margin, Math.max(margin, Number(position?.y) || margin))
  };
}
function launcherPlacement(anchor, viewport2, expanded = false, scale = 1) {
  const factor = Math.max(0.1, Number(scale) || 1);
  const point = clampLauncherAnchor(anchor, viewport2, factor);
  const panelWidth = TAVERN_LAUNCHER_PANEL.width * factor;
  const panelHeight = TAVERN_LAUNCHER_PANEL.height * factor;
  const launcherSize = TAVERN_LAUNCHER_SIZE * factor;
  const opensLeft = point.x + panelWidth > viewport2.width - 8;
  const opensUp = point.y + panelHeight > viewport2.height - 8;
  return {
    side: opensLeft ? "left" : "right",
    vertical: opensUp ? "up" : "down",
    left: expanded && opensLeft ? point.x - panelWidth + launcherSize : point.x,
    top: expanded && opensUp ? point.y - panelHeight + launcherSize : point.y,
    anchor: point
  };
}

// packages/client/src/index.js
var h7 = createLocalizedElement(import_react7.createElement);
var API_ROOT6 = "/dsh-tavern/api";
var css6 = `
.dtv-layer{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:Inter,var(--dsw-font-family),sans-serif;color:var(--dsw-alias-label-primary)}
.dtv-launcher{position:absolute;z-index:2;width:44px;height:44px;pointer-events:auto;overflow:hidden;border:0 solid transparent;border-radius:22px;background:transparent;box-shadow:none;transition:width .22s ease,height .22s ease,border-radius .22s ease,background-color .18s ease,box-shadow .18s ease;display:block}
.dtv-launcher[data-open=true]{width:300px;height:376px;border-width:1px;border-color:var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 12px 34px rgba(0,0,0,.24))}
.dtv-ball-row{position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:flex-start;pointer-events:none}.dtv-launcher[data-side=left] .dtv-ball-row{justify-content:flex-end}.dtv-launcher[data-vertical=up] .dtv-ball-row{top:auto;bottom:0;align-items:flex-end}
.dtv-ball{pointer-events:auto;touch-action:none;user-select:none;width:44px;height:44px;flex:none;border:2px solid #fff;border-radius:50%;background:conic-gradient(from 225deg,#090909 0 56%,#b31319 56% 100%);box-shadow:0 0 0 2px #a50f16,0 6px 20px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.28);color:#fff;font-size:13px;letter-spacing:-.5px;font-weight:850;text-shadow:0 1px 2px #000;cursor:grab;transition:filter .15s ease,transform .18s ease,box-shadow .18s ease}.dtv-ball:hover{filter:brightness(1.1);box-shadow:0 0 0 2px #d5222b,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-ball:active{cursor:grabbing}.dtv-launcher[data-open=true] .dtv-ball{transform:scale(.82) rotate(-8deg)}
.dtv-menu{position:absolute;left:8px;right:8px;top:52px;bottom:8px;padding:1px;display:flex;flex-direction:column;gap:4px;opacity:0;transform:translateY(-6px);transition:opacity .13s ease .1s,transform .18s ease .08s}.dtv-launcher[data-open=true] .dtv-menu{opacity:1;transform:none}.dtv-launcher[data-vertical=up] .dtv-menu{top:8px;bottom:52px;transform:translateY(6px)}.dtv-launcher[data-open=true][data-vertical=up] .dtv-menu{transform:none}
.dtv-menu-title{padding:5px 8px 7px;font-size:11px;font-weight:650;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtv-menu-item{min-height:43px;border:0;border-radius:9px;padding:5px 8px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center}.dtv-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-menu-item[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-binding-dot{width:8px;height:8px;border-radius:50%;background:#d33239;box-shadow:0 0 0 1px rgba(98,0,4,.38)}.dtv-menu-item[data-bound=true] .dtv-binding-dot{background:#44d17a;box-shadow:0 0 5px #31c66b,0 0 10px rgba(49,198,107,.75)}.dtv-item-copy{min-width:0;display:flex;flex-direction:column;gap:1px}.dtv-item-label{font-size:11px;font-weight:700;line-height:1.2}.dtv-item-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1.25;color:var(--dsw-alias-label-tertiary)}.dtv-item-count{border-radius:10px;padding:2px 6px;background:var(--dsw-specific-tip);font-size:9px;color:var(--dsw-alias-label-secondary)}.dtv-item-planned{font-size:9px;color:var(--dsw-alias-label-tertiary)}
.dtv-menu-item[data-show-binding=false] .dtv-binding-dot{visibility:hidden}
.dtv-panel{position:absolute;z-index:1;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}
.dtv-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtv-title{font-size:14px;font-weight:650;flex:1}.dtv-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtv-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtv-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtv-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtv-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtv-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtv-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-button:disabled{opacity:.5;cursor:default}
.dtv-primary{background:var(--dsw-alias-button-primary-fill,#2677d9);border-color:transparent;color:var(--dsw-alias-button-primary-label,#fff)}.dtv-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--dsw-alias-button-primary-fill,#2677d9)}.dtv-template-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.dtv-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:7px}.dtv-resource-title{font-size:12px;font-weight:650}.dtv-resource-meta{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}.dtv-list{margin:0;padding-left:18px;font-size:11px;line-height:1.55}.dtv-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-specific-tip);padding:9px;display:flex;flex-direction:column;gap:6px}.dtv-preview-title{font-size:12px;font-weight:700}.dtv-preview-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;font-size:11px;line-height:1.45}.dtv-preview-label{color:var(--dsw-alias-label-tertiary)}.dtv-preview-value{overflow-wrap:anywhere}.dtv-preview-options{margin-left:120px;display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--dsw-alias-label-tertiary)}.dtv-preview-list{margin:0;padding-left:18px}.dtv-preview-row[data-missing=true] .dtv-preview-value,.dtv-preview-list>[data-missing=true]{color:var(--dsw-alias-state-error)}
.dtv-book-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.dtv-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);overflow:hidden}.dtv-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:11px}.dtv-entry>summary::-webkit-details-marker{display:none}.dtv-entry-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dtv-entry[data-enabled=true] .dtv-entry-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dtv-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtv-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px}.dtv-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dtv-field{display:flex;flex-direction:column;gap:4px}.dtv-label{font-size:10px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dtv-input,.dtv-select,.dtv-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:7px 8px}.dtv-input,.dtv-select{height:32px}.dtv-textarea{min-height:94px;resize:vertical;line-height:1.45}.dtv-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dtv-checks{display:flex;flex-wrap:wrap;gap:10px}.dtv-check{display:flex;gap:5px;align-items:center;font-size:10px}.dtv-entry-actions{display:flex;justify-content:flex-end}.dtv-danger{color:var(--dsw-alias-state-error)}
.dtv-layer>.dtv-launcher,.dtv-layer>.dtv-panel,.dtv-layer>.dcc-panel,.dtv-layer>.dwb-panel,.dtv-layer>.dtu-panel{zoom:var(--dtv-ui-scale,1)}.dtv-setting-value{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
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
async function activeView(sessionId) {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const response = await fetch(`${API_ROOT6}/active${query}`);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const message = typeof data?.error === "string" ? data.error : data?.error?.message;
    throw new Error(message ?? `HTTP ${response.status}`);
  }
  return data;
}
async function sessionConfigurationRequest(path, body2) {
  const response = await fetch(`${API_ROOT6}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body2)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error?.message ?? data?.error ?? `HTTP ${response.status}`);
    error.diagnostics = data?.error?.diagnostics ?? [];
    throw error;
  }
  return data;
}
async function uiSettingsRequest(method = "GET", body2) {
  const response = await fetch(`${API_ROOT6}/ui-settings`, {
    method,
    headers: method === "GET" ? void 0 : { "Content-Type": "application/json" },
    body: body2 === void 0 ? void 0 : JSON.stringify(body2)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data.settings;
}
function Field5({ label, children }) {
  return h7("label", { className: "dtv-field" }, h7("span", { className: "dtv-label" }, label), children);
}
function SettingsPanel({ settings, status, busy, close, update, reset }) {
  const percent = Math.round(settings.scale * 100);
  return h7(
    "div",
    { className: "dtv-panel" },
    h7(
      "div",
      { className: "dtv-header" },
      h7("div", { className: "dtv-title" }, translate("settings.title")),
      h7("button", { className: "dtv-close", type: "button", title: translate("settings.close"), "aria-label": translate("settings.close"), onClick: close }, "\u2715")
    ),
    h7(
      "div",
      { className: "dtv-body" },
      h7(Field5, { label: translate("settings.language") }, h7(
        "select",
        {
          className: "dtv-select",
          value: settings.locale,
          disabled: busy,
          onChange: (event) => update({ ...settings, locale: event.target.value })
        },
        h7("option", { value: "zh-CN" }, translate("settings.language.zh")),
        h7("option", { value: "en" }, translate("settings.language.en"))
      )),
      h7(Field5, { label: translate("settings.scale") }, h7("select", {
        className: "dtv-select",
        value: settings.scale,
        disabled: busy,
        onChange: (event) => update({ ...settings, scale: Number(event.target.value) })
      }, ...UI_SCALE_OPTIONS.map((scale) => h7("option", { key: scale, value: scale }, `${Math.round(scale * 100)}%`)))),
      h7("div", { className: "dtv-setting-value" }, translate("settings.currentScale", { scale: percent })),
      h7("p", { className: "dtv-note" }, translate("settings.scale.help")),
      h7("div", { className: "dtv-status", "data-error": status.error || void 0, role: "status" }, rawText(status.text)),
      h7(
        "div",
        { className: "dtv-actions" },
        h7("button", { className: "dtv-button", type: "button", disabled: busy, onClick: reset }, translate("settings.reset"))
      )
    )
  );
}
function TavernShell({ useSessions, useWorkspaces, createCleanSession }) {
  const [menuOpen, setMenuOpen] = (0, import_react7.useState)(false);
  const [surface, setSurface] = (0, import_react7.useState)(null);
  const [anchor, setAnchor] = (0, import_react7.useState)(initialLauncherAnchor);
  const [activeSnapshot, setActiveSnapshot] = (0, import_react7.useState)(null);
  const [statusError, setStatusError] = (0, import_react7.useState)("");
  const [uiSettings, setUiSettings] = (0, import_react7.useState)(getClientUiSettings);
  const [settingsStatus, setSettingsStatus] = (0, import_react7.useState)({ text: translate("settings.saved"), error: false });
  const [settingsBusy, setSettingsBusy] = (0, import_react7.useState)(false);
  const drag = (0, import_react7.useRef)(null);
  const suppressClick = (0, import_react7.useRef)(false);
  const statusGeneration = (0, import_react7.useRef)(0);
  const sessionId = useSessions((state) => state.current);
  const sessionBlank = useSessions((state) => state.current === void 0 || state.current === null ? true : state.byId?.[state.current]?.blank === true);
  const workspaceId = useWorkspaces((state) => workspaceTargetId(state, sessionId));
  const close = () => setSurface(null);
  (0, import_react7.useEffect)(() => {
    let active = true;
    uiSettingsRequest().then((next) => {
      if (!active) return;
      const normalized = setClientUiSettings(next);
      setUiSettings(normalized);
      setSettingsStatus({ text: translate("settings.saved"), error: false });
    }).catch((reason) => {
      if (!active) return;
      setSettingsStatus({ text: translate("settings.loadError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    });
    return () => {
      active = false;
    };
  }, []);
  const persistSettings = async (next) => {
    const previous = uiSettings;
    const normalized = setClientUiSettings(next);
    setUiSettings(normalized);
    setSettingsBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = setClientUiSettings(await uiSettingsRequest("PUT", normalized));
      setUiSettings(saved);
      setSettingsStatus({ text: translate("settings.saved"), error: false });
    } catch (reason) {
      setClientUiSettings(previous);
      setUiSettings(previous);
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setSettingsBusy(false);
    }
  };
  const resetSettings = async () => {
    const previous = uiSettings;
    const defaults = setClientUiSettings(DEFAULT_UI_SETTINGS);
    setUiSettings(defaults);
    setSettingsBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = setClientUiSettings(await uiSettingsRequest("DELETE"));
      setUiSettings(saved);
      setSettingsStatus({ text: translate("settings.saved"), error: false });
    } catch (reason) {
      setClientUiSettings(previous);
      setUiSettings(previous);
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setSettingsBusy(false);
    }
  };
  const refreshStatus = (0, import_react7.useCallback)(async () => {
    const generation = ++statusGeneration.current;
    try {
      const next = await activeView(sessionId);
      if (generation !== statusGeneration.current) return;
      setActiveSnapshot(next);
      setStatusError("");
    } catch (reason) {
      if (generation !== statusGeneration.current) return;
      setStatusError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [sessionId]);
  (0, import_react7.useEffect)(() => {
    statusGeneration.current += 1;
    setActiveSnapshot(null);
    setStatusError("");
    refreshStatus();
    return () => {
      statusGeneration.current += 1;
    };
  }, [refreshStatus, sessionId]);
  (0, import_react7.useEffect)(() => {
    const onRefresh = () => refreshStatus();
    window.addEventListener("dsh-tavern:refresh", onRefresh);
    return () => window.removeEventListener("dsh-tavern:refresh", onRefresh);
  }, [refreshStatus]);
  (0, import_react7.useEffect)(() => {
    const onResize = () => setAnchor((current2) => {
      const next = clampLauncherAnchor(current2, viewport(), uiSettings.scale);
      persistLauncherAnchor(next);
      return next;
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [uiSettings.scale]);
  (0, import_react7.useEffect)(() => {
    setAnchor((current2) => {
      const next = clampLauncherAnchor(current2, viewport(), uiSettings.scale);
      persistLauncherAnchor(next);
      return next;
    });
  }, [uiSettings.scale]);
  (0, import_react7.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (menuOpen) setMenuOpen(false);
      else if (surface !== null) setSurface(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, surface]);
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
    }, viewport(), uiSettings.scale);
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
    panel = h7("div", { className: "dtv-panel" }, h7(PresetSidebar, {
      closePanel: close,
      openPanel: () => {
      },
      sessionId,
      autoOpen: false
    }));
  } else if (surface === "character") {
    panel = h7(CharacterPanel, { sessionId, sessionBlank, close });
  } else if (surface === "world-info") {
    panel = h7(WorldBookPanel, { sessionId, close });
  } else if (surface === "user") {
    panel = h7(UserPanel, { sessionId, sessionBlank, close });
  } else if (surface === "session-template") {
    panel = h7(SessionTemplatePanel, { sessionId, workspaceId, createCleanSession, close });
  } else if (surface === "settings") {
    panel = h7(SettingsPanel, {
      settings: uiSettings,
      status: settingsStatus,
      busy: settingsBusy,
      close,
      update: persistSettings,
      reset: resetSettings
    });
  }
  const placement = launcherPlacement(anchor, viewport(), menuOpen, uiSettings.scale);
  const statuses = launcherResourceStatuses(activeSnapshot);
  return h7(
    "div",
    { className: "dtv-layer", lang: uiSettings.locale, "data-surface-open": surface !== null, style: { "--dtv-ui-scale": uiSettings.scale } },
    panel,
    h7(
      "div",
      {
        className: "dtv-launcher",
        "data-open": menuOpen,
        "data-side": placement.side,
        "data-vertical": placement.vertical,
        style: { left: placement.left / uiSettings.scale, top: placement.top / uiSettings.scale }
      },
      h7("div", { className: "dtv-ball-row" }, h7("button", {
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
      }, "DT")),
      menuOpen ? h7(
        "div",
        { className: "dtv-menu", role: "menu" },
        h7("div", { className: "dtv-menu-title", "aria-live": "polite" }, statusError === "" ? uiText`Tavern · ${sessionId || translateVisibleText("\u65E0\u4F1A\u8BDD")}` : uiText`状态同步失败：${statusError}`),
        ...TAVERN_MENU_ITEMS.map((item) => {
          const status = statuses[item.id] ?? { bound: false, count: 0, title: item.emptyTitle };
          const itemLabel = translateVisibleText(item.label);
          const statusTitle = status.bound ? status.title : translateVisibleText(status.title);
          const stateLabel = item.binding === false ? "" : translateVisibleText(status.bound ? "\u5DF2\u7ED1\u5B9A" : "\u672A\u7ED1\u5B9A");
          const titleText = stateLabel ? uiText`${itemLabel}：${statusTitle}（${stateLabel}）` : uiText`${itemLabel}：${statusTitle}`;
          const ariaText = stateLabel ? uiText`${itemLabel}，${statusTitle}，${stateLabel}` : uiText`${itemLabel}，${statusTitle}`;
          return h7(
            "button",
            {
              className: "dtv-menu-item",
              type: "button",
              role: "menuitem",
              key: item.id,
              title: titleText,
              "data-available": item.available,
              "data-active": surface === item.id,
              "data-bound": item.binding === false ? void 0 : status.bound,
              "data-show-binding": item.binding !== false && item.showBinding !== false,
              "aria-current": surface === item.id ? "page" : void 0,
              "aria-label": ariaText,
              onClick: () => open(item.id)
            },
            item.binding === false ? h7("span", { "aria-hidden": "true" }) : h7("span", { className: "dtv-binding-dot", "aria-hidden": "true" }),
            h7(
              "span",
              { className: "dtv-item-copy" },
              h7("span", { className: "dtv-item-label" }, item.label),
              h7("span", { className: "dtv-item-status" }, status.bound ? rawText(status.title) : status.title)
            ),
            status.count > 1 ? h7("span", { className: "dtv-item-count", "aria-label": uiText`${status.count} 本` }, uiText`${status.count} 本`) : item.available ? null : h7("span", { className: "dtv-item-planned" }, "\u89C4\u5212\u4E2D")
          );
        })
      ) : null
    )
  );
}
function installStyles() {
  if (document.querySelector('style[data-plugin-css="dsh-tavern-shell"]') !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = "dsh-tavern-shell";
  style.textContent = css6;
  document.head.append(style);
}
var name = "dsh-tavern";
var inject = ["slots", "layout", "sessions", "workspaces"];
function apply(ctx) {
  installPresetStyles();
  installCharacterStyles();
  installWorldBookStyles();
  installUserStyles();
  installTavernTraceStyles();
  installStyles();
  registerTavernTraceView(ctx);
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "dsh-tavern-launcher",
    order: 80,
    inject: () => ({
      createCleanSession: ({ workspaceId, source }) => createCleanSessionWorkflow({
        workspaceId,
        source,
        preview: (selectedSource) => sessionConfigurationRequest("/session-configurations/preview", { source: selectedSource }),
        connectWorkspace: (id) => ctx.workspaces.connectWorkspace(id),
        applySelection: (targetSessionId, selectedSource) => sessionConfigurationRequest("/session-configurations/apply", {
          targetSessionId,
          source: selectedSource
        }),
        openSession: (id) => ctx.sessions.open(id),
        refresh: () => window.dispatchEvent(new Event("dsh-tavern:refresh"))
      })
    })
  }, TavernShell));
}

		return module.exports;
	}
});
