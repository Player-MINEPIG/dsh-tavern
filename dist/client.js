window.__ModuleLoader__.load({
	id: "pmp-dsh-tavern",
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
  PanelHeader: () => PanelHeader,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react13 = require("react");

// packages/ui-settings/src/locale-contract.js
var DEFAULT_UI_LOCALE = "zh-CN";
var UI_LOCALES = Object.freeze([
  Object.freeze({ id: "zh-CN", nativeName: "\u7B80\u4F53\u4E2D\u6587" }),
  Object.freeze({ id: "en", nativeName: "English" })
]);
var SUPPORTED_UI_LOCALES = Object.freeze(UI_LOCALES.map((locale) => locale.id));
function isSupportedUiLocale(value) {
  return typeof value === "string" && SUPPORTED_UI_LOCALES.includes(value);
}

// packages/identity.js
var PLUGIN_ID = "pmp-dsh-tavern";
var API_ROOT = `/${PLUGIN_ID}/api`;
var API_V1 = `${API_ROOT}/v1`;
var API_V2 = `${API_ROOT}/v2`;
var LEGACY_API_ROOT = "/dsh-tavern/api";
var PROFILE_SECTION = `${PLUGIN_ID}:profile`;
var CLIENT_REFRESH_EVENT = `${PLUGIN_ID}:refresh`;
var CLIENT_UI_SETTINGS_EVENT = `${PLUGIN_ID}:ui-settings`;
var identityConstants = Object.freeze({
  pluginId: PLUGIN_ID,
  apiRoot: API_ROOT,
  apiV1: API_V1,
  apiV2: API_V2,
  legacyApiRoot: LEGACY_API_ROOT,
  profileSection: PROFILE_SECTION,
  clientRefreshEvent: CLIENT_REFRESH_EVENT,
  clientUiSettingsEvent: CLIENT_UI_SETTINGS_EVENT
});

// packages/client/src/i18n/catalogs/zh-CN.js
var zh_CN_default = Object.freeze({
  "common.unavailable": "\u754C\u9762\u6587\u672C\u6682\u4E0D\u53EF\u7528",
  "common.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "common.none": "\u65E0",
  "common.unknown": "\u672A\u77E5",
  "common.unknownAuthor": "\u672A\u77E5\u4F5C\u8005",
  "common.refresh": "\u5237\u65B0",
  "common.delete": "\u5220\u9664",
  "common.save": "\u4FDD\u5B58",
  "common.saveChanges": "\u4FDD\u5B58\u4FEE\u6539",
  "common.saved": "\u5DF2\u4FDD\u5B58",
  "common.reload": "\u91CD\u65B0\u8F7D\u5165",
  "common.working": "\u5904\u7406\u4E2D\u2026",
  "common.enabled": "\u5DF2\u542F\u7528",
  "common.disabled": "\u5DF2\u7981\u7528",
  "common.bound": "\u5DF2\u7ED1\u5B9A",
  "common.unbound": "\u672A\u7ED1\u5B9A",
  "common.planned": "\u89C4\u5212\u4E2D",
  "common.listSeparator": "\u3001",
  "common.name": "\u540D\u79F0",
  "common.role": "\u89D2\u8272",
  "common.content": "\u5185\u5BB9",
  "common.exportJson": "\u5BFC\u51FA JSON",
  "common.importJson": "\u5BFC\u5165 JSON",
  "common.enable": "\u542F\u7528",
  "panel.close": "\u5173\u95ED{title}\u4FA7\u8FB9\u680F",
  "nav.preset": "\u9884\u8BBE",
  "nav.character": "\u89D2\u8272\u5361",
  "nav.worldBook": "\u4E16\u754C\u4E66",
  "nav.user": "\u7528\u6237",
  "nav.sessionTemplate": "\u65B0\u4F1A\u8BDD",
  "nav.settings": "\u754C\u9762\u8BBE\u7F6E",
  "nav.preset.empty": "\u672A\u9009\u62E9\u9884\u8BBE",
  "nav.character.empty": "\u672A\u7ED1\u5B9A\u89D2\u8272",
  "nav.worldBook.empty": "\u672A\u7ED1\u5B9A\u4E16\u754C\u4E66",
  "nav.user.empty": "\u672A\u7ED1\u5B9A\u7528\u6237",
  "nav.sessionTemplate.empty": "\u5F53\u524D\u8BBE\u7F6E\u6216\u914D\u7F6E\u6A21\u677F",
  "nav.settings.empty": "\u8BED\u8A00\u3001\u7F29\u653E\u3001RP \u8DDF\u968F\u4E0E RP \u63D0\u793A\u8BCD",
  "nav.regex": "\u663E\u793A\u6B63\u5219",
  "nav.regex.empty": "\u4EC5\u7528\u4E8E\u9B54\u4E38\u663E\u793A\u7684\u89C4\u5219",
  "regex.title": "\u663E\u793A\u6B63\u5219",
  "regex.displayOnlyNote": "\u8FD9\u4E9B\u89C4\u5219\u53EA\u6539\u53D8\u9B54\u4E38\u6E32\u67D3\u548C\u9759\u6001 HTML\uFF0C\u4E0D\u4F1A\u6539\u5199\u5386\u53F2\u3001\u65F6\u95F4\u7EBF\u6570\u636E\u6216\u53D1\u9001\u7ED9 AI \u7684\u8BF7\u6C42\u3002\u5BFC\u5165\u89C4\u5219\u7684\u5F00\u5173\u6309\u539F\u6837\u4FDD\u7559\u3002",
  "regex.scopes": "\u6B63\u5219\u4F5C\u7528\u57DF",
  "regex.scope.global": "\u5168\u5C40",
  "regex.scope.preset": "\u9884\u8BBE",
  "regex.scope.character": "\u89D2\u8272\u5361",
  "regex.noPreset": "\u5F53\u524D\u672A\u9009\u62E9\u9884\u8BBE\uFF1B\u9884\u8BBE\u4F5C\u7528\u57DF\u7684\u65B0\u89C4\u5219\u9700\u8981\u586B\u5199\u8D44\u6E90 ID \u540E\u624D\u80FD\u5339\u914D\u3002",
  "regex.noCharacter": "\u5F53\u524D\u672A\u7ED1\u5B9A\u89D2\u8272\u5361\uFF1B\u89D2\u8272\u5361\u4F5C\u7528\u57DF\u7684\u65B0\u89C4\u5219\u9700\u8981\u586B\u5199\u8D44\u6E90 ID \u540E\u624D\u80FD\u5339\u914D\u3002",
  "regex.add": "\u65B0\u5EFA\u89C4\u5219",
  "regex.emptyScope": "\u6B64\u4F5C\u7528\u57DF\u6682\u65E0\u89C4\u5219\u3002",
  "regex.enabled": "\u4F7F\u7528\u6B64\u89C4\u5219",
  "regex.name": "\u89C4\u5219\u540D\u79F0",
  "regex.unnamed": "\u672A\u547D\u540D\u89C4\u5219",
  "regex.newRule": "\u65B0\u6B63\u5219",
  "regex.find": "\u67E5\u627E\u8868\u8FBE\u5F0F",
  "regex.replace": "\u66FF\u6362\u5185\u5BB9",
  "regex.flags": "\u6807\u5FD7",
  "regex.target": "\u6E32\u67D3\u6D88\u606F",
  "regex.target.assistant": "\u52A9\u624B",
  "regex.target.user": "\u7528\u6237",
  "regex.target.both": "\u4E24\u8005",
  "regex.scope": "\u4F5C\u7528\u57DF",
  "regex.resourceId": "\u8D44\u6E90 ID",
  "regex.loaded": "\u5DF2\u52A0\u8F7D {count} \u6761\u6B63\u5219",
  "regex.saved": "\u5DF2\u4FDD\u5B58 {count} \u6761\u6B63\u5219",
  "regex.imported": "\u5DF2\u5BFC\u5165\u5E76\u4FDD\u5B58 {count} \u6761\u6B63\u5219",
  "regex.confirmReload": "\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u6B63\u5219\u4FEE\u6539\u5E76\u91CD\u65B0\u8F7D\u5165\uFF1F",
  "regex.confirmClose": "\u5173\u95ED\u5E76\u653E\u5F03\u672A\u4FDD\u5B58\u7684\u6B63\u5219\u4FEE\u6539\uFF1F",
  "nav.session.none": "\u65E0\u4F1A\u8BDD",
  "nav.syncFailed": "\u72B6\u6001\u540C\u6B65\u5931\u8D25\uFF1A{message}",
  "nav.menuTitle": "Tavern \xB7 {session}",
  "nav.itemTitleBound": "{label}\uFF1A{title}\uFF08{state}\uFF09",
  "nav.itemTitle": "{label}\uFF1A{title}",
  "nav.itemAriaBound": "{label}\uFF0C{title}\uFF0C{state}",
  "nav.itemAria": "{label}\uFF0C{title}",
  "nav.bookCount": "{count} \u672C",
  "nav.launcher": "\u62D6\u52A8\u53EF\u79FB\u52A8\uFF1B\u5DE6\u952E\u5C55\u5F00\u9762\u677F\uFF1B\u53F3\u952E\u5207\u6362\u524D\u7AEF\u663E\u793A\u6A21\u5F0F",
  "chrome.switchToPlay": "\u5207\u6362\u5230\u81EA\u5B9A\u4E49\u524D\u7AEF\u6A21\u5F0F",
  "chrome.switchToNative": "\u5207\u6362\u5230 DSH \u539F\u751F\u6A21\u5F0F",
  "chrome.currentPlay": "\u5F53\u524D\uFF1A\u9B54\u4E38",
  "chrome.currentNative": "\u5F53\u524D\uFF1ADSH \u539F\u751F",
  "play.sidebar.loading": "\u6B63\u5728\u8BFB\u53D6\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\u2026",
  "play.sidebar.workspaceMissing": "\u5C1A\u672A\u9009\u62E9\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\uFF1B\u7075\u73E0\u6A21\u5F0F\u4E2D\u7684\u539F\u751F\u4F1A\u8BDD\u4ECD\u53EF\u6B63\u5E38\u4F7F\u7528\u3002",
  "play.sidebar.selectWorkspace": "\u5C06 {name} \u8BBE\u4E3A\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A",
  "play.sidebar.systemWorkspaceConfirm": "{path} \u4F4D\u4E8E\u7CFB\u7EDF\u76D8\uFF0C\u4ECD\u8981\u5C06\u5176\u8BBE\u4E3A\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\u5417\uFF1F",
  "play.sidebar.newPlaythrough": "\u4E0E {name} \u65B0\u5F00\u5468\u76EE",
  "play.sidebar.noCharacters": "\u6682\u65E0\u89D2\u8272\u5361\u3002",
  "play.sidebar.noPlaythroughs": "\u5C1A\u672A\u521B\u5EFA\u5468\u76EE\u3002",
  "play.sidebar.unassigned": "\u672A\u5F52\u5165\u5468\u76EE",
  "play.sidebar.other": "\u666E\u901A / \u975E\u89D2\u8272\u626E\u6F14\u4F1A\u8BDD",
  "play.sidebar.otherEmpty": "\u6682\u65E0\u666E\u901A\u6216\u5916\u90E8\u4F1A\u8BDD\u3002",
  "play.notice.unbound": "\u672C\u4F1A\u8BDD\u6682\u672A\u7ED1\u5B9A\u89D2\u8272\u5361\uFF1B\u53EF\u4EE5\u6B63\u5E38\u5BF9\u8BDD\u3002\u7ED1\u5B9A\u89D2\u8272\u5361\u540E\u65B0\u5F00\u5468\u76EE\uFF0C\u624D\u4F1A\u542F\u7528\u5F00\u573A\u767D\u3001\u56DE\u590D\u5207\u6362\u3001\u663E\u793A\u7F16\u8F91\u4E0E\u5468\u76EE\u5BFC\u5165/\u5BFC\u51FA\u3002",
  "play.sidebar.sessionMissing": "\u8BE5\u5468\u76EE\u5728\u89D2\u8272\u626E\u6F14\u5DE5\u4F5C\u533A\u4E2D\u6CA1\u6709\u53EF\u7528\u4F1A\u8BDD\u3002",
  "play.sidebar.timelineErrors": "\u6709 {count} \u4E2A\u5468\u76EE\u7684 timeline \u65E0\u6CD5\u8BFB\u53D6\u3002",
  "play.chat.label": "\u5BF9\u8BDD",
  "play.chat.loading": "\u6B63\u5728\u8BFB\u53D6\u672C\u5468\u76EE\u8BB0\u5F55\u2026",
  "play.chat.empty": "\u672C\u5468\u76EE\u5C1A\u65E0\u5BF9\u8BDD\uFF0C\u8BF7\u5728\u4E0B\u65B9\u5F00\u59CB\u3002",
  "play.chat.previousGreeting": "\u4E0A\u4E00\u6761\u5F00\u573A\u767D",
  "play.chat.nextGreeting": "\u4E0B\u4E00\u6761\u5F00\u573A\u767D",
  "play.chat.hiddenNode": "\u8FD9\u4E00\u7EC4\u95EE\u7B54\u5DF2\u5728\u9B54\u4E38\u663E\u793A\u4E2D\u9690\u85CF\u3002",
  "play.chat.runningDisabled": "Agent \u8FD0\u884C\u4E2D\u4E0D\u53EF\u64CD\u4F5C",
  "play.chat.copy": "\u590D\u5236\u5F53\u524D\u663E\u793A\u56DE\u590D",
  "play.chat.copyUnavailable": "\u5F53\u524D\u73AF\u5883\u65E0\u6CD5\u8BBF\u95EE\u526A\u8D34\u677F\u3002",
  "play.chat.previousReply": "\u4E0A\u4E00\u6761\u5DF2\u6709\u56DE\u590D",
  "play.chat.nextReply": "\u4E0B\u4E00\u6761\u5DF2\u6709\u56DE\u590D",
  "play.chat.noOtherReply": "\u6CA1\u6709\u5176\u4ED6\u5DF2\u6709\u56DE\u590D",
  "play.chat.generateReply": "\u751F\u6210\u4E00\u6761\u65B0\u56DE\u590D",
  "play.chat.editDisplay": "\u4FEE\u6539\u663E\u793A\u6587\u5B57",
  "play.chat.editDisplayPrompt": "\u8F93\u5165\u66FF\u4EE3\u539F\u56DE\u590D\u7684\u663E\u793A\u6587\u5B57\uFF1A",
  "play.chat.restoreOriginal": "\u6062\u590D\u539F\u56DE\u590D",
  "play.chat.hideNode": "\u4ECE\u9B54\u4E38\u663E\u793A\u4E2D\u9690\u85CF\u672C\u7EC4\u95EE\u7B54",
  "play.chat.hideConfirm": "\u8981\u4ECE\u9B54\u4E38\u663E\u793A\u4E2D\u9690\u85CF\u672C\u7EC4\u95EE\u7B54\u5417\uFF1F\u539F\u59CB DSH \u6D88\u606F\u4E0D\u4F1A\u88AB\u5220\u9664\u3002",
  "play.chat.restoreNode": "\u6062\u590D\u663E\u793A\u672C\u7EC4\u95EE\u7B54",
  "play.io.menu": "\u5468\u76EE\u5BFC\u5165 / \u5BFC\u51FA",
  "play.io.exportHtml": "\u5BFC\u51FA\u9759\u6001 HTML",
  "play.io.exportSt": "\u5BFC\u51FA SillyTavern JSONL",
  "play.io.exportBundle": "\u5BFC\u51FA portable bundle",
  "play.io.import": "\u5BFC\u5165\u5E76\u65B0\u5F00 session",
  "play.io.importUnavailable": "\u540E\u7AEF\u5C1A\u672A\u63D0\u4F9B\u907F\u514D\u4F2A\u9020 DSH \u5386\u53F2\u6240\u9700\u7684\u4E00\u6B21\u6027 import-context reference\uFF0C\u56E0\u6B64\u6682\u4E0D\u5F00\u653E\u5BFC\u5165\u3002",
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
  "settings.rpFollow": "\u7ED1\u5B9A\u89D2\u8272\u5361\u65F6\u81EA\u52A8\u8FDB\u5165 RP \u6A21\u5F0F",
  "settings.rpFollow.help": "\u5F00\u542F\u540E\uFF0C\u7ED1\u5B9A\u89D2\u8272\u5361\u4F1A\u8FDB\u5165\u89D2\u8272\u626E\u6F14\u5E76\u628A\u6587\u4EF6\u6C99\u7BB1\u9489\u5728\u53EA\u8BFB\u3002\u5199\u5165\u3001\u7EC8\u7AEF\u3001\u5916\u8FDE\u548C\u5DE5\u4F5C\u533A\u5916\u6216\u673A\u5BC6\u6587\u4EF6\u8BFB\u53D6\u4F1A\u88AB\u62E6\u4F4F\u5E76\u4E2D\u65AD\u8BE5 agent\uFF1B\u5B50 agent \u53EF\u4EE5\u6D3E\uFF0C\u4F46\u540C\u6837\u53D7\u9650\u5236\u3002\u804A\u5929\u680F\u6539\u6743\u9650\u65E0\u6548\u3002\u8981\u505A\u8FD9\u4E9B\u4E8B\u5FC5\u987B\u5148\u5173\u6389 RP\uFF08\u6216 /rp off\uFF09\u3002",
  "settings.rpPolicy": "RP \u6A21\u5F0F\u63D0\u793A\u8BCD\uFF08rp:policy\uFF09",
  "settings.rpPolicy.help": "\u53EF\u9009\u3002DSH \u4E0D\u80FD\u6309\u6BB5\u52A0\u6743\uFF0C\u8EAB\u4EFD\u548C\u6587\u98CE\u5E94\u5199\u5728\u9884\u8BBE\u6216\u89D2\u8272\u5361\u91CC\u3002\u9ED8\u8BA4\u53EA\u8BF4\u660E\u9AD8\u98CE\u9669\u64CD\u4F5C\u88AB\u9501\u5B9A\u3002\u7559\u7A7A\u5219\u4E0D\u9644\u52A0\u8FD9\u6BB5\u63D0\u793A\uFF0C\u9501\u5B9A\u4ECD\u7136\u6709\u6548\u3002\u5E95\u90E8\u7684\u300C\u6062\u590D\u9ED8\u8BA4\u300D\u53EA\u91CD\u7F6E\u8BED\u8A00\u3001\u7F29\u653E\u548C\u7ED1\u5361\u8DDF\u968F\u3002",
  "settings.rpPolicy.placeholder": "\u7559\u7A7A\uFF1A\u53EA\u542F\u7528\u53EA\u8BFB\u6C99\u7BB1\uFF0C\u4E0D\u9644\u52A0 RP \u63D0\u793A\u8BCD",
  "settings.rpPolicy.save": "\u4FDD\u5B58 RP \u63D0\u793A\u8BCD",
  "settings.rpPolicy.reset": "\u6062\u590D\u9ED8\u8BA4 RP \u63D0\u793A\u8BCD",
  "settings.rpPolicy.saved": "RP \u63D0\u793A\u8BCD\u5DF2\u4FDD\u5B58\uFF0C\u4E0B\u4E00\u8F6E\u8BF7\u6C42\u751F\u6548\u3002",
  "rp.block.body": "Agent \u6B63\u5728\u8FDB\u884C\u5199\u5165\u7B49\u9AD8\u98CE\u9669\u64CD\u4F5C\u3002\u5982\u679C\u4F60\u77E5\u9053\u4F60\u5728\u505A\u4EC0\u4E48\uFF0C\u8BF7\u5173\u95ED RP \u6A21\u5F0F\u540E\u91CD\u8BD5\u3002",
  "rp.block.dismiss": "\u77E5\u9053\u4E86",
  "preset.title": "Tavern \u9884\u8BBE",
  "preset.active": "\u25CF \u5DF2\u542F\u7528",
  "preset.importStJson": "\u5BFC\u5165 ST JSON",
  "preset.create": "\u521B\u5EFA\u9884\u8BBE",
  "preset.browse": "\u6D4F\u89C8\u9884\u8BBE",
  "preset.libraryEmpty": "\u9884\u8BBE\u5E93\u4E3A\u7A7A",
  "preset.unboundNote": "\u5F53\u524D\u4F1A\u8BDD\u672A\u7ED1\u5B9A\u9884\u8BBE\u3002",
  "preset.currentSessionBound": "\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A\uFF1A{name}\u3002",
  "preset.browsingUnbound": "\u6B63\u5728\u6D4F\u89C8\u201C{name}\u201D\uFF1B\u5B83\u5C1A\u672A\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD\u3002",
  "preset.bind": "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD",
  "preset.bindUpdate": "\u66F4\u65B0\u4F1A\u8BDD\u7ED1\u5B9A",
  "preset.unbind": "\u89E3\u9664\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A",
  "preset.loading": "\u6B63\u5728\u52A0\u8F7D\u9884\u8BBE\u2026",
  "preset.emptyHint": "\u8BF7\u9009\u62E9\u6216\u521B\u5EFA\u9884\u8BBE\u4EE5\u5F00\u59CB\u914D\u7F6E\u3002",
  "preset.basicSettings": "\u57FA\u672C\u8BBE\u7F6E",
  "preset.name": "\u9884\u8BBE\u540D\u79F0",
  "preset.temperature": "Temperature",
  "preset.maxTokens": "Max tokens",
  "preset.reasoningEffort": "Reasoning effort",
  "preset.modelDefault": "\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4",
  "preset.effort.low": "Low",
  "preset.effort.medium": "Medium",
  "preset.effort.high": "High",
  "preset.effort.xhigh": "Extra high",
  "preset.advancedShow": "\u5C55\u5F00\u9AD8\u7EA7\u8BBE\u7F6E",
  "preset.advancedHide": "\u6536\u8D77\u9AD8\u7EA7\u8BBE\u7F6E",
  "preset.advancedNote": "\u8FD9\u4E9B\u5B57\u6BB5\u4F1A\u88AB\u5B8C\u6574\u4FDD\u5B58\uFF1Bdsh 0.1.0 \u5F53\u524D\u8BF7\u6C42\u534F\u8BAE\u672A\u66B4\u9732\u7684\u53C2\u6570\u4E0D\u4F1A\u5F3A\u884C\u4E0B\u53D1\u7ED9\u9002\u914D\u5668\u3002",
  "preset.systemPrompt": "DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD",
  "preset.systemAppend": "\u4FDD\u7559 DSH \u7CFB\u7EDF\u63D0\u793A\u8BCD\uFF0C\u5E76\u8FFD\u52A0\u9884\u8BBE\uFF08\u63A8\u8350\uFF09",
  "preset.systemReplace": "\u4EC5\u4F7F\u7528\u9884\u8BBE\uFF0C\u79FB\u9664 DSH \u7CFB\u7EDF\u6BB5\uFF08\u9AD8\u7EA7\uFF09",
  "preset.replaceWarning": "\u8B66\u544A\uFF1A\u8FD9\u4F1A\u79FB\u9664\u6A21\u578B\u53EF\u89C1\u7684 Harness \u8EAB\u4EFD\u3001Agent persona \u548C\u5DE5\u5177\u8BF4\u660E\uFF0C\u53EF\u80FD\u7834\u574F\u5DE5\u5177\u8C03\u7528\u6216\u7ED3\u6784\u5316\u8F93\u51FA\uFF1B\u6C99\u7BB1\u4E0E\u5BA1\u6279\u7B49\u6267\u884C\u5C42\u5B89\u5168\u4ECD\u7136\u6709\u6548\u3002",
  "preset.prompts": "\u63D0\u793A\u8BCD ({count})",
  "preset.addPrompt": "\uFF0B \u6DFB\u52A0",
  "preset.dropHere": "\u677E\u5F00\u540E\u653E\u7F6E\u4E8E\u6B64",
  "preset.dragOrder": "\u62D6\u62FD\u6392\u5217\u987A\u5E8F",
  "preset.dragNamed": "\u62D6\u62FD\u201C{name}\u201D\u6392\u5217\u987A\u5E8F",
  "preset.markerHint": "ST marker \u4E0D\u4F1A\u4F5C\u4E3A\u72EC\u7ACB\u63D0\u793A\u8BCD\u6CE8\u5165",
  "preset.enablePrompt": "\u542F\u7528\u63D0\u793A\u8BCD",
  "preset.role.system": "System",
  "preset.role.user": "User",
  "preset.role.assistant": "Assistant",
  "preset.sampling.topP": "Top P",
  "preset.sampling.topK": "Top K",
  "preset.sampling.topA": "Top A",
  "preset.sampling.minP": "Min P",
  "preset.sampling.frequencyPenalty": "Frequency penalty",
  "preset.sampling.presencePenalty": "Presence penalty",
  "preset.sampling.repetitionPenalty": "Repetition penalty",
  "preset.sampling.seed": "Seed",
  "preset.defaultName": "\u65B0\u9884\u8BBE",
  "preset.defaultPromptName": "\u65B0\u63D0\u793A\u8BCD",
  "preset.confirmDelete": "\u5220\u9664\u9884\u8BBE\u201C{name}\u201D\uFF1F",
  "preset.confirmHistoricalSwitch": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u66F4\u6362\u9884\u8BBE\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F",
  "preset.status.syncing": "\u6B63\u5728\u540C\u6B65\u5F53\u524D\u4F1A\u8BDD\u7684\u9884\u8BBE\u72B6\u6001\u2026",
  "preset.status.loaded": "\u9884\u8BBE\u5DF2\u52A0\u8F7D",
  "preset.status.refreshed": "\u9884\u8BBE\u72B6\u6001\u5DF2\u5237\u65B0",
  "preset.status.detailsLoaded": "\u9884\u8BBE\u8BE6\u60C5\u5DF2\u52A0\u8F7D\uFF1B\u4F1A\u8BDD\u7ED1\u5B9A\u5C1A\u672A\u6539\u53D8",
  "preset.status.bound": "\u9884\u8BBE\u5DF2\u7ED1\u5B9A\uFF1B\u5F53\u524D\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u5C06\u4F7F\u7528\u5B83",
  "preset.status.unbound": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u9884\u8BBE\u7ED1\u5B9A",
  "preset.status.created": "\u9884\u8BBE\u5DF2\u521B\u5EFA\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "preset.status.imported": "ST \u9884\u8BBE\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "preset.status.saved": "\u9884\u8BBE\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u5B83\u7684\u4F1A\u8BDD\u5C06\u5728\u540E\u7EED\u8BF7\u6C42\u4F7F\u7528\u65B0\u5185\u5BB9",
  "preset.status.deleted": "\u9884\u8BBE\u5DF2\u5220\u9664",
  "preset.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u9884\u8BBE",
  "preset.error.needPreset": "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u9884\u8BBE",
  "preset.error.noSessionToUnbind": "\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u9664\u7ED1\u5B9A\u7684\u4F1A\u8BDD",
  "character.title": "Tavern \u89D2\u8272\u5361",
  "character.import": "\u5BFC\u5165 JSON / PNG",
  "character.create": "\u65B0\u5EFA\u89D2\u8272\u5361",
  "character.defaultName": "\u65B0\u89D2\u8272",
  "character.browse": "\u6D4F\u89C8\u89D2\u8272\u5E93",
  "character.libraryEmpty": "\u89D2\u8272\u5E93\u4E3A\u7A7A",
  "character.sessionBinding": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\uFF1B\u7ED1\u5B9A\uFF1A{name}",
  "character.loading": "\u6B63\u5728\u52A0\u8F7D\u89D2\u8272\u5E93\u2026",
  "character.emptyHint": "\u65B0\u5EFA\u4E00\u5F20\u7A7A\u767D\u89D2\u8272\u5361\uFF0C\u6216\u5BFC\u5165\u5408\u6210/\u81EA\u6709\u6388\u6743\u7684 SillyTavern \u89D2\u8272\u5361\u3002",
  "character.imageAlt": "{name} \u89D2\u8272\u5361\u56FE\u7247",
  "character.greeting": "\u5F00\u573A\u53C2\u8003",
  "character.greeting.default": "\u9ED8\u8BA4\u5F00\u573A",
  "character.greeting.defaultEmpty": "\u9ED8\u8BA4\u5F00\u573A\uFF08\u7A7A\uFF09",
  "character.greeting.alternate": "\u5907\u9009\u5F00\u573A {index}",
  "character.preferSystem": "\u5141\u8BB8 loader \u4F18\u5148\u91C7\u7528\u5361\u5185 system_prompt",
  "character.preferPostHistory": "\u5141\u8BB8 loader \u91C7\u7528 post_history_instructions\uFF08\u5B9E\u9645\u4F4D\u7F6E\u7531 loader \u51B3\u5B9A\uFF09",
  "character.bind": "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD",
  "character.bindUpdate": "\u66F4\u65B0\u4F1A\u8BDD\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "character.bindingUnsaved": "\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u5F53\u524D\u5F00\u573A\u9009\u62E9\u5C1A\u672A\u5E94\u7528\u5230\u4F1A\u8BDD\u3002",
  "character.bindingApplied": "\u9762\u677F\u663E\u793A\u7684\u5F00\u573A\u9009\u62E9\u5DF2\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD\u3002",
  "character.bindingAppliedButton": "\u5F53\u524D\u7ED1\u5B9A\u5DF2\u5E94\u7528",
  "character.unbind": "\u89E3\u9664\u7ED1\u5B9A",
  "character.rpMode": "RP \u6A21\u5F0F\uFF08\u9AD8\u98CE\u9669\u9501\u5B9A\uFF09",
  "character.rpMode.help": "\u5F00\u542F\u540E\u6587\u4EF6\u6C99\u7BB1\u9489\u5728\u53EA\u8BFB\uFF1B\u5199\u5165\u3001\u7EC8\u7AEF\u3001\u5916\u8FDE\u548C\u5DE5\u4F5C\u533A\u5916\u6216\u673A\u5BC6\u6587\u4EF6\u8BFB\u53D6\u4F1A\u62D2\u7EDD\u5E76\u4E2D\u65AD\u8BE5 agent\u3002\u5B50 agent \u53EF\u4EE5\u6D3E\uFF0C\u5B69\u5B50\u540C\u6837\u53D7\u9650\u5236\u3002\u5173\u6389\u672C\u5F00\u5173\u6216 /rp off \u540E\u624D\u80FD\u505A\u8FD9\u4E9B\u4E8B\u3002",
  "character.status.rpUpdated": "RP \u6A21\u5F0F\u5DF2\u66F4\u65B0",
  "character.moduleNote": "\u89D2\u8272\u5361\u6A21\u5757\u8D1F\u8D23\u4FDD\u5B58\u6807\u51C6\u5316\u8D44\u6E90\u548C\u4F1A\u8BDD\u9009\u62E9\uFF1B\u5B9E\u9645 system profile \u4E0E\u5185\u5D4C\u4E16\u754C\u4FE1\u606F\u5339\u914D\u7531 Tavern loader \u5728\u6BCF\u6B21\u8BF7\u6C42\u65F6\u7EDF\u4E00\u5904\u7406\uFF0C\u4E0D\u4F1A\u4F2A\u9020 assistant \u5386\u53F2\u3002",
  "character.field.creatorNotes": "Creator notes",
  "character.field.description": "Description",
  "character.field.personality": "Personality",
  "character.field.scenario": "Scenario",
  "character.field.greetingContent": "\u5F53\u524D\u5F00\u573A\u53C2\u8003\u5185\u5BB9",
  "character.field.messageExamples": "Message examples",
  "character.field.systemPrompt": "System prompt\uFF08\u7531 loader \u6309\u7ED1\u5B9A\u8BBE\u7F6E\u5904\u7406\uFF09",
  "character.field.postHistory": "Post-history instructions\uFF08\u7531 loader \u8FD1\u4F3C\u653E\u7F6E\uFF09",
  "character.embeddedBook": "\u5185\u5D4C character_book \u5DF2\u65E0\u635F\u4FDD\u7559\uFF08{count} \u6761\uFF09\uFF1B\u7ED1\u5B9A\u89D2\u8272\u540E\u7531 Tavern loader \u8C03\u7528\u4E16\u754C\u4FE1\u606F matcher\uFF0C\u89E3\u7ED1\u540E\u4E0D\u518D\u53C2\u4E0E\u540E\u7EED\u8BF7\u6C42\u3002",
  "character.warnings": "\u517C\u5BB9\u8B66\u544A ({count})",
  "character.unsupported": "\u9700\u8981 loader/\u5176\u4ED6\u6A21\u5757\u5904\u7406 ({count})",
  "character.unknownMacros": "\u672A\u77E5\u5B8F\uFF1A{names}",
  "character.exportPng": "\u5BFC\u51FA PNG",
  "character.saveResource": "\u4FDD\u5B58\u5B57\u6BB5\uFF08\u672A\u4FDD\u5B58\uFF09",
  "character.resourceSaved": "\u5B57\u6BB5\u5DF2\u4FDD\u5B58",
  "character.saveFirst": "\u8BF7\u5148\u4FDD\u5B58\u4FEE\u6539",
  "character.dirty": "\u5F53\u524D\u89D2\u8272\u5361\u5B57\u6BB5\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002",
  "character.savedNote": "\u5F53\u524D\u663E\u793A\u7684\u89D2\u8272\u5361\u5B57\u6BB5\u5747\u5DF2\u4FDD\u5B58\u3002",
  "character.field.nickname": "\u6635\u79F0",
  "character.field.creator": "\u4F5C\u8005",
  "character.field.characterVersion": "\u89D2\u8272\u7248\u672C",
  "character.field.tags": "\u6807\u7B7E",
  "character.tagsPlaceholder": "\u6807\u7B7E\u4E00, \u6807\u7B7E\u4E8C",
  "character.field.firstMessage": "\u9ED8\u8BA4\u5F00\u573A",
  "character.alternateGreetings": "\u5907\u9009\u5F00\u573A",
  "character.addGreeting": "\u6DFB\u52A0\u5907\u9009\u5F00\u573A",
  "character.delete": "\u5220\u9664\u89D2\u8272\u5361",
  "character.confirmDelete": "\u5220\u9664\u89D2\u8272\u5361\u201C{name}\u201D\uFF1F",
  "character.confirmHistoricalSwitch": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u66F4\u6362\u89D2\u8272\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F",
  "character.confirmCloseDirty": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5173\u95ED\u5417\uFF1F",
  "character.confirmDiscardForSwitch": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5207\u6362\u5417\uFF1F",
  "character.confirmDiscardRefresh": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5237\u65B0\u5417\uFF1F",
  "character.confirmDiscardForCreate": "\u5F53\u524D\u89D2\u8272\u5361\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u65B0\u5EFA\u89D2\u8272\u5361\u5417\uFF1F",
  "character.status.loaded": "\u89D2\u8272\u5E93\u5DF2\u52A0\u8F7D",
  "character.status.refreshed": "\u89D2\u8272\u72B6\u6001\u5DF2\u5237\u65B0",
  "character.status.libraryRefreshed": "\u89D2\u8272\u5E93\u5DF2\u5237\u65B0",
  "character.status.imported": "\u89D2\u8272\u5361\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5230\u4F1A\u8BDD",
  "character.status.created": "\u5DF2\u521B\u5EFA\u7A7A\u767D\u89D2\u8272\u5361\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5230\u4F1A\u8BDD",
  "character.status.bound": "\u89D2\u8272\u9009\u62E9\u5DF2\u4FDD\u5B58\uFF1B\u5B9E\u9645\u5BF9\u8BDD\u52A0\u8F7D\u7531 Tavern loader \u7EDF\u4E00\u5904\u7406",
  "character.status.unbound": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u89D2\u8272\u7ED1\u5B9A",
  "character.status.deleted": "\u89D2\u8272\u5361\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664",
  "character.status.detailsLoaded": "\u89D2\u8272\u8BE6\u60C5\u5DF2\u52A0\u8F7D",
  "character.status.saved": "\u89D2\u8272\u5361\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u4F7F\u7528\u65B0\u5B57\u6BB5",
  "character.status.skippedRefresh": "\u6709\u672A\u4FDD\u5B58\u7684\u89D2\u8272\u5361\u4FEE\u6539\uFF0C\u5DF2\u8DF3\u8FC7\u5237\u65B0",
  "character.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u89D2\u8272",
  "character.error.noSessionToUnbind": "\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u7ED1\u7684\u4F1A\u8BDD",
  "character.error.saveFirst": "\u8BF7\u5148\u4FDD\u5B58\u89D2\u8272\u5361\u5B57\u6BB5\u518D\u7ED1\u5B9A",
  "world.title": "\u4E16\u754C\u4FE1\u606F\uFF08World Book\uFF09",
  "world.lorebookTitle": "\u4E16\u754C\u4FE1\u606F\uFF08Lorebook\uFF09",
  "world.importJson": "\u5BFC\u5165 JSON",
  "world.create": "\u65B0\u5EFA\u4E16\u754C\u4E66",
  "world.defaultName": "Untitled World Book",
  "world.standalone": "\u72EC\u7ACB\u4E16\u754C\u4E66",
  "world.sessionBinding": "\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A",
  "world.libraryEmpty": "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002",
  "world.bindingUnsaved": "\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u5F53\u524D\u52FE\u9009\u5C1A\u672A\u5E94\u7528\u5230\u4F1A\u8BDD\u3002",
  "world.bindingApplied": "\u9762\u677F\u663E\u793A\u7684\u7ED1\u5B9A\u5DF2\u5E94\u7528\u5230\u5F53\u524D\u4F1A\u8BDD\u3002",
  "world.applyBinding": "\u5E94\u7528\u4F1A\u8BDD\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "world.bindingAppliedButton": "\u5F53\u524D\u7ED1\u5B9A\u5DF2\u5E94\u7528",
  "world.clearPending": "\u6E05\u7A7A\u5F85\u5E94\u7528\u9009\u62E9",
  "world.browse": "\u6D4F\u89C8\u72EC\u7ACB\u4E16\u754C\u4E66",
  "world.catalogEmpty": "\u8D44\u6E90\u5E93\u4E3A\u7A7A",
  "world.bookName": "\u4E16\u754C\u4E66\u540D\u79F0",
  "world.addEntry": "\u65B0\u589E\u6761\u76EE",
  "world.deleteStandalone": "\u5220\u9664\u72EC\u7ACB\u4E66",
  "world.characterBound": "\u89D2\u8272\u5361\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66",
  "world.embeddedTitle": "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66",
  "world.embeddedInfoTitle": "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4FE1\u606F",
  "world.addEmbeddedEntry": "\u65B0\u589E\u5185\u5D4C\u6761\u76EE",
  "world.saveEmbedded": "\u4FDD\u5B58\u5185\u5D4C\u4E66",
  "world.embeddedSaved": "\u5185\u5D4C\u4E66\u5DF2\u4FDD\u5B58",
  "world.matcherNote": "\u5B9E\u9645\u6FC0\u6D3B\u3001\u6392\u5E8F\u3001\u6982\u7387\u548C\u9884\u7B97\u7531\u5171\u4EAB matcher \u786E\u5B9A\uFF1B\u6700\u7EC8\u6CE8\u5165\u4ECD\u7531 Tavern loader \u7EDF\u4E00\u5B8C\u6210\u3002\u5F53\u524D\u626B\u63CF\u4F1A\u628A\u672C\u6B65\u9AA4 claimed \u8F93\u5165\u4E0E\u6301\u4E45\u5386\u53F2\u7EC4\u5408\u6210\u4E34\u65F6\u4E0A\u4E0B\u6587\uFF0C\u56E0\u6B64\u5355\u6B65\u9AA4\u4F1A\u8BDD\u4E5F\u80FD\u5728\u9996\u6B21\u8BF7\u6C42\u89E6\u53D1\u5173\u952E\u8BCD\u3002",
  "world.infoIntro": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\u3002SillyTavern \u7684\u6B63\u5F0F\u529F\u80FD\u540D\u662F World Info\uFF0CLorebook \u662F\u5B98\u65B9\u8BA4\u53EF\u7684\u5E38\u7528\u522B\u540D\u3002",
  "world.infoLoaded": "\u5DF2\u8F7D\u5165 {count} \u4E2A\u6761\u76EE\u3002",
  "world.infoDirty": "\u6709\u5C1A\u672A\u4FDD\u5B58\u7684\u6761\u76EE\u4FEE\u6539\u3002",
  "world.infoReading": "\u6B63\u5728\u8BFB\u53D6\u4E16\u754C\u4FE1\u606F\u2026",
  "world.infoEmpty": "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7528\u4E16\u754C\u4FE1\u606F\u3002\u7ED1\u5B9A\u542B character_book \u7684\u89D2\u8272\u5361\u540E\uFF0C\u5176\u5185\u5D4C\u6761\u76EE\u4F1A\u81EA\u52A8\u7531 loader \u5339\u914D\uFF1B\u89E3\u7ED1\u89D2\u8272\u4F1A\u540C\u65F6\u79FB\u9664\u8BE5\u6765\u6E90\u3002",
  "world.infoMeta": "\u89D2\u8272\u5361\u5185\u5D4C \xB7 {count} \u6761\u3002\u6298\u53E0\u6807\u9898\u76F4\u63A5\u663E\u793A\u8BE5\u6761\u76EE\u7684\u89E6\u53D1\u65B9\u5F0F\uFF1B\u5C55\u5F00\u540E\u53EF\u7F16\u8F91\u5173\u952E\u8BCD\u3001\u903B\u8F91\u3001\u5185\u5BB9\u3001\u4F4D\u7F6E\u548C\u6392\u5E8F\u3002",
  "world.infoPendingIds": "\u5DF2\u9009\u62E9 {count} \u4E2A\u72EC\u7ACB\u4E16\u754C\u4FE1\u606F ID\uFF0C\u4F46\u72EC\u7ACB\u8D44\u6E90\u5E93/API \u5C1A\u672A\u63A5\u5165\uFF0C\u672C\u9636\u6BB5\u4E0D\u4F1A\u52A0\u8F7D\u8FD9\u4E9B ID\u3002",
  "world.infoSaveNote": "\u4FDD\u5B58\u4F1A\u66F4\u65B0\u89D2\u8272\u5361\u6587\u6863\u53CA\u5176 JSON/PNG \u5BFC\u51FA\u3002matcher \u4F1A\u5728\u9996\u6B21\u8BF7\u6C42\u7EC4\u88C5\u524D\u628A\u672C\u6B65\u9AA4 claimed \u8F93\u5165\u4E0E Session \u5386\u53F2\u7EC4\u5408\u626B\u63CF\uFF0C\u4E0D\u4F1A\u5411\u5386\u53F2\u5199\u5165\u526F\u672C\u3002",
  "world.entry.untitled": "\u65B0\u6761\u76EE {id}",
  "world.entry.fallback": "\u6761\u76EE {id}",
  "world.entry.title": "\u6761\u76EE\u6807\u9898",
  "world.entry.nameNote": "\u6761\u76EE\u540D\u79F0 / \u5907\u6CE8",
  "world.entry.delete": "\u5220\u9664\u6761\u76EE",
  "world.entry.constant": "\u5E38\u9A7B",
  "world.entry.noKeywords": "\u65E0\u5173\u952E\u8BCD",
  "world.entry.noPrimaryKeys": "\u65E0\u4E3B\u5173\u952E\u8BCD",
  "world.entry.disabled": "\u5DF2\u7981\u7528",
  "world.entry.useSecondary": "\u4F7F\u7528\u9644\u52A0\u5173\u952E\u8BCD",
  "world.entry.caseSensitive": "\u533A\u5206\u5927\u5C0F\u5199",
  "world.entry.wholeWord": "\u5168\u8BCD\u5339\u914D",
  "world.entry.primaryKeys": "\u4E3B\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09",
  "world.entry.secondaryKeys": "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u652F\u6301\u4E2D\u6587\u3001\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF09",
  "world.entry.primaryKeysLines": "\u4E3B\u5173\u952E\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF1B\u4EFB\u4E00\u547D\u4E2D\uFF09",
  "world.entry.secondaryKeysLines": "\u9644\u52A0\u5173\u952E\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09",
  "world.entry.secondaryLogic": "\u9644\u52A0\u5173\u952E\u8BCD\u903B\u8F91",
  "world.entry.secondaryLogicShort": "Secondary logic",
  "world.entry.body": "\u6B63\u6587",
  "world.entry.content": "\u6761\u76EE\u5185\u5BB9\uFF08\u89E6\u53D1\u540E\u6CE8\u5165 system profile\uFF09",
  "world.entry.position": "\u4F4D\u7F6E",
  "world.entry.insertionPosition": "\u63D2\u5165\u4F4D\u7F6E",
  "world.entry.order": "\u987A\u5E8F\uFF08\u9AD8\u503C\u4F18\u5148\uFF09",
  "world.entry.sortWeight": "\u6392\u5E8F\u6743\u91CD",
  "world.entry.probability": "\u6982\u7387\uFF080\u2013100\uFF09",
  "world.entry.trigger": "\u5173\u952E\u8BCD\uFF1A{keys}",
  "world.entry.triggerWithSecondary": "\u5173\u952E\u8BCD\uFF1A{keys} \xB7 {logic}\uFF1A{secondary}",
  "world.logic.andAny": "AND ANY\uFF1A\u547D\u4E2D\u4EFB\u4E00",
  "world.logic.andAll": "AND ALL\uFF1A\u547D\u4E2D\u5168\u90E8",
  "world.logic.notAny": "NOT ANY\uFF1A\u4E0D\u80FD\u547D\u4E2D\u4EFB\u4E00",
  "world.logic.notAll": "NOT ALL\uFF1A\u4E0D\u80FD\u5168\u90E8\u547D\u4E2D",
  "world.position.beforeCharacter": "\u89D2\u8272\u5B9A\u4E49\u4E4B\u524D",
  "world.position.afterCharacter": "\u89D2\u8272\u5B9A\u4E49\u4E4B\u540E",
  "world.position.beforeAuthor": "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.afterAuthor": "\u4F5C\u8005\u6CE8\u91CA\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.atDepth": "\u6307\u5B9A\u6DF1\u5EA6\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.beforeExamples": "\u793A\u4F8B\u6D88\u606F\u4E4B\u524D\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.afterExamples": "\u793A\u4F8B\u6D88\u606F\u4E4B\u540E\uFF08\u8FD1\u4F3C\uFF09",
  "world.position.outlet": "Outlet\uFF08\u5F53\u524D\u4E0D\u6CE8\u5165\uFF09",
  "world.currentSession": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\u3002\u53EF\u7ED1\u5B9A\u96F6\u672C\u3001\u4E00\u672C\u6216\u591A\u672C\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u7ED1\u5B9A\u987A\u5E8F\u4FDD\u6301\u7A33\u5B9A\u3002",
  "world.catalogItem": "{name}\uFF08{count} \u6761\uFF09",
  "world.documentMeta": "{count} \u6761 \xB7 \u672A\u77E5\u5B57\u6BB5\u5728\u4FDD\u5B58\u548C\u5BFC\u51FA\u65F6\u7A33\u5B9A\u4FDD\u7559",
  "world.user.title": "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66",
  "world.user.current": "\u5F53\u524D\u7528\u6237\uFF1A{name}",
  "world.user.none": "\u5F53\u524D\u4F1A\u8BDD\u672A\u7ED1\u5B9A\u7528\u6237\uFF0C\u56E0\u6B64\u6CA1\u6709\u7528\u6237\u6765\u6E90\u7684\u4E16\u754C\u4E66\u3002",
  "world.user.empty": "\u5F53\u524D\u7528\u6237\u6CA1\u6709\u7ED1\u5B9A\u72EC\u7ACB\u4E16\u754C\u4E66\u3002",
  "world.user.libraryEmpty": "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002\u8BF7\u5148\u521B\u5EFA\u6216\u5BFC\u5165\u4E16\u754C\u4E66\u3002",
  "world.user.unsaved": "\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF1B\u5F53\u524D\u52FE\u9009\u5C1A\u672A\u5E94\u7528\u3002",
  "world.user.saved": "\u5F53\u524D\u663E\u793A\u7684\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58\u5E76\u5E94\u7528\u3002",
  "world.user.order": "\u6709\u6548\u7EC4\u5408\u987A\u5E8F\u4E3A\uFF1A\u5F53\u524D\u4F1A\u8BDD\u663E\u5F0F\u4E16\u754C\u4E66\u5728\u524D\uFF0C\u7528\u6237\u7ED1\u5B9A\u4E16\u754C\u4E66\u968F\u540E\uFF1B\u91CD\u590D\u8D44\u6E90\u53EA\u6267\u884C\u4E00\u6B21\u3002",
  "world.user.duplicate": "\u4E0E\u4F1A\u8BDD\u7ED1\u5B9A\u91CD\u590D\uFF0C\u5DF2\u53BB\u91CD",
  "world.user.appended": "\u7531\u7528\u6237\u7ED1\u5B9A\u8FFD\u52A0",
  "world.user.pendingAdd": "\u5F85\u6DFB\u52A0",
  "world.user.pendingRemove": "\u5F85\u79FB\u9664",
  "world.user.save": "\u4FDD\u5B58\u7528\u6237\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "world.user.saveApplied": "\u7528\u6237\u7ED1\u5B9A\u5DF2\u4FDD\u5B58",
  "world.user.clear": "\u6E05\u7A7A\u5F85\u4FDD\u5B58\u9009\u62E9",
  "world.user.saveSuccess": "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF1B\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u7EC4\u5408\u3002",
  "world.user.editContent": "\u7F16\u8F91\u5185\u5BB9",
  "world.user.editHint": "\u8FD9\u91CC\u4E0E\u7528\u6237\u9762\u677F\u7F16\u8F91\u540C\u4E00\u4EFD\u7ED1\u5B9A\u5173\u7CFB\uFF1B\u4EFB\u4E00\u5904\u4FDD\u5B58\u540E\uFF0C\u53E6\u4E00\u5904\u4F1A\u540C\u6B65\u5237\u65B0\u3002",
  "world.user.error.noUser": "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7F16\u8F91\u4E16\u754C\u4E66\u5173\u7CFB\u7684\u7ED1\u5B9A\u7528\u6237",
  "world.embeddedMeta": "{count} \u6761\u3002\u5B83\u4E0E\u72EC\u7ACB\u4E66\u5171\u7528 matcher/loader\uFF1B\u5220\u9664\u72EC\u7ACB\u4E66\u4E0D\u4F1A\u4FEE\u6539\u6216\u89E3\u7ED1\u89D2\u8272\u5361\u5185\u5D4C\u4E66\u3002",
  "world.embeddedEmpty": "\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u89D2\u8272\u5361\u7ED1\u5B9A\u7684\u5185\u5D4C\u4E16\u754C\u4E66\u3002\u7ED1\u5B9A\u542B character_book \u7684\u89D2\u8272\u5361\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
  "world.diagnostics": "\u8FD0\u884C\u8BCA\u65AD\uFF08{count}\uFF09",
  "world.confirmDelete": "\u5220\u9664\u72EC\u7ACB\u4E16\u754C\u4E66\u201C{name}\u201D\uFF1F\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u4E0D\u4F1A\u53D7\u5230\u5F71\u54CD\u3002",
  "world.confirmDiscardChanges": "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF1F",
  "world.confirmDeleteEntry": "\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002",
  "world.confirmDeleteEmbeddedEntry": "\u5220\u9664\u8FD9\u4E2A\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u751F\u6548\u3002",
  "world.confirmDeleteInfoEntry": "\u5220\u9664\u8FD9\u4E2A\u4E16\u754C\u4FE1\u606F\u6761\u76EE\uFF1F\u4FDD\u5B58\u540E\u624D\u4F1A\u5199\u5165\u89D2\u8272\u5361\u526F\u672C\u3002",
  "world.confirmReloadInfo": "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u6761\u76EE\u4FEE\u6539\u5E76\u91CD\u65B0\u8F7D\u5165\uFF1F",
  "world.status.loaded": "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u52A0\u8F7D",
  "world.status.refreshed": "\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u5DF2\u5237\u65B0",
  "world.status.detailsLoaded": "\u4E16\u754C\u4E66\u8BE6\u60C5\u5DF2\u52A0\u8F7D",
  "world.status.created": "\u5DF2\u521B\u5EFA\u72EC\u7ACB\u4E16\u754C\u4E66\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "world.status.imported": "\u4E16\u754C\u4E66\u5DF2\u5BFC\u5165\uFF1B\u5C1A\u672A\u7ED1\u5B9A\u5F53\u524D\u4F1A\u8BDD",
  "world.status.saved": "\u4E16\u754C\u4E66\u4FEE\u6539\u5DF2\u6301\u4E45\u5316\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9",
  "world.status.bindingSaved": "\u5F53\u524D\u4F1A\u8BDD\u7684\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58",
  "world.status.deleted": "\u72EC\u7ACB\u4E16\u754C\u4E66\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u7406",
  "world.status.embeddedSaved": "\u89D2\u8272\u5361\u5185\u5D4C\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF0C\u540E\u7EED\u8BF7\u6C42\u5C06\u4F7F\u7528\u65B0\u5185\u5BB9",
  "world.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u518D\u7ED1\u5B9A\u4E16\u754C\u4E66",
  "user.title": "Tavern \u7528\u6237",
  "user.create": "\u65B0\u5EFA\u7528\u6237",
  "user.browse": "\u6D4F\u89C8\u7528\u6237\u8D44\u6E90",
  "user.libraryEmpty": "\u7528\u6237\u8D44\u6E90\u5E93\u4E3A\u7A7A",
  "user.sessionBinding": "\u5F53\u524D\u4F1A\u8BDD\uFF1A{session}\uFF1B\u7ED1\u5B9A\uFF1A{name}",
  "user.dirty": "\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF1A{parts}\u3002",
  "user.dirty.name": "\u540D\u5B57/\u63CF\u8FF0",
  "user.dirty.binding": "\u7528\u6237\u4E16\u754C\u4E66\u7ED1\u5B9A",
  "user.savedNote": "\u5F53\u524D\u663E\u793A\u7684\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5747\u5DF2\u4FDD\u5B58\u3002",
  "user.loading": "\u6B63\u5728\u52A0\u8F7D\u7528\u6237\u8D44\u6E90\u2026",
  "user.emptyHint": "\u521B\u5EFA\u4E00\u4E2A\u53EA\u542B\u540D\u5B57\u548C\u63CF\u8FF0\u7684\u7528\u6237\u8D44\u6E90\u3002",
  "user.name": "\u540D\u5B57\uFF08\u7528\u4E8E {macro} \u5B8F\uFF09",
  "user.description": "\u63CF\u8FF0\uFF08\u8FDB\u5165 personaDescription marker\uFF1B\u7F3A marker \u65F6\u7531 loader \u7A33\u5B9A\u964D\u7EA7\uFF09",
  "user.saveResource": "\u4FDD\u5B58\u8D44\u6E90\uFF08\u672A\u4FDD\u5B58\uFF09",
  "user.resourceSaved": "\u8D44\u6E90\u5DF2\u4FDD\u5B58",
  "user.saveFirst": "\u8BF7\u5148\u4FDD\u5B58\u4FEE\u6539",
  "user.refreshBinding": "\u5237\u65B0\u4F1A\u8BDD\u7ED1\u5B9A",
  "user.bind": "\u7ED1\u5B9A\u5230\u5F53\u524D\u4F1A\u8BDD",
  "user.worldBooksTitle": "\u7528\u6237\u7ED1\u5B9A\u7684\u72EC\u7ACB\u4E16\u754C\u4E66",
  "user.worldBooksHint": "\u9009\u62E9\u8BE5\u7528\u6237\u65F6\uFF0Cloader \u4F1A\u81EA\u52A8\u7EC4\u5408\u8FD9\u91CC\u7684\u4E16\u754C\u4E66\u4E0E\u5F53\u524D\u4F1A\u8BDD\u663E\u5F0F\u9009\u62E9\u7684\u4E16\u754C\u4E66\uFF1B\u91CD\u590D\u7684\u540C\u4E00\u672C\u4E66\u53EA\u6267\u884C\u4E00\u6B21\u3002",
  "user.worldBooksLoading": "\u6B63\u5728\u52A0\u8F7D\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u2026",
  "user.worldBooksEmpty": "\u72EC\u7ACB\u4E16\u754C\u4E66\u8D44\u6E90\u5E93\u4E3A\u7A7A\u3002\u8BF7\u5148\u5728\u4E16\u754C\u4E66\u9762\u677F\u521B\u5EFA\u6216\u5BFC\u5165\u3002",
  "user.saveWorldBooks": "\u4FDD\u5B58\u4E16\u754C\u4E66\u7ED1\u5B9A\uFF08\u672A\u4FDD\u5B58\uFF09",
  "user.worldBooksSaved": "\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u4FDD\u5B58",
  "user.clearPending": "\u6E05\u7A7A\u5F85\u4FDD\u5B58\u9009\u62E9",
  "user.unbind": "\u89E3\u9664\u5F53\u524D\u4F1A\u8BDD\u7ED1\u5B9A",
  "user.identityNote": "\u7528\u6237\u8D44\u6E90\u6B63\u6587\u4ECD\u4E25\u683C\u53EA\u6709\u540D\u5B57\u548C\u63CF\u8FF0\uFF1B\u4E16\u754C\u4E66\u5173\u7CFB\u4FDD\u5B58\u5728 loader \u7684\u72EC\u7ACB\u7ED3\u6784\u5316\u7B56\u7565\u4E2D\u3002\u7528\u6237\u8D44\u6E90\u4E0D\u5305\u542B\u5934\u50CF\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6 DSH Agent \u8EAB\u4EFD\u3002",
  "user.delete": "\u5220\u9664\u7528\u6237",
  "user.defaultName": "\u65B0\u7528\u6237",
  "user.confirmDelete": "\u5220\u9664\u7528\u6237\u201C{name}\u201D\uFF1F\u6240\u6709\u4F1A\u8BDD\u4E2D\u7684\u7528\u6237\u9009\u62E9\u548C\u8BE5\u7528\u6237\u7684\u4E16\u754C\u4E66\u5173\u7CFB\u90FD\u4F1A\u6E05\u9664\u3002",
  "user.confirmDiscardForCreate": "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u65B0\u5EFA\u7528\u6237\u5417\uFF1F",
  "user.confirmDiscardForSwitch": "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u653E\u5F03\u4FEE\u6539\u5E76\u5207\u6362\u5417\uFF1F",
  "user.confirmHistoricalSwitch": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u6709\u5386\u53F2\u3002\u5207\u6362\u7528\u6237\u53EA\u5F71\u54CD\u540E\u7EED\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u91CD\u5199\u5DF2\u6709\u6D88\u606F\uFF1B\u7EE7\u7EED\u5417\uFF1F",
  "user.confirmCloseDirty": "\u5F53\u524D\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\u3002\u4ECD\u7136\u5173\u95ED\u5417\uFF1F",
  "user.confirmDiscardRefresh": "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u7528\u6237\u8D44\u6E90\u6216\u4E16\u754C\u4E66\u7ED1\u5B9A\u4FEE\u6539\uFF1F",
  "user.status.loaded": "\u7528\u6237\u8D44\u6E90\u5DF2\u52A0\u8F7D",
  "user.status.refreshed": "\u7528\u6237\u8D44\u6E90\u5DF2\u5237\u65B0",
  "user.status.created": "\u7528\u6237\u8D44\u6E90\u5DF2\u521B\u5EFA\uFF1B\u4FDD\u5B58\u540D\u5B57\u548C\u63CF\u8FF0\u540E\u518D\u7ED1\u5B9A",
  "user.status.saved": "\u540D\u5B57\u548C\u63CF\u8FF0\u5DF2\u4FDD\u5B58\uFF1B\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u7ACB\u5373\u4F7F\u7528\u65B0\u5185\u5BB9",
  "user.status.bound": "\u7528\u6237\u5DF2\u7ED1\u5B9A\uFF1B\u5F53\u524D\u4F1A\u8BDD\u7684\u4E0B\u4E00\u6B21\u8BF7\u6C42\u4F1A\u4F7F\u7528\u8BE5\u540D\u5B57\u548C\u63CF\u8FF0",
  "user.status.unbound": "\u5F53\u524D\u4F1A\u8BDD\u5DF2\u89E3\u9664\u7528\u6237\u7ED1\u5B9A",
  "user.status.deleted": "\u7528\u6237\u5DF2\u5220\u9664\uFF0C\u76F8\u5173\u4F1A\u8BDD\u7ED1\u5B9A\u5DF2\u6E05\u9664",
  "user.status.skippedRefresh": "\u68C0\u6D4B\u5230\u5176\u4ED6 Tavern \u8D44\u6E90\u53D8\u5316\uFF1B\u4E3A\u4FDD\u7559\u672C\u9762\u677F\u672A\u4FDD\u5B58\u4FEE\u6539\uFF0C\u672A\u81EA\u52A8\u5237\u65B0\u3002",
  "user.status.worldBooksSaved": "\u7528\u6237\u7ED1\u5B9A\u7684\u4E16\u754C\u4E66\u5DF2\u4FDD\u5B58\uFF1B\u9009\u62E9\u8BE5\u7528\u6237\u7684\u4F1A\u8BDD\u4F1A\u5728\u4E0B\u4E00\u6B21\u7EC4\u88C5\u65F6\u81EA\u52A8\u4F7F\u7528",
  "user.status.userLoaded": "\u7528\u6237\u8D44\u6E90\u548C\u4E16\u754C\u4E66\u7ED1\u5B9A\u5DF2\u52A0\u8F7D",
  "user.error.needSession": "\u8BF7\u5148\u521B\u5EFA\u6216\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u5E76\u9009\u62E9\u7528\u6237\u8D44\u6E90",
  "user.error.noSessionToUnbind": "\u5F53\u524D\u6CA1\u6709\u53EF\u89E3\u7ED1\u7684\u4F1A\u8BDD",
  "template.title": "\u65B0\u4F1A\u8BDD\u4E0E\u914D\u7F6E\u6A21\u677F",
  "template.startCurrent": "\u7EF4\u6301\u5F53\u524D Tavern \u8BBE\u7F6E\u65B0\u5F00\u5BF9\u8BDD",
  "template.inheritNote": "\u53EA\u7EE7\u627F preset\u3001\u89D2\u8272\u5361\u4E0E greeting/\u5F00\u5173\u3001\u7528\u6237\u548C\u72EC\u7ACB\u4E16\u754C\u4E66\u9009\u62E9\u3002DSH \u5386\u53F2\u3001Tavern Trace\u3001Inbox\u3001\u8FD0\u884C\u4E2D turn/step \u548C\u5176\u4ED6\u8FD0\u884C\u6001\u4E0D\u4F1A\u590D\u5236\u3002",
  "template.noWorkspace": "\u6CA1\u6709\u53EF\u7528\u7684 DSH \u76EE\u6807\u5DE5\u4F5C\u533A\u3002\u8BF7\u5148\u5728 DSH \u4FA7\u680F\u4E2D\u52A0\u5165\u6216\u6253\u5F00\u5DE5\u4F5C\u533A\u3002",
  "template.listTitle": "\u914D\u7F6E\u6A21\u677F\uFF08{count}\uFF09",
  "template.selected": "\u5DF2\u9009\u62E9\u6A21\u677F",
  "template.noneSelected": "\u672A\u9009\u62E9\u6A21\u677F",
  "template.name": "\u6A21\u677F\u540D\u79F0",
  "template.createFromCurrent": "\u7531\u5F53\u524D\u8BBE\u7F6E\u521B\u5EFA",
  "template.saveNameOnly": "\u4EC5\u4FDD\u5B58\u540D\u79F0",
  "template.updateFromCurrent": "\u7528\u5F53\u524D\u8BBE\u7F6E\u66F4\u65B0",
  "template.delete": "\u5220\u9664\u6A21\u677F",
  "template.unusable": "\u8BE5\u6A21\u677F\u6682\u4E0D\u53EF\u7528\u4E8E\u521B\u5EFA\uFF1A",
  "template.startFromTemplate": "\u6839\u636E\u6240\u9009\u6A21\u677F\u65B0\u5F00\u5E72\u51C0\u5BF9\u8BDD",
  "template.ready": "\u6A21\u677F\u4E0E\u65B0\u4F1A\u8BDD\u64CD\u4F5C\u5DF2\u5C31\u7EEA\u3002",
  "template.blankSessionNote": "DSH \u53EF\u80FD\u590D\u7528\u540C\u5DE5\u4F5C\u533A\u4E2D\u5DF2\u6709\u7684\u771F\u5B9E blank session\uFF1B\u8FD9\u662F\u5176\u516C\u5F00 New Session \u8BED\u4E49\u3002\u63D2\u4EF6\u4F1A\u5728\u5BFC\u822A\u524D\u539F\u5B50\u66FF\u6362\u8BE5 blank session \u7684 Tavern \u9009\u62E9\u3002",
  "template.preview.title": "\u4FDD\u5B58\u7684 Tavern \u914D\u7F6E",
  "template.preview.worldBooks": "\u72EC\u7ACB\u4E16\u754C\u4E66\uFF08\u6309\u7ED1\u5B9A\u987A\u5E8F\uFF09",
  "template.preview.greeting": "\u5F00\u573A\u5E8F\u53F7\uFF1A{value}",
  "template.preview.systemPrompt": "\u5361\u5185 system_prompt\uFF1A{value}",
  "template.preview.postHistory": "post_history_instructions\uFF1A{value}",
  "template.defaultName": "\u65B0\u914D\u7F6E\u6A21\u677F",
  "template.currentSettingsReminder": "\u6A21\u677F\u53EA\u80FD\u7528\u5F53\u524D\u4F1A\u8BDD\u7684 Tavern \u8BBE\u7F6E\u521B\u5EFA\u6216\u66F4\u65B0\u3002\u8BF7\u5728\u60AC\u6D6E\u7403\u7684\u9884\u8BBE\u3001\u89D2\u8272\u5361\u3001\u4E16\u754C\u4E66\u548C\u7528\u6237\u9762\u677F\u4E2D\u67E5\u770B\u6216\u4FEE\u6539\u5F53\u524D\u914D\u7F6E\uFF0C\u518D\u56DE\u5230\u8FD9\u91CC\u4FDD\u5B58\u3002",
  "template.confirmDelete": "\u5220\u9664\u914D\u7F6E\u6A21\u677F\u201C{name}\u201D\uFF1F\u8FD9\u4E0D\u4F1A\u5220\u9664\u4EFB\u4F55 DSH \u4F1A\u8BDD\u3002",
  "template.status.selected": "\u6A21\u677F\u9009\u62E9\u5DF2\u66F4\u65B0",
  "template.status.created": "\u5DF2\u521B\u5EFA\u6A21\u677F\uFF1A{name}",
  "template.status.renamed": "\u5DF2\u91CD\u547D\u540D\u6A21\u677F\uFF1A{name}",
  "template.status.updated": "\u5DF2\u7528\u5F53\u524D\u8BBE\u7F6E\u66F4\u65B0\u6A21\u677F\uFF1A{name}",
  "template.status.deleted": "\u6A21\u677F\u5DF2\u5220\u9664",
  "template.status.switched": "\u5DF2\u5207\u6362\u5230\u5E72\u51C0\u4F1A\u8BDD\uFF1A{id}",
  "template.error.needSessionToSave": "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u518D\u4FDD\u5B58\u5F53\u524D Tavern \u8BBE\u7F6E",
  "template.error.needTemplate": "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6A21\u677F",
  "template.error.needSessionAndTemplate": "\u8BF7\u5148\u6253\u5F00\u4F1A\u8BDD\u5E76\u9009\u62E9\u6A21\u677F",
  "template.error.needSourceSession": "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u6765\u6E90\u4F1A\u8BDD",
  "template.error.needWorkspace": "\u5F53\u524D\u4F1A\u8BDD\u4E0D\u5C5E\u4E8E DSH \u5DE5\u4F5C\u533A\uFF1B\u8BF7\u5148\u628A\u4F1A\u8BDD\u52A0\u5165\u5DE5\u4F5C\u533A",
  "trace.title": "Tavern Trace",
  "trace.intro": "\u4E0E Conversation / Trajectory \u5E76\u5217\u7684 loader \u5BA1\u8BA1\u89C6\u56FE\u3002DSH request/header \u59CB\u7EC8\u662F\u6700\u7EC8\u53D1\u9001 system\u3001tools \u4E0E\u751F\u6548 config \u7684\u6743\u5A01\u3002",
  "trace.reading": "\u6B63\u5728\u8BFB\u53D6\u5BA1\u8BA1\u8BB0\u5F55\u2026",
  "trace.empty": "\u6B64\u4F1A\u8BDD\u8FD8\u6CA1\u6709 Tavern \u8BF7\u6C42\u5BA1\u8BA1\u8BB0\u5F55\u3002\u53D1\u9001\u4E0B\u4E00\u6761\u6D88\u606F\u540E\u518D\u67E5\u770B\u3002",
  "trace.privacy": "\u9690\u79C1\u8FB9\u754C\uFF1A\u8FD9\u91CC\u53EA\u4FDD\u5B58\u8D44\u6E90\u6458\u8981\u3001\u914D\u7F6E/\u547D\u4E2D\u5173\u952E\u8BCD\u3001\u51B3\u7B56\u539F\u56E0\u3001\u4F4D\u7F6E\u3001\u9884\u7B97\u548C SHA-256 \u6458\u8981\uFF1B\u4E0D\u4FDD\u5B58 preset/\u89D2\u8272/user/\u4E16\u754C\u4E66\u6B63\u6587\u3001\u5B8C\u6574 system\u3001\u804A\u5929\u5386\u53F2\u3001header \u5185\u5BB9\u6216 tool payload\u3002",
  "trace.unused": "\u672A\u4F7F\u7528",
  "trace.noSource": "\u672C\u8F6E\u6CA1\u6709\u53EF\u5BA1\u8BA1\u7684\u4E16\u754C\u4E66\u5339\u914D\u6765\u6E90\u3002",
  "trace.assembly": "\u7EC4\u5408\u4E0E\u63D2\u5165",
  "trace.assemblyMeta": "{section} \xB7 order {order} \xB7 {mode} \xB7 {characters} characters \xB7 call config: {config}",
  "trace.worldBookDecisions": "\u4E16\u754C\u4E66\u5339\u914D\u51B3\u7B56",
  "trace.historyOnly": "\u5339\u914D\u57FA\u4E8E\u672C\u6B65\u9AA4 system assembly \u5F53\u65F6\u53EF\u89C1\u7684\u6301\u4E45\u5316\u4F1A\u8BDD\u5386\u53F2\uFF1B\u6CA1\u6709\u91CD\u590D\u9644\u52A0 pending \u8F93\u5165\u3002",
  "trace.waitingHeader": "\u7B49\u5F85\u6743\u5A01 header",
  "trace.pendingHeader": "\u5C1A\u672A\u89C2\u5BDF\u5230\u53EF\u5BF9\u9F50\u7684 DSH request/header\uFF1B\u8FD9\u4E0D\u4EE3\u8868\u8BF7\u6C42\u5DF2\u7ECF\u53D1\u9001\u3002\u5237\u65B0\u540E\u4ECD\u4F1A\u4FDD\u7559\u8BE5\u5F85\u786E\u8BA4\u8BB0\u5F55\u3002",
  "trace.round": "\u8F6E\u6B21 {turn} \xB7 \u6B65\u9AA4 {step}",
  "trace.roundAttempt": "\u8F6E\u6B21 {turn} \xB7 \u6B65\u9AA4 {step} \xB7 \u5C1D\u8BD5 {attempt}",
  "trace.resource.preset": "Preset",
  "trace.resource.character": "Character",
  "trace.resource.user": "User",
  "trace.inserted": "\u5DF2\u63D2\u5165",
  "trace.rejected": "\u5DF2\u62D2\u7EDD",
  "trace.noConfiguredKeywords": "\u65E0\u914D\u7F6E\u5173\u952E\u8BCD",
  "trace.noKeywordMatches": "\u65E0\u5173\u952E\u8BCD\u547D\u4E2D",
  "trace.truncated": "\uFF1B\u626B\u63CF\u8F93\u5165\u5DF2\u6309\u4E0A\u9650\u622A\u65AD",
  "trace.reusedHeader": "\uFF08\u6CBF\u7528\u4E0A\u4E00\u4EFD header\uFF09",
  "trace.profile.missing": "\u672A\u627E\u5230",
  "trace.profile.consistent": "\u4E00\u81F4",
  "trace.profile.absent": "\u672C\u8F6E\u65E0 profile",
  "trace.config.inconsistent": "\u4E0D\u4E00\u81F4",
  "trace.config.consistent": "\u4E00\u81F4\u6216\u65E0\u5B57\u6BB5",
  "trace.position.approximate": "\uFF08\u8FD1\u4F3C\uFF09",
  "trace.position.notInserted": " \u2192 \u672A\u63D2\u5165",
  "trace.position.applied": " \u2192 {position}{approximate}",
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
  "trace.reason.constant": "\u5E38\u9A7B\u6761\u76EE",
  "trace.reason.primary-key-match": "\u4E3B\u5173\u952E\u8BCD\u547D\u4E2D",
  "trace.reason.primary-key-miss": "\u4E3B\u5173\u952E\u8BCD\u672A\u547D\u4E2D",
  "trace.reason.secondary-and_any-match": "\u9644\u52A0\u5173\u952E\u8BCD\u4EFB\u4E00\u547D\u4E2D",
  "trace.reason.secondary-and_any-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u5747\u672A\u547D\u4E2D",
  "trace.reason.secondary-and_all-match": "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u90E8\u547D\u4E2D",
  "trace.reason.secondary-and_all-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u672A\u5168\u90E8\u547D\u4E2D",
  "trace.reason.secondary-not_any-match": "\u9644\u52A0\u5173\u952E\u8BCD\u6392\u9664\u6761\u4EF6\u901A\u8FC7",
  "trace.reason.secondary-not_any-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u89E6\u53D1\u6392\u9664",
  "trace.reason.secondary-not_all-match": "\u9644\u52A0\u5173\u952E\u8BCD\u975E\u5168\u4E2D\u6761\u4EF6\u901A\u8FC7",
  "trace.reason.secondary-not_all-miss": "\u9644\u52A0\u5173\u952E\u8BCD\u5168\u4E2D\u800C\u6392\u9664",
  "trace.reason.disabled": "\u6761\u76EE\u5DF2\u7981\u7528",
  "trace.reason.external-vector-match-required": "\u9700\u8981\u5916\u90E8\u5411\u91CF\u5339\u914D",
  "trace.reason.inclusion-group-loser": "\u4E92\u65A5\u7EC4\u672A\u80DC\u51FA",
  "trace.reason.probability-failed": "\u6982\u7387\u68C0\u67E5\u62D2\u7EDD",
  "trace.reason.budget-exceeded": "\u8D85\u51FA token \u9884\u7B97",
  "trace.reason.empty-content": "\u6B63\u6587\u4E3A\u7A7A\uFF0C\u672A\u63D2\u5165",
  "trace.reason.outlet-unsupported": "Outlet \u65E0\u7A33\u5B9A\u63D2\u5165 seam"
});

// packages/client/src/i18n/catalogs/en.js
var en_default = Object.freeze({
  "common.unavailable": "Interface text unavailable",
  "common.loading": "Loading\u2026",
  "common.none": "None",
  "common.unknown": "Unknown",
  "common.unknownAuthor": "Unknown author",
  "common.refresh": "Refresh",
  "common.delete": "Delete",
  "common.save": "Save",
  "common.saveChanges": "Save changes",
  "common.saved": "Saved",
  "common.reload": "Reload",
  "common.working": "Working\u2026",
  "common.enabled": "Enabled",
  "common.disabled": "Disabled",
  "common.bound": "Bound",
  "common.unbound": "Not bound",
  "common.planned": "Planned",
  "common.listSeparator": ", ",
  "common.name": "Name",
  "common.role": "Role",
  "common.content": "Content",
  "common.exportJson": "Export JSON",
  "common.importJson": "Import JSON",
  "common.enable": "Enabled",
  "panel.close": "Close the {title} sidebar",
  "nav.preset": "Preset",
  "nav.character": "Character card",
  "nav.worldBook": "World book",
  "nav.user": "User",
  "nav.sessionTemplate": "New session",
  "nav.settings": "UI settings",
  "nav.preset.empty": "No preset selected",
  "nav.character.empty": "No character bound",
  "nav.worldBook.empty": "No world book bound",
  "nav.user.empty": "No user bound",
  "nav.sessionTemplate.empty": "Current settings or configuration template",
  "nav.settings.empty": "Language, scale, RP follow, and RP prompt",
  "nav.regex": "Display regex",
  "nav.regex.empty": "Mowan display-only rules",
  "regex.title": "Display regex",
  "regex.displayOnlyNote": "These rules change Mowan rendering and static HTML only. They never rewrite history, timeline data, or AI requests. Imported switches are preserved as supplied.",
  "regex.scopes": "Regex scopes",
  "regex.scope.global": "Global",
  "regex.scope.preset": "Preset",
  "regex.scope.character": "Character card",
  "regex.noPreset": "No preset is selected. New preset-scoped rules need a resource ID before they can match.",
  "regex.noCharacter": "No character card is bound. New character-scoped rules need a resource ID before they can match.",
  "regex.add": "New rule",
  "regex.emptyScope": "No rules in this scope.",
  "regex.enabled": "Use this rule",
  "regex.name": "Rule name",
  "regex.unnamed": "Unnamed rule",
  "regex.newRule": "New regex",
  "regex.find": "Find expression",
  "regex.replace": "Replacement",
  "regex.flags": "Flags",
  "regex.target": "Rendered messages",
  "regex.target.assistant": "Assistant",
  "regex.target.user": "User",
  "regex.target.both": "Both",
  "regex.scope": "Scope",
  "regex.resourceId": "Resource ID",
  "regex.loaded": "{count} regex rules loaded",
  "regex.saved": "{count} regex rules saved",
  "regex.imported": "{count} regex rules imported and saved",
  "regex.confirmReload": "Discard unsaved regex changes and reload?",
  "regex.confirmClose": "Close and discard unsaved regex changes?",
  "nav.session.none": "No session",
  "nav.syncFailed": "Status sync failed: {message}",
  "nav.menuTitle": "Tavern \xB7 {session}",
  "nav.itemTitleBound": "{label}: {title} ({state})",
  "nav.itemTitle": "{label}: {title}",
  "nav.itemAriaBound": "{label}, {title}, {state}",
  "nav.itemAria": "{label}, {title}",
  "nav.bookCount": "{count} books",
  "nav.launcher": "Drag to move; left-click to open panels; right-click to switch frontend display mode",
  "chrome.switchToPlay": "Switch to custom frontend mode",
  "chrome.switchToNative": "Switch to native DSH mode",
  "chrome.currentPlay": "Current: Mowan",
  "chrome.currentNative": "Current: native DSH",
  "play.sidebar.loading": "Loading role-play workspace\u2026",
  "play.sidebar.workspaceMissing": "No role-play workspace is selected. Native sessions remain available in Lingzhu mode.",
  "play.sidebar.selectWorkspace": "Use {name} as the role-play workspace",
  "play.sidebar.systemWorkspaceConfirm": "{path} is on the system disk. Use it as the role-play workspace anyway?",
  "play.sidebar.newPlaythrough": "Start a new playthrough with {name}",
  "play.sidebar.noCharacters": "No character cards are available.",
  "play.sidebar.noPlaythroughs": "No playthroughs yet.",
  "play.sidebar.unassigned": "Not in a playthrough",
  "play.sidebar.other": "Regular / non-role-play sessions",
  "play.sidebar.otherEmpty": "No regular or external sessions.",
  "play.notice.unbound": "This session is not bound to a character card. You can keep chatting normally; start a new playthrough after binding a card to enable greetings, swipes, display edits, and playthrough import/export.",
  "play.sidebar.sessionMissing": "This playthrough has no available session in the role-play workspace.",
  "play.sidebar.timelineErrors": "{count} playthrough timelines could not be read.",
  "play.chat.label": "Chat",
  "play.chat.loading": "Loading playthrough\u2026",
  "play.chat.empty": "No turns yet. Start the conversation below.",
  "play.chat.previousGreeting": "Previous greeting",
  "play.chat.nextGreeting": "Next greeting",
  "play.chat.hiddenNode": "This QA is hidden in Mowan display.",
  "play.chat.runningDisabled": "Unavailable while the agent is running",
  "play.chat.copy": "Copy displayed reply",
  "play.chat.copyUnavailable": "Clipboard access is unavailable.",
  "play.chat.previousReply": "Previous saved reply",
  "play.chat.nextReply": "Next saved reply",
  "play.chat.noOtherReply": "No other saved reply",
  "play.chat.generateReply": "Generate a new reply",
  "play.chat.editDisplay": "Edit displayed reply",
  "play.chat.editDisplayPrompt": "Display this text instead of the original reply:",
  "play.chat.restoreOriginal": "Restore original reply",
  "play.chat.hideNode": "Hide this QA from Mowan display",
  "play.chat.hideConfirm": "Hide this QA from Mowan display? The original DSH messages will not be deleted.",
  "play.chat.restoreNode": "Restore this QA to Mowan display",
  "play.io.menu": "Playthrough import / export",
  "play.io.exportHtml": "Export static HTML",
  "play.io.exportSt": "Export SillyTavern JSONL",
  "play.io.exportBundle": "Export portable bundle",
  "play.io.import": "Import into a new session",
  "play.io.importUnavailable": "Import is unavailable until the backend provides the one-shot import-context reference required to avoid fake DSH history.",
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
  "settings.rpFollow": "Enter RP mode when a character card is bound",
  "settings.rpFollow.help": "When enabled, binding a character card enters roleplay and pins the file sandbox to read-only. Writes, shell, outbound fetch, and reads outside the workspace or of secret files are refused and that agent is cancelled. Subagents may still be spawned and inherit the same lock. The chat permission chip cannot override this; turn RP off on the character card (or /rp off) first.",
  "settings.rpPolicy": "RP mode prompt (rp:policy)",
  "settings.rpPolicy.help": "Optional. DSH cannot weight prompt sections; identity and style belong in the preset or character card. The default only says high-risk actions are locked. Leave empty to skip extra RP text; the lock still applies. Restore defaults at the bottom only resets language, scale, and RP follow.",
  "settings.rpPolicy.placeholder": "Leave empty to use the read-only sandbox with no extra RP prompt",
  "settings.rpPolicy.save": "Save RP prompt",
  "settings.rpPolicy.reset": "Restore default RP prompt",
  "settings.rpPolicy.saved": "RP prompt saved; it applies on the next request.",
  "rp.block.body": "The agent is attempting a high-risk action such as writing files. If you know what you are doing, turn off RP mode and try again.",
  "rp.block.dismiss": "OK",
  "preset.title": "Tavern preset",
  "preset.active": "\u25CF Enabled",
  "preset.importStJson": "Import ST JSON",
  "preset.create": "Create preset",
  "preset.browse": "Browse presets",
  "preset.libraryEmpty": "Preset library is empty",
  "preset.unboundNote": "The current session has no bound preset.",
  "preset.currentSessionBound": "Current session binding: {name}.",
  "preset.browsingUnbound": "Browsing \u201C{name}\u201D; it is not bound to the current session.",
  "preset.bind": "Bind to current session",
  "preset.bindUpdate": "Update session binding",
  "preset.unbind": "Unbind from current session",
  "preset.loading": "Loading presets\u2026",
  "preset.emptyHint": "Select or create a preset to begin configuring it.",
  "preset.basicSettings": "Basic settings",
  "preset.name": "Preset name",
  "preset.temperature": "Temperature",
  "preset.maxTokens": "Max tokens",
  "preset.reasoningEffort": "Reasoning effort",
  "preset.modelDefault": "Use model default",
  "preset.effort.low": "Low",
  "preset.effort.medium": "Medium",
  "preset.effort.high": "High",
  "preset.effort.xhigh": "Extra high",
  "preset.advancedShow": "Show advanced settings",
  "preset.advancedHide": "Hide advanced settings",
  "preset.advancedNote": "These fields are saved in full. Parameters not exposed by the current dsh request protocol are not forced into the adapter.",
  "preset.systemPrompt": "DSH system prompt",
  "preset.systemAppend": "Keep the DSH system prompt and append the preset (recommended)",
  "preset.systemReplace": "Use only the preset and remove DSH system sections (advanced)",
  "preset.replaceWarning": "Warning: this removes the model-visible Harness identity, Agent persona, and tool instructions, which may break tool use or structured output. Execution-layer sandboxing and approvals remain active.",
  "preset.prompts": "Prompts ({count})",
  "preset.addPrompt": "+ Add",
  "preset.dropHere": "Release to place here",
  "preset.dragOrder": "Drag to reorder",
  "preset.dragNamed": "Drag \u201C{name}\u201D to reorder",
  "preset.markerHint": "ST markers are not injected as standalone prompts",
  "preset.enablePrompt": "Enable prompt",
  "preset.role.system": "System",
  "preset.role.user": "User",
  "preset.role.assistant": "Assistant",
  "preset.sampling.topP": "Top P",
  "preset.sampling.topK": "Top K",
  "preset.sampling.topA": "Top A",
  "preset.sampling.minP": "Min P",
  "preset.sampling.frequencyPenalty": "Frequency penalty",
  "preset.sampling.presencePenalty": "Presence penalty",
  "preset.sampling.repetitionPenalty": "Repetition penalty",
  "preset.sampling.seed": "Seed",
  "preset.defaultName": "New preset",
  "preset.defaultPromptName": "New prompt",
  "preset.confirmDelete": "Delete preset \u201C{name}\u201D?",
  "preset.confirmHistoricalSwitch": "This session already has history. Changing the preset affects only later requests and does not rewrite existing messages. Continue?",
  "preset.status.syncing": "Syncing preset state for the current session\u2026",
  "preset.status.loaded": "Preset loaded",
  "preset.status.refreshed": "Preset status refreshed",
  "preset.status.detailsLoaded": "Preset details loaded; the session binding is unchanged",
  "preset.status.bound": "Preset bound; the current session will use it on the next request",
  "preset.status.unbound": "Preset unbound from the current session",
  "preset.status.created": "Preset created; not bound to the current session",
  "preset.status.imported": "ST preset imported; not bound to the current session",
  "preset.status.saved": "Preset saved; sessions bound to it will use the new content on later requests",
  "preset.status.deleted": "Preset deleted",
  "preset.error.needSession": "Create or open a session before binding a preset",
  "preset.error.needPreset": "Select a preset first",
  "preset.error.noSessionToUnbind": "There is no session to unbind",
  "character.title": "Tavern character card",
  "character.import": "Import JSON / PNG",
  "character.create": "New character card",
  "character.defaultName": "New character",
  "character.browse": "Browse character library",
  "character.libraryEmpty": "Character library is empty",
  "character.sessionBinding": "Current session: {session}; Binding: {name}",
  "character.loading": "Loading character library\u2026",
  "character.emptyHint": "Create a blank character card or import a synthetic or properly licensed SillyTavern card.",
  "character.imageAlt": "{name} character card image",
  "character.greeting": "Greeting reference",
  "character.greeting.default": "Default greeting",
  "character.greeting.defaultEmpty": "Default greeting (empty)",
  "character.greeting.alternate": "Alternate greeting {index}",
  "character.preferSystem": "Allow the loader to prefer the card system_prompt",
  "character.preferPostHistory": "Allow the loader to use post_history_instructions (the loader determines placement)",
  "character.bind": "Bind to current session",
  "character.bindUpdate": "Update session binding (unsaved)",
  "character.bindingUnsaved": "The binding has unsaved changes; the current greeting is not yet applied.",
  "character.bindingApplied": "The greeting shown in this panel is applied to the current session.",
  "character.bindingAppliedButton": "Current binding applied",
  "character.unbind": "Unbind",
  "character.rpMode": "RP mode (high-risk lock)",
  "character.rpMode.help": "When on, the file sandbox stays read-only. Writes, shell, outbound fetch, and reads outside the workspace or of secret files are refused and that agent is cancelled. Subagents may still be spawned and inherit the same lock. Turn this switch off or use /rp off first.",
  "character.status.rpUpdated": "RP mode updated",
  "character.moduleNote": "The character-card module stores normalized resources and session selection. The Tavern loader handles the system profile and embedded World Info on each request without fabricating assistant history.",
  "character.field.creatorNotes": "Creator notes",
  "character.field.description": "Description",
  "character.field.personality": "Personality",
  "character.field.scenario": "Scenario",
  "character.field.greetingContent": "Current greeting reference",
  "character.field.messageExamples": "Message examples",
  "character.field.systemPrompt": "System prompt (handled by the loader according to binding settings)",
  "character.field.postHistory": "Post-history instructions (approximately placed by the loader)",
  "character.embeddedBook": "Embedded character_book preserved losslessly ({count} entries); when the character is bound, the Tavern loader invokes the World Info matcher, and unbinding removes it from later requests.",
  "character.warnings": "Compatibility warnings ({count})",
  "character.unsupported": "Requires loader/other module handling ({count})",
  "character.unknownMacros": "Unknown macros: {names}",
  "character.exportPng": "Export PNG",
  "character.saveResource": "Save fields (unsaved)",
  "character.resourceSaved": "Fields saved",
  "character.saveFirst": "Save changes first",
  "character.dirty": "This character card has unsaved field changes.",
  "character.savedNote": "The displayed character card fields are saved.",
  "character.field.nickname": "Nickname",
  "character.field.creator": "Creator",
  "character.field.characterVersion": "Character version",
  "character.field.tags": "Tags",
  "character.tagsPlaceholder": "tag-one, tag-two",
  "character.field.firstMessage": "Default greeting",
  "character.alternateGreetings": "Alternate greetings",
  "character.addGreeting": "Add alternate greeting",
  "character.delete": "Delete character card",
  "character.confirmDelete": "Delete character card \u201C{name}\u201D?",
  "character.confirmHistoricalSwitch": "This session already has history. Changing the character affects only later requests and does not rewrite existing messages. Continue?",
  "character.confirmCloseDirty": "This character card has unsaved changes. Close anyway?",
  "character.confirmDiscardForSwitch": "This character card has unsaved changes. Switch anyway?",
  "character.confirmDiscardRefresh": "This character card has unsaved changes. Refresh anyway?",
  "character.confirmDiscardForCreate": "This character card has unsaved changes. Discard them and create a new card?",
  "character.status.loaded": "Character library loaded",
  "character.status.refreshed": "Character status refreshed",
  "character.status.libraryRefreshed": "Character library refreshed",
  "character.status.imported": "Character card imported; it is not yet bound to a session",
  "character.status.created": "Blank character card created; it is not yet bound to a session",
  "character.status.bound": "Character selection saved; the Tavern loader handles runtime loading",
  "character.status.unbound": "Character unbound from the current session",
  "character.status.deleted": "Character card deleted and related bindings cleared",
  "character.status.detailsLoaded": "Character details loaded",
  "character.status.saved": "Character card saved; bound sessions will use the new fields on the next request",
  "character.status.skippedRefresh": "Unsaved character edits were kept; refresh skipped",
  "character.error.needSession": "Create or open a session before binding a character",
  "character.error.noSessionToUnbind": "There is no session to unbind",
  "character.error.saveFirst": "Save character field changes before binding",
  "world.title": "World Info (World Book)",
  "world.lorebookTitle": "World Info (Lorebook)",
  "world.importJson": "Import JSON",
  "world.create": "New world book",
  "world.defaultName": "Untitled World Book",
  "world.standalone": "Standalone world books",
  "world.sessionBinding": "Current session binding",
  "world.libraryEmpty": "The standalone world-book library is empty.",
  "world.bindingUnsaved": "The binding has unsaved changes; the current selection is not yet applied.",
  "world.bindingApplied": "The binding shown in this panel is applied to the current session.",
  "world.applyBinding": "Apply session binding (unsaved)",
  "world.bindingAppliedButton": "Current binding applied",
  "world.clearPending": "Clear pending selection",
  "world.browse": "Browse standalone world books",
  "world.catalogEmpty": "Library is empty",
  "world.bookName": "World-book name",
  "world.addEntry": "Add entry",
  "world.deleteStandalone": "Delete standalone book",
  "world.characterBound": "Character-bound world book",
  "world.embeddedTitle": "Embedded character world book",
  "world.embeddedInfoTitle": "Embedded character World Info",
  "world.addEmbeddedEntry": "Add embedded entry",
  "world.saveEmbedded": "Save embedded book",
  "world.embeddedSaved": "Embedded book saved",
  "world.matcherNote": "The shared matcher determines activation, ordering, probability, and budget, and the Tavern loader performs final injection. Scanning combines this step\u2019s claimed input with durable history in a temporary context, so a single-step session can trigger keywords on its first request.",
  "world.infoIntro": "Current session: {session}. SillyTavern\u2019s official feature name is World Info; Lorebook is a commonly accepted alias.",
  "world.infoLoaded": "Loaded {count} entries.",
  "world.infoDirty": "There are unsaved entry changes.",
  "world.infoReading": "Reading World Info\u2026",
  "world.infoEmpty": "No World Info is available for this session. Bind a character card containing character_book to let the loader match its entries; unbinding removes that source.",
  "world.infoMeta": "Embedded character book \xB7 {count} entries. The collapsed title shows how the entry triggers; expand it to edit keywords, logic, content, position, and order.",
  "world.infoPendingIds": "{count} standalone World Info IDs are selected, but the standalone library/API is not wired in this phase and those IDs will not be loaded.",
  "world.infoSaveNote": "Saving updates the character card document and its JSON/PNG export. Before the first request assembly, the matcher scans this step\u2019s claimed input together with Session history without writing a duplicate into history.",
  "world.entry.untitled": "New entry {id}",
  "world.entry.fallback": "Entry {id}",
  "world.entry.title": "Entry title",
  "world.entry.nameNote": "Entry name / note",
  "world.entry.delete": "Delete entry",
  "world.entry.constant": "Always active",
  "world.entry.noKeywords": "No keywords",
  "world.entry.noPrimaryKeys": "No primary keywords",
  "world.entry.disabled": "Disabled",
  "world.entry.useSecondary": "Use secondary keywords",
  "world.entry.caseSensitive": "Case sensitive",
  "world.entry.wholeWord": "Whole-word matching",
  "world.entry.primaryKeys": "Primary keywords (Chinese or English comma separators)",
  "world.entry.secondaryKeys": "Secondary keywords (Chinese or English comma separators)",
  "world.entry.primaryKeysLines": "Primary keywords (one per line; any match)",
  "world.entry.secondaryKeysLines": "Secondary keywords (one per line)",
  "world.entry.secondaryLogic": "Secondary keyword logic",
  "world.entry.secondaryLogicShort": "Secondary logic",
  "world.entry.body": "Body",
  "world.entry.content": "Entry content (injected into the system profile when triggered)",
  "world.entry.position": "Position",
  "world.entry.insertionPosition": "Insertion position",
  "world.entry.order": "Order (higher values first)",
  "world.entry.sortWeight": "Sort weight",
  "world.entry.probability": "Probability (0\u2013100)",
  "world.entry.trigger": "Keywords: {keys}",
  "world.entry.triggerWithSecondary": "Keywords: {keys} \xB7 {logic}: {secondary}",
  "world.logic.andAny": "AND ANY: match any",
  "world.logic.andAll": "AND ALL: match all",
  "world.logic.notAny": "NOT ANY: match none",
  "world.logic.notAll": "NOT ALL: not all may match",
  "world.position.beforeCharacter": "Before character definition",
  "world.position.afterCharacter": "After character definition",
  "world.position.beforeAuthor": "Before author note (approximate)",
  "world.position.afterAuthor": "After author note (approximate)",
  "world.position.atDepth": "At depth (approximate)",
  "world.position.beforeExamples": "Before example messages (approximate)",
  "world.position.afterExamples": "After example messages (approximate)",
  "world.position.outlet": "Outlet (not currently injected)",
  "world.currentSession": "Current session: {session}. Bind zero, one, or multiple standalone world books; binding order remains stable.",
  "world.catalogItem": "{name} ({count} entries)",
  "world.documentMeta": "{count} entries \xB7 Unknown fields are preserved across saves and exports",
  "world.user.title": "User-bound world books",
  "world.user.current": "Current user: {name}",
  "world.user.none": "The current session has no bound user, so it has no user-sourced world books.",
  "world.user.empty": "The current user has no bound standalone world books.",
  "world.user.libraryEmpty": "The standalone world-book library is empty. Create or import a world book first.",
  "world.user.unsaved": "The user world-book binding has unsaved changes; the current selection is not yet applied.",
  "world.user.saved": "The displayed user world-book binding is saved and applied.",
  "world.user.order": "Effective order: explicit session books first, followed by user-bound books; duplicate resources run only once.",
  "world.user.duplicate": "Also session-bound; deduplicated",
  "world.user.appended": "Appended from user binding",
  "world.user.pendingAdd": "Pending addition",
  "world.user.pendingRemove": "Pending removal",
  "world.user.save": "Save user binding (unsaved)",
  "world.user.saveApplied": "User binding saved",
  "world.user.clear": "Clear pending selection",
  "world.user.saveSuccess": "The user-bound world books were saved; later requests will use the new composition.",
  "world.user.editContent": "Edit contents",
  "world.user.editHint": "This panel and the User panel edit the same binding. Saving in either place refreshes the other.",
  "world.user.error.noUser": "The current session has no bound user whose world-book relationship can be edited",
  "world.embeddedMeta": "{count} entries. It shares the matcher/loader with standalone books; deleting a standalone book never edits or unbinds this embedded book.",
  "world.embeddedEmpty": "The current session has no character-bound embedded world book. Bind a character card with character_book to show it here.",
  "world.diagnostics": "Runtime diagnostics ({count})",
  "world.confirmDelete": "Delete standalone world book \u201C{name}\u201D? Character-card embedded books will not be affected.",
  "world.confirmDiscardChanges": "Discard unsaved changes?",
  "world.confirmDeleteEntry": "Delete this world-book entry? It takes effect after saving.",
  "world.confirmDeleteEmbeddedEntry": "Delete this embedded character-card world-book entry? It takes effect after saving.",
  "world.confirmDeleteInfoEntry": "Delete this World Info entry? It will be written to the character-card copy only after saving.",
  "world.confirmReloadInfo": "Discard unsaved entry changes and reload?",
  "world.status.loaded": "World-book library loaded",
  "world.status.refreshed": "World-book library refreshed",
  "world.status.detailsLoaded": "World-book details loaded",
  "world.status.created": "Standalone world book created; not yet bound to the current session",
  "world.status.imported": "World book imported; not yet bound to the current session",
  "world.status.saved": "World-book changes saved; future requests will use the new content",
  "world.status.bindingSaved": "World-book binding saved for the current session",
  "world.status.deleted": "Standalone world book deleted and related session bindings cleared",
  "world.status.embeddedSaved": "Embedded character world book saved; future requests will use the new content",
  "world.error.needSession": "Create or open a session before binding world books",
  "user.title": "Tavern user",
  "user.create": "New user",
  "user.browse": "Browse user resources",
  "user.libraryEmpty": "User library is empty",
  "user.sessionBinding": "Current session: {session}; Binding: {name}",
  "user.dirty": "Unsaved changes: {parts}.",
  "user.dirty.name": "Name/description",
  "user.dirty.binding": "User world-book binding",
  "user.savedNote": "The displayed user resource and world-book binding are saved.",
  "user.loading": "Loading user resources\u2026",
  "user.emptyHint": "Create a user resource containing only a name and description.",
  "user.name": "Name (used by the {macro} macro)",
  "user.description": "Description (placed at the personaDescription marker, with a stable loader fallback)",
  "user.saveResource": "Save resource (unsaved)",
  "user.resourceSaved": "Resource saved",
  "user.saveFirst": "Save changes first",
  "user.refreshBinding": "Refresh session binding",
  "user.bind": "Bind to current session",
  "user.worldBooksTitle": "Standalone world books bound to this user",
  "user.worldBooksHint": "When this user is selected, the loader combines these books with the session\u2019s explicit world books; a duplicate book runs only once.",
  "user.worldBooksLoading": "Loading the standalone world-book library\u2026",
  "user.worldBooksEmpty": "The standalone world-book library is empty. Create or import one in the world-book panel first.",
  "user.saveWorldBooks": "Save world-book binding (unsaved)",
  "user.worldBooksSaved": "World-book binding saved",
  "user.clearPending": "Clear pending selection",
  "user.unbind": "Unbind from current session",
  "user.identityNote": "The user resource remains strictly name and description only; world-book relationships are stored in a separate structured loader policy. User resources have no avatar and do not override the DSH Agent identity.",
  "user.delete": "Delete user",
  "user.defaultName": "New user",
  "user.confirmDelete": "Delete user \u201C{name}\u201D? User selections in every session and this user\u2019s world-book relationships will be cleared.",
  "user.confirmDiscardForCreate": "The current user resource or world-book binding has unsaved changes. Discard them and create a new user?",
  "user.confirmDiscardForSwitch": "The current user resource or world-book binding has unsaved changes. Discard them and switch?",
  "user.confirmHistoricalSwitch": "This session already has history. Changing the user affects only later requests and does not rewrite existing messages. Continue?",
  "user.confirmCloseDirty": "The current user resource or world-book binding has unsaved changes. Close anyway?",
  "user.confirmDiscardRefresh": "Discard unsaved user-resource or world-book binding changes?",
  "user.status.loaded": "User resources loaded",
  "user.status.refreshed": "User resources refreshed",
  "user.status.created": "User created; save its name and description before binding",
  "user.status.saved": "Name and description saved; bound sessions will use them on the next request",
  "user.status.bound": "User bound; the current session will use this name and description on its next request",
  "user.status.unbound": "User unbound from the current session",
  "user.status.deleted": "User deleted and related session bindings cleared",
  "user.status.skippedRefresh": "Other Tavern resources changed. This panel was not refreshed so its unsaved changes are preserved.",
  "user.status.worldBooksSaved": "The user\u2019s world-book binding was saved; sessions using this user will apply it on their next assembly",
  "user.status.userLoaded": "User resource and world-book binding loaded",
  "user.error.needSession": "Create or open a session and select a user resource first",
  "user.error.noSessionToUnbind": "There is no session to unbind",
  "template.title": "New session and configuration templates",
  "template.startCurrent": "Start a new conversation with the current Tavern settings",
  "template.inheritNote": "Carries only the preset, character and greeting/options, user, and standalone world-book selections. DSH history, Tavern Trace, Inbox, active turns/steps, and other runtime state are not copied.",
  "template.noWorkspace": "No DSH target workspace is available. Add or open a workspace in the DSH sidebar first.",
  "template.listTitle": "Configuration templates ({count})",
  "template.selected": "Selected template",
  "template.noneSelected": "No template selected",
  "template.name": "Template name",
  "template.createFromCurrent": "Create from current settings",
  "template.saveNameOnly": "Save name only",
  "template.updateFromCurrent": "Update from current settings",
  "template.delete": "Delete template",
  "template.unusable": "This template cannot currently be used:",
  "template.startFromTemplate": "Start a clean conversation from the selected template",
  "template.ready": "Template and new-session actions are ready.",
  "template.blankSessionNote": "DSH may reuse an existing real blank session in the same workspace; this is its public New Session behavior. The plugin atomically replaces that blank session\u2019s Tavern selection before navigation.",
  "template.preview.title": "Saved Tavern configuration",
  "template.preview.worldBooks": "Standalone world books (binding order)",
  "template.preview.greeting": "Greeting index: {value}",
  "template.preview.systemPrompt": "Character system_prompt: {value}",
  "template.preview.postHistory": "post_history_instructions: {value}",
  "template.defaultName": "New configuration template",
  "template.currentSettingsReminder": "Templates can only be created or updated from the current session\u2019s Tavern settings. Review or change the current configuration in the launcher\u2019s Preset, Character, World book, and User panels, then return here to save it.",
  "template.confirmDelete": "Delete configuration template \u201C{name}\u201D? This will not delete any DSH session.",
  "template.status.selected": "Template selection updated",
  "template.status.created": "Template created: {name}",
  "template.status.renamed": "Template renamed: {name}",
  "template.status.updated": "Template updated from current settings: {name}",
  "template.status.deleted": "Template deleted",
  "template.status.switched": "Switched to clean session: {id}",
  "template.error.needSessionToSave": "Open a session before saving its current Tavern settings",
  "template.error.needTemplate": "Select a template first",
  "template.error.needSessionAndTemplate": "Open a session and select a template first",
  "template.error.needSourceSession": "Open a source session first",
  "template.error.needWorkspace": "The current session is not in a DSH workspace; add it to a workspace first",
  "trace.title": "Tavern Trace",
  "trace.intro": "A loader audit view alongside Conversation and Trajectory. The DSH request/header remains authoritative for the final system, tools, and effective config.",
  "trace.reading": "Reading audit records\u2026",
  "trace.empty": "This session has no Tavern request audit records yet. Send the next message and check again.",
  "trace.privacy": "Privacy boundary: this stores only resource summaries, configured/matched keywords, decision reasons, placement, budgets, and SHA-256 digests\u2014not resource bodies, full system text, chat history, header content, or tool payloads.",
  "trace.unused": "Not used",
  "trace.noSource": "This request has no auditable world-book source.",
  "trace.assembly": "Assembly and insertion",
  "trace.assemblyMeta": "{section} \xB7 order {order} \xB7 {mode} \xB7 {characters} characters \xB7 call config: {config}",
  "trace.worldBookDecisions": "World-book match decisions",
  "trace.historyOnly": "Matching uses durable session history visible during this step\u2019s system assembly; pending input was not appended a second time.",
  "trace.waitingHeader": "Waiting for authoritative header",
  "trace.pendingHeader": "No alignable DSH request/header has been observed; this does not mean the request was sent. The pending record remains after refresh.",
  "trace.round": "Turn {turn} \xB7 Step {step}",
  "trace.roundAttempt": "Turn {turn} \xB7 Step {step} \xB7 Attempt {attempt}",
  "trace.resource.preset": "Preset",
  "trace.resource.character": "Character",
  "trace.resource.user": "User",
  "trace.inserted": "Inserted",
  "trace.rejected": "Rejected",
  "trace.noConfiguredKeywords": "No configured keywords",
  "trace.noKeywordMatches": "No keyword matches",
  "trace.truncated": "; scan input was truncated to the configured limit",
  "trace.reusedHeader": " (reused previous header)",
  "trace.profile.missing": "Not found",
  "trace.profile.consistent": "Consistent",
  "trace.profile.absent": "No profile this request",
  "trace.config.inconsistent": "Inconsistent",
  "trace.config.consistent": "Consistent or no fields",
  "trace.position.approximate": " (approximate)",
  "trace.position.notInserted": " \u2192 not inserted",
  "trace.position.applied": " \u2192 {position}{approximate}",
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
  "trace.reason.constant": "Always-active entry",
  "trace.reason.primary-key-match": "Primary keyword matched",
  "trace.reason.primary-key-miss": "Primary keyword missed",
  "trace.reason.secondary-and_any-match": "Any secondary keyword matched",
  "trace.reason.secondary-and_any-miss": "No secondary keyword matched",
  "trace.reason.secondary-and_all-match": "All secondary keywords matched",
  "trace.reason.secondary-and_all-miss": "Not all secondary keywords matched",
  "trace.reason.secondary-not_any-match": "Secondary exclusion condition passed",
  "trace.reason.secondary-not_any-miss": "Secondary keyword triggered exclusion",
  "trace.reason.secondary-not_all-match": "Secondary not-all condition passed",
  "trace.reason.secondary-not_all-miss": "All secondary keywords matched and excluded the entry",
  "trace.reason.disabled": "Entry disabled",
  "trace.reason.external-vector-match-required": "External vector match required",
  "trace.reason.inclusion-group-loser": "Did not win the inclusion group",
  "trace.reason.probability-failed": "Rejected by probability check",
  "trace.reason.budget-exceeded": "Token budget exceeded",
  "trace.reason.empty-content": "Empty body; not inserted",
  "trace.reason.outlet-unsupported": "Outlet has no stable insertion seam"
});

// packages/client/src/i18n/catalogs/index.js
var PRODUCTION_CATALOGS = Object.freeze({
  "zh-CN": zh_CN_default,
  en: en_default
});

// packages/client/src/i18n/runtime.js
var DEFAULT_UI_SETTINGS = Object.freeze({ locale: DEFAULT_UI_LOCALE, scale: 1, rpFollowCharacter: true });
var UI_SCALE_OPTIONS = Object.freeze([0.75, 0.85, 1, 1.15, 1.25, 1.5]);
var RAW_TEXT = /* @__PURE__ */ Symbol("dsh-tavern.raw-text");
var catalogs = PRODUCTION_CATALOGS;
var current = { ...DEFAULT_UI_SETTINGS };
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function catalogKeys(catalog2) {
  return Object.keys(catalog2 ?? {}).toSorted();
}
function assertCatalogParity(catalog2, locale, expectedKeys = catalogKeys(catalogs[DEFAULT_UI_LOCALE] ?? PRODUCTION_CATALOGS[DEFAULT_UI_LOCALE])) {
  if (!isRecord(catalog2)) throw new TypeError(`UI message catalog ${locale} must be an object`);
  const actual = catalogKeys(catalog2);
  if (JSON.stringify(actual) !== JSON.stringify(expectedKeys)) {
    throw new TypeError(`UI message catalog ${locale} does not have the same keys as ${DEFAULT_UI_LOCALE}`);
  }
  for (const key of actual) {
    if (typeof catalog2[key] !== "string") {
      throw new TypeError(`UI message catalog ${locale} key ${JSON.stringify(key)} must be a string`);
    }
  }
  return true;
}
function assertCompleteMessageCatalogs(source) {
  const expected = catalogKeys(source[DEFAULT_UI_LOCALE]);
  if (expected.length === 0) throw new TypeError(`Missing UI message catalog for ${DEFAULT_UI_LOCALE}`);
  for (const locale of Object.keys(source)) {
    assertCatalogParity(source[locale], locale, expected);
  }
}
assertCompleteMessageCatalogs(PRODUCTION_CATALOGS);
function fill(template, values) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key) => String(values?.[key] ?? ""));
}
function templateFor(key, locale) {
  const currentCatalog = catalogs[locale];
  const defaultCatalog = catalogs[DEFAULT_UI_LOCALE];
  if (typeof currentCatalog?.[key] === "string") return currentCatalog[key];
  if (typeof defaultCatalog?.[key] === "string") return defaultCatalog[key];
  if (typeof defaultCatalog?.["common.unavailable"] === "string") return defaultCatalog["common.unavailable"];
  if (typeof currentCatalog?.["common.unavailable"] === "string") return currentCatalog["common.unavailable"];
  return "";
}
function translate(key, values = {}) {
  return fill(templateFor(key, current.locale), values);
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
function uiMessage(key, values = {}) {
  return rawText(translate(key, values));
}
function statusText(status) {
  if (status?.error && !status.key) return rawText(status.text);
  return uiMessage(status?.key ?? "common.unavailable", status?.values);
}
function uiError(key, values = {}) {
  const error = new Error(translate(key, values));
  error.uiKey = key;
  error.uiValues = values;
  return error;
}
function isRawText(value) {
  return value?.[RAW_TEXT] === true && typeof value.value === "string";
}
function unwrapText(value) {
  return isRawText(value) ? value.value : String(value ?? "");
}
function localizeChild(value) {
  if (isRawText(value)) return value.value;
  if (Array.isArray(value)) return value.map(localizeChild);
  return value;
}
function createLocalizedElement(createElement14) {
  return (type, props, ...children) => {
    let localizedProps = props;
    if (props !== null && props !== void 0) {
      localizedProps = { ...props };
      for (const key of ["title", "aria-label", "placeholder", "alt"]) {
        if (isRawText(localizedProps[key])) localizedProps[key] = localizedProps[key].value;
      }
    }
    return createElement14(type, localizedProps, ...children.map(localizeChild));
  };
}
function getClientUiSettings() {
  return { ...current };
}
function setClientUiSettings(value, { announce = true } = {}) {
  const requested = value?.locale;
  const locale = catalogs[requested] !== void 0 ? requested : isSupportedUiLocale(requested) ? requested : DEFAULT_UI_SETTINGS.locale;
  const numericScale = Number(value?.scale);
  const scale = Number.isFinite(numericScale) && numericScale >= 0.75 && numericScale <= 1.5 ? Number(numericScale.toFixed(2)) : DEFAULT_UI_SETTINGS.scale;
  const rpFollowCharacter = value?.rpFollowCharacter !== false;
  current = { locale, scale, rpFollowCharacter };
  if (announce && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLIENT_UI_SETTINGS_EVENT, { detail: getClientUiSettings() }));
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
function announceTavernRefresh() {
  window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT, { detail: { source: "preset" } }));
}
var ST_NUMBER_FIELDS = [
  ["top_p", "preset.sampling.topP"],
  ["top_k", "preset.sampling.topK"],
  ["top_a", "preset.sampling.topA"],
  ["min_p", "preset.sampling.minP"],
  ["frequency_penalty", "preset.sampling.frequencyPenalty"],
  ["presence_penalty", "preset.sampling.presencePenalty"],
  ["repetition_penalty", "preset.sampling.repetitionPenalty"],
  ["seed", "preset.sampling.seed"]
];
var css = `
.dtt-root{height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dtt-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dtt-title{font-size:16px;font-weight:650;flex:1;min-width:0}.dtt-active{font-size:13px;color:var(--dsw-alias-state-success);margin-left:7px}
.dtt-icon{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtt-icon:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtt-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.dtt-toolbar,.dtt-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtt-button{height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:0 10px;font-size:13px}.dtt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtt-button:disabled{opacity:.5;cursor:default}.dtt-button-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtt-danger{color:var(--dsw-alias-state-error)}
.dtt-field{display:flex;flex-direction:column;gap:5px}.dtt-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtt-input,.dtt-select,.dtt-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}.dtt-input,.dtt-select{height:36px;padding:0 9px}.dtt-textarea{min-height:110px;resize:vertical;padding:8px;line-height:1.5}.dtt-input:focus,.dtt-select:focus,.dtt-textarea:focus{border-color:var(--dsw-alias-state-business-primary)}
.dtt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.dtt-section{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtt-section-title{font-size:14px;font-weight:650;display:flex;align-items:center;justify-content:space-between}
.dtt-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dtt-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);word-break:break-word}.dtt-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtt-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}
.dtt-prompts{display:flex;flex-direction:column;gap:7px}.dtt-prompt{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden;transition:border-color .12s,box-shadow .12s}.dtt-prompt[data-dragging=true]{height:4px;min-height:4px;margin:5px 10px;border:0;border-radius:999px;background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 25%,transparent)}.dtt-prompt[data-dragging=true]>*{opacity:0}.dtt-drop-placeholder{box-sizing:border-box;height:42px;border:2px dashed var(--dsw-alias-state-business-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,transparent);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);font-size:12px;font-weight:600;pointer-events:none}.dtt-prompt-summary{display:flex;align-items:center;gap:7px;padding:8px;cursor:pointer;font-size:13px}.dtt-prompt-summary::marker{color:var(--dsw-alias-label-tertiary)}.dtt-drag{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:grab;padding:1px 2px;font-size:15px;line-height:1;touch-action:none;user-select:none}.dtt-drag:active{cursor:grabbing}.dtt-prompt-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtt-role{font-size:12px;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}.dtt-prompt-body{padding:0 9px 9px;display:flex;flex-direction:column;gap:8px}.dtt-row-actions{display:flex;gap:6px}.dtt-row-actions .dtt-button{height:30px;padding:0 8px;flex:1}
.dtt-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2);display:grid;grid-template-columns:1fr auto;gap:8px}
`;
async function api(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
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
        title: uiMessage("preset.dragOrder"),
        "aria-label": uiMessage("preset.dragNamed", { name: prompt.name || prompt.identifier }),
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
        title: prompt.marker === true ? uiMessage("preset.markerHint") : uiMessage("preset.enablePrompt"),
        onClick: (event) => event.stopPropagation(),
        onChange: (event) => onPatch({ enabled: event.target.checked })
      }),
      h("span", { className: "dtt-prompt-name" }, rawText(prompt.name || prompt.identifier)),
      h("span", { className: "dtt-role" }, rawText(prompt.marker ? "marker" : prompt.role))
    ),
    h(
      "div",
      { className: "dtt-prompt-body" },
      h(Field, { label: uiMessage("common.name") }, h("input", {
        className: "dtt-input",
        value: prompt.name,
        onChange: (event) => onPatch({ name: event.target.value })
      })),
      h(Field, { label: uiMessage("common.role") }, h(
        "select",
        {
          className: "dtt-select",
          value: prompt.role,
          disabled: prompt.marker === true,
          onChange: (event) => onPatch({ role: event.target.value })
        },
        h("option", { value: "system" }, uiMessage("preset.role.system")),
        h("option", { value: "user" }, uiMessage("preset.role.user")),
        h("option", { value: "assistant" }, uiMessage("preset.role.assistant"))
      )),
      h(Field, { label: uiMessage("common.content") }, h("textarea", {
        className: "dtt-textarea",
        value: prompt.content,
        disabled: prompt.marker === true,
        onChange: (event) => onPatch({ content: event.target.value })
      })),
      h(
        "div",
        { className: "dtt-row-actions" },
        h("button", { className: "dtt-button dtt-danger", type: "button", onClick: onDelete }, uiMessage("common.delete"))
      )
    )
  );
}
function DropPlaceholder() {
  return h("div", {
    className: "dtt-drop-placeholder",
    "aria-hidden": true
  }, uiMessage("preset.dropHere"));
}
function insertionBoundary(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-prompt-index]");
  if (target === null) return null;
  const index = Number(target.dataset.promptIndex);
  const bounds = target.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? index : index + 1;
}
function PresetSidebar({ closePanel, openPanel, sessionId, sessionBlank, autoOpen = true }) {
  const [catalog2, setCatalog] = (0, import_react.useState)(null);
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [status, setStatus] = (0, import_react.useState)({ error: false, key: "common.loading" });
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
  const run = (0, import_react.useCallback)(async (operation, successKey) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ error: false, key: successKey });
      return result;
    } catch (error) {
      setStatus(error?.uiKey ? { error: true, key: error.uiKey, values: error.uiValues } : { error: true, text: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const refresh = (0, import_react.useCallback)(async (preferredId) => {
    const generation = ++refreshGeneration.current;
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const data = await api(`/presets${query}`);
    const id = preferredId === void 0 ? data.selectedId ?? data.presets[0]?.id ?? null : preferredId;
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
    setStatus({ error: false, key: "preset.status.syncing" });
    run(() => refresh(), "preset.status.loaded");
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh, run, sessionId]);
  (0, import_react.useEffect)(() => {
    const onRefresh = (event) => {
      if (event.detail?.source === "preset") return;
      run(() => refresh(), "preset.status.refreshed");
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [refresh, run]);
  const browse = (0, import_react.useCallback)((id) => run(async () => {
    const detail = await api(`/presets/${encodeURIComponent(id)}`);
    setDraft(detail.preset);
  }, "preset.status.detailsLoaded"), [run]);
  const bind = (0, import_react.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("preset.error.needSession");
    if (draft === null) throw uiError("preset.error.needPreset");
    if (catalog2?.selectedId !== draft.id && catalog2?.selectedId !== null && sessionBlank === false && !window.confirm(unwrapText(uiMessage("preset.confirmHistoricalSwitch")))) return;
    await api("/select", { method: "POST", body: body({ id: draft.id, sessionId }) });
    await refresh(draft.id);
    announceTavernRefresh();
  }, "preset.status.bound"), [catalog2?.selectedId, draft, refresh, run, sessionBlank, sessionId]);
  const unbind = (0, import_react.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("preset.error.noSessionToUnbind");
    await api("/select", { method: "POST", body: body({ id: null, sessionId }) });
    await refresh(draft?.id);
    announceTavernRefresh();
  }, "preset.status.unbound"), [draft?.id, refresh, run, sessionId]);
  const createPreset = (0, import_react.useCallback)(() => run(async () => {
    const created = await api("/presets", { method: "POST", body: body({ name: translate("preset.defaultName") }) });
    await refresh(created.preset.id);
    announceTavernRefresh();
  }, "preset.status.created"), [refresh, run]);
  const importFile = (0, import_react.useCallback)((file) => run(async () => {
    const content = await file.text();
    const imported = await api("/import", {
      method: "POST",
      body: body({ name: file.name.replace(/\.json$/i, ""), content })
    });
    await refresh(imported.preset.id);
    announceTavernRefresh();
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "preset.status.imported"), [refresh, run]);
  const save = (0, import_react.useCallback)(() => run(async () => {
    const result = await api(`/presets/${encodeURIComponent(draft.id)}`, {
      method: "PUT",
      body: body({ name: draft.name, systemPromptMode: draft.systemPromptMode, sampling: draft.sampling, prompts: draft.prompts })
    });
    setDraft(result.preset);
    await refresh(result.preset.id);
    announceTavernRefresh();
  }, "preset.status.saved"), [draft, refresh, run]);
  const remove = (0, import_react.useCallback)(() => run(async () => {
    if (!window.confirm(unwrapText(uiMessage("preset.confirmDelete", { name: draft.name })))) return;
    await api(`/presets/${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    await refresh();
    announceTavernRefresh();
  }, "preset.status.deleted"), [draft, refresh, run]);
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
      name: translate("preset.defaultPromptName"),
      role: "system",
      content: "",
      enabled: true,
      marker: false,
      systemPrompt: false,
      st: {}
    }]
  }));
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("preset.title")) });
  return h(
    "div",
    { className: "dtt-root" },
    h(
      "div",
      { className: "dtt-header" },
      h("div", { className: "dtt-title" }, uiMessage("preset.title"), catalog2?.selectedId ? h("span", { className: "dtt-active" }, uiMessage("preset.active")) : null),
      h("button", { className: "dtt-icon", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: closePanel }, "\u2715")
    ),
    h(
      "div",
      { className: "dtt-body" },
      h(
        "div",
        { className: "dtt-toolbar" },
        h("button", { className: "dtt-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage("preset.importStJson")),
        h("button", { className: "dtt-button", type: "button", disabled: busy, onClick: createPreset }, uiMessage("preset.create")),
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
      h(Field, { label: uiMessage("preset.browse") }, h(
        "select",
        {
          className: "dtt-select",
          value: draft?.id ?? "",
          disabled: busy || catalog2 === null || catalog2.presets.length === 0,
          onChange: (event) => browse(event.target.value)
        },
        ...catalog2?.presets.length ? [] : [h("option", { key: "empty", value: "" }, uiMessage("preset.libraryEmpty"))],
        ...(catalog2?.presets ?? []).map((preset) => h("option", { key: preset.id, value: preset.id }, rawText(`${preset.name} (${preset.enabledPromptCount}/${preset.promptCount})`)))
      )),
      catalog2 === null ? null : catalog2.selectedId === null ? h("p", { className: "dtt-note" }, uiMessage("preset.unboundNote")) : h("p", { className: "dtt-note" }, uiMessage("preset.currentSessionBound", { name: catalog2.presets.find((item) => item.id === catalog2.selectedId)?.name ?? catalog2.selectedId })),
      draft !== null && draft.id !== catalog2?.selectedId ? h("div", { className: "dtt-status", "data-warning": true }, uiMessage("preset.browsingUnbound", { name: draft.name })) : null,
      h(
        "div",
        { className: "dtt-actions" },
        h("button", { className: "dtt-button dtt-button-primary", type: "button", disabled: busy || !sessionId || draft === null, onClick: bind }, catalog2?.selectedId === draft?.id ? uiMessage("preset.bindUpdate") : uiMessage("preset.bind")),
        h("button", { className: "dtt-button", type: "button", disabled: busy || !sessionId || catalog2?.selectedId == null, onClick: unbind }, uiMessage("preset.unbind"))
      ),
      h("div", { className: "dtt-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      draft === null ? h("p", { className: "dtt-note" }, catalog2 === null ? uiMessage("preset.loading") : uiMessage("preset.emptyHint")) : h(
        "div",
        { className: "dtt-section" },
        h("div", { className: "dtt-section-title" }, uiMessage("preset.basicSettings")),
        h(Field, { label: uiMessage("preset.name") }, h("input", {
          className: "dtt-input",
          value: draft.name,
          onChange: (event) => setDraft((current2) => ({ ...current2, name: event.target.value }))
        })),
        h(
          "div",
          { className: "dtt-grid" },
          h(NumberField, { label: uiMessage("preset.temperature"), value: draft.sampling.temperature, onChange: (temperature) => patchSampling({ temperature }), min: 0 }),
          h(NumberField, { label: uiMessage("preset.maxTokens"), value: draft.sampling.maxTokens, onChange: (maxTokens) => patchSampling({ maxTokens }), min: 1, step: 1 })
        ),
        h(Field, { label: uiMessage("preset.reasoningEffort") }, h(
          "select",
          {
            className: "dtt-select",
            value: draft.sampling.reasoningEffort ?? "",
            onChange: (event) => patchSampling({ reasoningEffort: event.target.value || void 0 })
          },
          h("option", { value: "" }, uiMessage("preset.modelDefault")),
          h("option", { value: "low" }, uiMessage("preset.effort.low")),
          h("option", { value: "medium" }, uiMessage("preset.effort.medium")),
          h("option", { value: "high" }, uiMessage("preset.effort.high")),
          h("option", { value: "xhigh" }, uiMessage("preset.effort.xhigh"))
        )),
        h("button", { className: "dtt-button", type: "button", onClick: () => setAdvanced((value) => !value) }, advanced ? uiMessage("preset.advancedHide") : uiMessage("preset.advancedShow")),
        advanced ? h("div", { className: "dtt-grid" }, ...ST_NUMBER_FIELDS.map(([key, messageKey]) => h(NumberField, {
          key,
          label: uiMessage(messageKey),
          value: draft.sampling.st?.[key],
          onChange: (value) => patchSt(key, value)
        }))) : null,
        advanced ? h("p", { className: "dtt-note" }, uiMessage("preset.advancedNote")) : null,
        advanced ? h(Field, { label: uiMessage("preset.systemPrompt") }, h(
          "select",
          {
            className: "dtt-select",
            value: draft.systemPromptMode === "replace" ? "replace" : "append",
            onChange: (event) => setDraft((current2) => ({ ...current2, systemPromptMode: event.target.value }))
          },
          h("option", { value: "append" }, uiMessage("preset.systemAppend")),
          h("option", { value: "replace" }, uiMessage("preset.systemReplace"))
        )) : null,
        advanced && draft.systemPromptMode === "replace" ? h("p", { className: "dtt-status", "data-error": true }, uiMessage("preset.replaceWarning")) : null,
        h(
          "div",
          { className: "dtt-section" },
          h(
            "div",
            { className: "dtt-section-title" },
            h("span", null, uiMessage("preset.prompts", { count: draft.prompts.length })),
            h("button", { className: "dtt-button", type: "button", onClick: addPrompt }, uiMessage("preset.addPrompt"))
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
          h("button", { className: "dtt-button dtt-button-primary", type: "button", disabled: busy, onClick: save }, busy ? uiMessage("common.working") : uiMessage("common.saveChanges")),
          h("button", { className: "dtt-button dtt-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("common.delete"))
        )
      )
    )
  );
}
function installPresetStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = PLUGIN_ID;
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
    { index: 0, labelKey: first === "" ? "character.greeting.defaultEmpty" : "character.greeting.default", text: first },
    ...alternates.map((text, index) => ({
      index: index + 1,
      labelKey: "character.greeting.alternate",
      labelValues: { index: index + 1 },
      text
    }))
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
function characterBindingOptions(value) {
  const options = value !== null && typeof value === "object" && value.character !== null && typeof value.character === "object" ? value.character : {};
  return {
    greetingIndex: Number(options.greetingIndex ?? 0),
    preferCharacterSystemPrompt: options.preferCharacterSystemPrompt !== false,
    preferCharacterPostHistory: options.preferCharacterPostHistory !== false
  };
}
function characterBindingDirty(selection, binding) {
  if (selection === null || typeof selection !== "object" || binding === null || typeof binding !== "object") return false;
  if (selection.characterCardId !== binding.characterCardId) return false;
  const applied = characterBindingOptions(selection);
  const pending = characterBindingOptions(binding);
  return applied.greetingIndex !== pending.greetingIndex || applied.preferCharacterSystemPrompt !== pending.preferCharacterSystemPrompt || applied.preferCharacterPostHistory !== pending.preferCharacterPostHistory;
}
function characterEditorDraft(character) {
  if (character === null || typeof character !== "object") return null;
  const data = character.data ?? {};
  return {
    name: typeof data.name === "string" ? data.name : "",
    nickname: typeof data.nickname === "string" ? data.nickname : "",
    description: typeof data.description === "string" ? data.description : "",
    personality: typeof data.personality === "string" ? data.personality : "",
    scenario: typeof data.scenario === "string" ? data.scenario : "",
    firstMessage: typeof data.firstMessage === "string" ? data.firstMessage : "",
    alternateGreetings: Array.isArray(data.alternateGreetings) ? data.alternateGreetings.filter((item) => typeof item === "string") : [],
    messageExample: typeof data.messageExample === "string" ? data.messageExample : "",
    creatorNotes: typeof data.creatorNotes === "string" ? data.creatorNotes : "",
    systemPrompt: typeof data.systemPrompt === "string" ? data.systemPrompt : "",
    postHistoryInstructions: typeof data.postHistoryInstructions === "string" ? data.postHistoryInstructions : "",
    tagsText: Array.isArray(data.tags) ? data.tags.filter((item) => typeof item === "string").join(", ") : "",
    creator: typeof data.creator === "string" ? data.creator : "",
    characterVersion: typeof data.characterVersion === "string" ? data.characterVersion : ""
  };
}
function characterEditorDirty(draft, saved) {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}
function characterEditorPatch(draft) {
  return {
    name: draft.name,
    nickname: draft.nickname,
    description: draft.description,
    personality: draft.personality,
    scenario: draft.scenario,
    firstMessage: draft.firstMessage,
    alternateGreetings: [...draft.alternateGreetings],
    messageExample: draft.messageExample,
    creatorNotes: draft.creatorNotes,
    systemPrompt: draft.systemPrompt,
    postHistoryInstructions: draft.postHistoryInstructions,
    tags: draft.tagsText.split(",").map((item) => item.trim()).filter(Boolean),
    creator: draft.creator,
    characterVersion: draft.characterVersion
  };
}

// packages/character/src/client.js
var h2 = createLocalizedElement(import_react2.createElement);
function announceTavernRefresh2() {
  window.dispatchEvent(new CustomEvent(CLIENT_REFRESH_EVENT, { detail: { source: "character" } }));
}
var css2 = `
.dcc-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dcc-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dcc-title{font-size:16px;font-weight:650;flex:1}.dcc-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dcc-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dcc-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dcc-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box}.dcc-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dcc-button:disabled{opacity:.5;cursor:default}.dcc-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dcc-danger{color:var(--dsw-alias-state-error)}.dcc-field{display:flex;flex-direction:column;gap:5px}.dcc-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dcc-select,.dcc-input,.dcc-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.dcc-select,.dcc-input{height:36px;padding:0 9px}.dcc-textarea{min-height:88px;resize:vertical;padding:8px;line-height:1.5}.dcc-note,.dcc-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dcc-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dcc-status[data-error=true]{color:var(--dsw-alias-state-error)}.dcc-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}.dcc-card{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dcc-card-head{display:flex;gap:11px}.dcc-avatar{width:76px;height:100px;object-fit:cover;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-container);flex:none}.dcc-card-title{font-size:16px;font-weight:650;margin:0 0 5px}.dcc-check{display:flex;gap:7px;align-items:flex-start;font-size:13px;line-height:1.4}.dcc-detail{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px}.dcc-detail summary{cursor:pointer;font-size:13px;font-weight:600}.dcc-detail-body{display:flex;flex-direction:column;gap:8px;margin-top:8px}.dcc-diags{margin:7px 0 0;padding-left:18px;font-size:13px;line-height:1.5}.dcc-greetings{display:flex;flex-direction:column;gap:8px}.dcc-greeting-item{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dcc-greeting-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.dcc-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`;
function errorMessage(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return `HTTP ${status}`;
}
async function api2(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
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
function DiagnosticList({ titleKey, items }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return h2(
    "details",
    { className: "dcc-detail" },
    h2("summary", null, uiMessage(titleKey, { count: items.length })),
    h2("ul", { className: "dcc-diags" }, ...items.map((item, index) => h2("li", { key: `${item.code}-${index}` }, rawText(`${item.message}${item.path ? ` [${item.path}]` : ""}`))))
  );
}
function patchDraft(setter, field, value) {
  setter((current2) => current2 === null ? current2 : { ...current2, [field]: value });
}
function CharacterPanel({ sessionId, sessionBlank, close }) {
  const [catalog2, setCatalog] = (0, import_react2.useState)(null);
  const [detail, setDetail] = (0, import_react2.useState)(null);
  const [draft, setDraft] = (0, import_react2.useState)(null);
  const [savedDraft, setSavedDraft] = (0, import_react2.useState)(null);
  const [selection, setSelection] = (0, import_react2.useState)(null);
  const [binding, setBinding] = (0, import_react2.useState)(null);
  const [rp, setRp] = (0, import_react2.useState)({ active: false });
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [status, setStatus] = (0, import_react2.useState)({ error: false, key: "common.loading" });
  const fileRef = (0, import_react2.useRef)(null);
  const refreshGeneration = (0, import_react2.useRef)(0);
  const dirtyRef = (0, import_react2.useRef)(false);
  const dirty = characterEditorDirty(draft, savedDraft);
  dirtyRef.current = dirty;
  const applyCharacter = (0, import_react2.useCallback)((character, currentSelection) => {
    const nextDraft = characterEditorDraft(character);
    setDetail(character);
    setDraft(nextDraft);
    setSavedDraft(nextDraft === null ? null : structuredClone(nextDraft));
    setBinding(currentSelection?.characterCardId === character?.id ? currentSelection : character === null ? null : defaultCharacterSelection(character.id));
  }, []);
  const run = (0, import_react2.useCallback)(async (operation, successKey) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ error: false, key: successKey });
      return result;
    } catch (error) {
      setStatus(error?.uiKey ? { error: true, key: error.uiKey, values: error.uiValues } : { error: true, text: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  const loadDetail = (0, import_react2.useCallback)(async (id) => {
    const generation = ++refreshGeneration.current;
    if (id === null || id === void 0 || id === "") {
      applyCharacter(null, null);
      return;
    }
    const data = await api2(`/characters/${encodeURIComponent(id)}`);
    if (generation !== refreshGeneration.current) return;
    applyCharacter(data.character, selection);
  }, [applyCharacter, selection]);
  const refresh = (0, import_react2.useCallback)(async (preferredId) => {
    const generation = ++refreshGeneration.current;
    const list = await api2("/characters");
    let currentSelection = null;
    let currentRp = { active: false };
    if (sessionId) {
      const selected = await api2(`/character-selection?sessionId=${encodeURIComponent(sessionId)}`);
      currentSelection = selected.selection;
      const rpData = await api2(`/rp-mode?sessionId=${encodeURIComponent(sessionId)}`);
      currentRp = rpData.rp ?? { active: false };
    }
    if (generation !== refreshGeneration.current) return;
    setCatalog(list);
    setSelection(currentSelection);
    setRp(currentRp);
    const id = preferredId ?? currentSelection?.characterCardId ?? list.characters[0]?.id ?? null;
    if (id === null) {
      applyCharacter(null, null);
      return;
    }
    const data = await api2(`/characters/${encodeURIComponent(id)}`);
    if (generation !== refreshGeneration.current) return;
    applyCharacter(data.character, currentSelection);
  }, [applyCharacter, sessionId]);
  (0, import_react2.useEffect)(() => {
    run(() => refresh(), "character.status.loaded");
    return () => {
      refreshGeneration.current += 1;
    };
  }, [refresh, run]);
  (0, import_react2.useEffect)(() => {
    const onRefresh = (event) => {
      if (event.detail?.source === "character") return;
      if (dirtyRef.current) {
        setStatus({ error: false, key: "character.status.skippedRefresh" });
        return;
      }
      run(() => refresh(detail?.id), "character.status.refreshed");
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [detail?.id, refresh, run]);
  (0, import_react2.useEffect)(() => {
    if (!dirty) return void 0;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const create = (0, import_react2.useCallback)(() => {
    if (dirty && !window.confirm(unwrapText(uiMessage("character.confirmDiscardForCreate")))) return;
    run(async () => {
      const data = await api2("/characters", { method: "POST", body: JSON.stringify({ name: translate("character.defaultName") }) });
      await refresh(data.character.id);
      announceTavernRefresh2();
    }, "character.status.created");
  }, [dirty, refresh, run]);
  const importFile = (0, import_react2.useCallback)((file) => run(async () => {
    const response = await fetch(`${API_V1}/characters/import?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(errorMessage(data, response.status));
    await refresh(data.character.id);
    announceTavernRefresh2();
    if (fileRef.current !== null) fileRef.current.value = "";
  }, "character.status.imported"), [refresh, run]);
  const save = (0, import_react2.useCallback)(() => run(async () => {
    if (detail === null || draft === null) return;
    const data = await api2(`/characters/${encodeURIComponent(detail.id)}`, {
      method: "PATCH",
      body: JSON.stringify(characterEditorPatch(draft))
    });
    const nextDraft = characterEditorDraft(data.character);
    setDetail(data.character);
    setDraft(nextDraft);
    setSavedDraft(structuredClone(nextDraft));
    setCatalog((current2) => current2 === null ? current2 : {
      ...current2,
      characters: current2.characters.map((item) => item.id === data.character.id ? { ...item, name: data.character.name } : item)
    });
    setBinding((current2) => {
      if (current2 === null || current2.characterCardId !== data.character.id) return current2;
      const greetings2 = characterGreetingOptions(data.character);
      const maxIndex = Math.max(0, greetings2.length - 1);
      const greetingIndex2 = Math.min(current2.character?.greetingIndex ?? 0, maxIndex);
      return { ...current2, character: { ...current2.character, greetingIndex: greetingIndex2 } };
    });
    announceTavernRefresh2();
  }, "character.status.saved"), [detail, draft, run]);
  const bind = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("character.error.needSession");
    if (dirty) throw uiError("character.error.saveFirst");
    if (selection?.characterCardId !== binding?.characterCardId && sessionBlank === false && !window.confirm(unwrapText(uiMessage("character.confirmHistoricalSwitch")))) return;
    const data = await api2("/character-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, ...binding })
    });
    setSelection(data.selection);
    setBinding(data.selection);
    const rpData = await api2(`/rp-mode?sessionId=${encodeURIComponent(sessionId)}`);
    setRp(rpData.rp ?? { active: false });
    announceTavernRefresh2();
  }, "character.status.bound"), [binding, dirty, run, selection, sessionBlank, sessionId]);
  const unbind = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("character.error.noSessionToUnbind");
    await api2("/character-selection", {
      method: "POST",
      body: JSON.stringify({ sessionId, characterCardId: null })
    });
    await refresh(detail?.id);
  }, "character.status.unbound"), [detail?.id, refresh, run, sessionId]);
  const toggleRp = (0, import_react2.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("character.error.needSession");
    const data = await api2("/rp-mode", {
      method: "PUT",
      body: JSON.stringify({ sessionId, active: rp.active !== true })
    });
    setRp(data.rp ?? { active: rp.active !== true });
    announceTavernRefresh2();
  }, "character.status.rpUpdated"), [rp.active, run, sessionId]);
  const remove = (0, import_react2.useCallback)(() => run(async () => {
    if (detail === null || !window.confirm(unwrapText(uiMessage("character.confirmDelete", { name: detail.name })))) return;
    await api2(`/characters/${encodeURIComponent(detail.id)}`, { method: "DELETE" });
    await refresh(null);
    announceTavernRefresh2();
  }, "character.status.deleted"), [detail, refresh, run]);
  const chooseCharacter = (0, import_react2.useCallback)((id) => {
    if (dirty && !window.confirm(unwrapText(uiMessage("character.confirmDiscardForSwitch")))) return;
    run(() => loadDetail(id), "character.status.detailsLoaded");
  }, [dirty, loadDetail, run]);
  const requestClose = () => {
    if (!dirty || window.confirm(unwrapText(uiMessage("character.confirmCloseDirty")))) close();
  };
  const greetings = characterGreetingOptions(draft === null ? detail : { data: draft });
  const greetingIndex = Math.min(binding?.character?.greetingIndex ?? 0, Math.max(0, greetings.length - 1));
  const boundHere = detail !== null && selection?.characterCardId === detail.id;
  const bindingDirty = characterBindingDirty(selection, binding);
  const activeName = selection === null ? translate("nav.character.empty") : catalog2?.characters.find((item) => item.id === selection.characterCardId)?.name ?? selection.characterCardId;
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("character.title")) });
  const avatarSrc = detail === null ? null : `${API_V1}/characters/${encodeURIComponent(detail.id)}/png`;
  return h2(
    "div",
    { className: "dcc-panel" },
    h2(
      "div",
      { className: "dcc-header" },
      h2("div", { className: "dcc-title" }, uiMessage("character.title")),
      h2("button", { className: "dcc-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: requestClose }, "\u2715")
    ),
    h2(
      "div",
      { className: "dcc-body" },
      h2(
        "div",
        { className: "dcc-toolbar" },
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: create }, uiMessage("character.create")),
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage("character.import")),
        h2("button", { className: "dcc-button", type: "button", disabled: busy, onClick: () => {
          if (dirty && !window.confirm(unwrapText(uiMessage("character.confirmDiscardRefresh")))) return;
          run(() => refresh(detail?.id), "character.status.libraryRefreshed");
        } }, uiMessage("common.refresh")),
        h2("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,.png,application/json,image/png", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      h2(Field2, { label: uiMessage("character.browse") }, h2(
        "select",
        {
          className: "dcc-select",
          value: detail?.id ?? "",
          disabled: busy || catalog2 === null || catalog2.characters.length === 0,
          onChange: (event) => chooseCharacter(event.target.value)
        },
        ...catalog2?.characters.length ? [] : [h2("option", { key: "empty", value: "" }, uiMessage("character.libraryEmpty"))],
        ...(catalog2?.characters ?? []).map((item) => h2("option", { key: item.id, value: item.id }, rawText(item.name)))
      )),
      h2("p", { className: "dcc-note" }, uiMessage("character.sessionBinding", {
        session: sessionId || translate("common.none"),
        name: activeName
      })),
      h2("div", { className: "dcc-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      dirty ? h2("div", { className: "dcc-status", "data-warning": true, role: "status" }, uiMessage("character.dirty")) : detail === null ? null : h2("p", { className: "dcc-note" }, uiMessage("character.savedNote")),
      detail === null || draft === null ? h2("p", { className: "dcc-note" }, catalog2 === null ? uiMessage("character.loading") : uiMessage("character.emptyHint")) : h2(
        "div",
        { className: "dcc-card" },
        h2(
          "div",
          { className: "dcc-card-head" },
          h2("img", { className: "dcc-avatar", src: avatarSrc, alt: uiMessage("character.imageAlt", { name: detail.name }) }),
          h2(
            "div",
            null,
            h2("h3", { className: "dcc-card-title" }, rawText(detail.name)),
            h2("p", { className: "dcc-meta" }, rawText(`${detail.source.format}${detail.source.specVersion ? ` \xB7 ${detail.source.specVersion}` : ""} \xB7 ${detail.source.container}`)),
            h2("p", { className: "dcc-meta" }, rawText(`${draft.creator || translate("common.unknownAuthor")}${draft.characterVersion ? ` \xB7 ${draft.characterVersion}` : ""}`))
          )
        ),
        h2(Field2, { label: uiMessage("common.name") }, h2("input", {
          className: "dcc-input",
          value: draft.name,
          maxLength: 200,
          onChange: (event) => patchDraft(setDraft, "name", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.nickname") }, h2("input", {
          className: "dcc-input",
          value: draft.nickname,
          onChange: (event) => patchDraft(setDraft, "nickname", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.creator") }, h2("input", {
          className: "dcc-input",
          value: draft.creator,
          onChange: (event) => patchDraft(setDraft, "creator", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.characterVersion") }, h2("input", {
          className: "dcc-input",
          value: draft.characterVersion,
          onChange: (event) => patchDraft(setDraft, "characterVersion", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.field.tags") }, h2("input", {
          className: "dcc-input",
          value: draft.tagsText,
          placeholder: uiMessage("character.tagsPlaceholder"),
          onChange: (event) => patchDraft(setDraft, "tagsText", event.target.value)
        })),
        h2(Field2, { label: uiMessage("character.greeting") }, h2("select", {
          className: "dcc-select",
          value: greetingIndex,
          onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, greetingIndex: Number(event.target.value) } }))
        }, ...greetings.map((item) => h2("option", { key: item.index, value: item.index }, uiMessage(item.labelKey, item.labelValues))))),
        h2("label", { className: "dcc-check" }, h2("input", { type: "checkbox", checked: binding?.character?.preferCharacterSystemPrompt !== false, onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, preferCharacterSystemPrompt: event.target.checked } })) }), h2("span", null, uiMessage("character.preferSystem"))),
        h2("label", { className: "dcc-check" }, h2("input", { type: "checkbox", checked: binding?.character?.preferCharacterPostHistory !== false, onChange: (event) => setBinding((current2) => ({ ...current2, character: { ...current2.character, preferCharacterPostHistory: event.target.checked } })) }), h2("span", null, uiMessage("character.preferPostHistory"))),
        boundHere ? bindingDirty ? h2("div", { className: "dcc-status", "data-warning": true, role: "status" }, uiMessage("character.bindingUnsaved")) : h2("p", { className: "dcc-note" }, uiMessage("character.bindingApplied")) : null,
        h2(
          "div",
          { className: "dcc-actions" },
          h2("button", { className: "dcc-button dcc-primary", type: "button", disabled: busy || !dirty, onClick: save }, dirty ? uiMessage("character.saveResource") : uiMessage("character.resourceSaved")),
          h2("button", { className: "dcc-button dcc-primary", type: "button", disabled: busy || !sessionId || dirty || boundHere && !bindingDirty, onClick: bind }, dirty ? uiMessage("character.saveFirst") : boundHere ? bindingDirty ? uiMessage("character.bindUpdate") : uiMessage("character.bindingAppliedButton") : uiMessage("character.bind"))
        ),
        h2("button", { className: "dcc-button", type: "button", disabled: busy || !sessionId || selection === null, onClick: unbind }, uiMessage("character.unbind")),
        h2(
          "label",
          { className: "dcc-check" },
          h2("input", {
            type: "checkbox",
            checked: rp.active === true,
            disabled: busy || !sessionId,
            onChange: toggleRp
          }),
          h2("span", null, uiMessage("character.rpMode"))
        ),
        h2("p", { className: "dcc-note" }, uiMessage("character.rpMode.help")),
        h2("p", { className: "dcc-note" }, uiMessage("character.moduleNote")),
        h2(
          "details",
          { className: "dcc-detail", open: true },
          h2("summary", null, uiMessage("character.field.firstMessage")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", {
            className: "dcc-textarea",
            value: draft.firstMessage,
            onChange: (event) => patchDraft(setDraft, "firstMessage", event.target.value)
          }))
        ),
        h2(
          "details",
          { className: "dcc-detail", open: true },
          h2("summary", null, uiMessage("character.alternateGreetings")),
          h2(
            "div",
            { className: "dcc-detail-body" },
            h2(
              "div",
              { className: "dcc-greetings" },
              ...draft.alternateGreetings.map((text, index) => h2(
                "div",
                { className: "dcc-greeting-item", key: `alt-${index}` },
                h2(
                  "div",
                  { className: "dcc-greeting-head" },
                  h2("span", { className: "dcc-label" }, uiMessage("character.greeting.alternate", { index: index + 1 })),
                  h2("button", {
                    className: "dcc-button dcc-danger",
                    type: "button",
                    disabled: busy,
                    onClick: () => setDraft((current2) => current2 === null ? current2 : {
                      ...current2,
                      alternateGreetings: current2.alternateGreetings.filter((_item, itemIndex) => itemIndex !== index)
                    })
                  }, uiMessage("common.delete"))
                ),
                h2("textarea", {
                  className: "dcc-textarea",
                  value: text,
                  onChange: (event) => setDraft((current2) => {
                    if (current2 === null) return current2;
                    const alternateGreetings = [...current2.alternateGreetings];
                    alternateGreetings[index] = event.target.value;
                    return { ...current2, alternateGreetings };
                  })
                })
              ))
            ),
            h2("button", {
              className: "dcc-button",
              type: "button",
              disabled: busy,
              onClick: () => setDraft((current2) => current2 === null ? current2 : {
                ...current2,
                alternateGreetings: [...current2.alternateGreetings, ""]
              })
            }, uiMessage("character.addGreeting"))
          )
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.creatorNotes")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.creatorNotes, onChange: (event) => patchDraft(setDraft, "creatorNotes", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.description")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.description, onChange: (event) => patchDraft(setDraft, "description", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.personality")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.personality, onChange: (event) => patchDraft(setDraft, "personality", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.scenario")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.scenario, onChange: (event) => patchDraft(setDraft, "scenario", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.messageExamples")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.messageExample, onChange: (event) => patchDraft(setDraft, "messageExample", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.systemPrompt")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.systemPrompt, onChange: (event) => patchDraft(setDraft, "systemPrompt", event.target.value) }))
        ),
        h2(
          "details",
          { className: "dcc-detail" },
          h2("summary", null, uiMessage("character.field.postHistory")),
          h2("div", { className: "dcc-detail-body" }, h2("textarea", { className: "dcc-textarea", value: draft.postHistoryInstructions, onChange: (event) => patchDraft(setDraft, "postHistoryInstructions", event.target.value) }))
        ),
        detail.data.characterBook !== null ? h2("div", { className: "dcc-status" }, uiMessage("character.embeddedBook", { count: Array.isArray(detail.data.characterBook.entries) ? detail.data.characterBook.entries.length : translate("common.unknown") })) : null,
        h2(DiagnosticList, { titleKey: "character.warnings", items: detail.compatibility.warnings }),
        h2(DiagnosticList, { titleKey: "character.unsupported", items: detail.compatibility.unsupportedFeatures }),
        detail.compatibility.unknownMacroNames.length > 0 ? h2("div", { className: "dcc-status" }, uiMessage("character.unknownMacros", { names: detail.compatibility.unknownMacroNames.join(", ") })) : null,
        h2(
          "div",
          { className: "dcc-actions" },
          h2("a", { className: "dcc-button", href: `${API_V1}/characters/${encodeURIComponent(detail.id)}/json`, download: "" }, uiMessage("common.exportJson")),
          h2("a", { className: "dcc-button", href: `${API_V1}/characters/${encodeURIComponent(detail.id)}/png`, download: "" }, uiMessage("character.exportPng"))
        ),
        h2("div", { className: "dcc-footer" }, h2("button", { className: "dcc-button dcc-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("character.delete")))
      )
    )
  );
}
function installCharacterStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-character"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-character`;
  style.textContent = css2;
  document.head.append(style);
}

// packages/world-book-library/src/client.js
var import_react3 = require("react");
var h3 = createLocalizedElement(import_react3.createElement);
var POSITIONS = [
  ["before_character_definition", "world.position.beforeCharacter"],
  ["after_character_definition", "world.position.afterCharacter"],
  ["before_author_note", "world.position.beforeAuthor"],
  ["after_author_note", "world.position.afterAuthor"],
  ["at_depth", "world.position.atDepth"],
  ["before_example_messages", "world.position.beforeExamples"],
  ["after_example_messages", "world.position.afterExamples"],
  ["outlet", "world.position.outlet"]
];
var css3 = `
.dwb-panel{position:absolute;top:0;right:0;bottom:0;width:min(500px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dwb-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dwb-title{font-size:16px;font-weight:650;flex:1}.dwb-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dwb-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:11px}.dwb-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dwb-actions{display:flex;gap:7px;flex-wrap:wrap}.dwb-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.dwb-button:disabled{opacity:.5;cursor:default}.dwb-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dwb-danger{color:var(--dsw-alias-state-error)}.dwb-field{display:flex;flex-direction:column;gap:4px}.dwb-label{font-size:12px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dwb-input,.dwb-select,.dwb-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px 8px}.dwb-input,.dwb-select{height:36px}.dwb-textarea{min-height:110px;resize:vertical;line-height:1.5}.dwb-note,.dwb-meta{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dwb-status{font-size:13px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dwb-status[data-error=true]{color:var(--dsw-alias-state-error)}.dwb-status[data-warning=true]{color:var(--dsw-alias-state-warning,#b46b00)}.dwb-section-title{font-size:15px;font-weight:700;margin:5px 0 0}.dwb-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:8px}.dwb-resource-title{font-size:14px;font-weight:650}.dwb-bindings{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dwb-check{display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.45}.dwb-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;overflow:hidden}.dwb-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:13px}.dwb-entry>summary::-webkit-details-marker{display:none}.dwb-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dwb-entry[data-enabled=true] .dwb-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dwb-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dwb-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px}.dwb-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dwb-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dwb-checks{display:flex;flex-wrap:wrap;gap:10px}.dwb-list{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
.dwb-source-section{border:1px solid var(--dsw-alias-border-l2);border-radius:11px;padding:10px;background:color-mix(in srgb,var(--dsw-specific-tip) 35%,transparent);display:flex;flex-direction:column;gap:9px}.dwb-source-section>.dwb-section-title{margin:0}.dwb-source-section>.dwb-resource{background:var(--dsw-alias-bg-base)}.dwb-source-list{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px}.dwb-source-book{padding-left:2px}.dwb-source-book-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.dwb-source-book-name{min-width:0;font-size:13px;font-weight:620;overflow-wrap:anywhere}.dwb-source-badge{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 7px;font-size:11px;line-height:1.35;color:var(--dsw-alias-label-tertiary);background:var(--dsw-specific-tip)}.dwb-user-bindings{grid-template-columns:1fr}.dwb-user-binding-row{display:flex;align-items:center;gap:7px}.dwb-user-binding-row>.dwb-check{align-items:center;flex:1;min-width:0}.dwb-user-binding-row .dwb-source-badge{margin-left:auto}.dwb-inline-edit{min-height:30px;padding:4px 8px;flex:none}
`;
function errorMessage2(data, status) {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  return `HTTP ${status}`;
}
async function api3(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
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
      h3("span", { className: "dwb-entry-name" }, entry.comment || entry.name ? rawText(entry.comment || entry.name) : uiMessage("world.entry.fallback", { id: entry.id ?? index })),
      h3("span", { className: "dwb-entry-state" }, entry.constant ? uiMessage("world.entry.constant") : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(", ")) : uiMessage("world.entry.noKeywords"))
    ),
    h3(
      "div",
      { className: "dwb-entry-body" },
      h3(Field3, { label: uiMessage("world.entry.title") }, h3("input", { className: "dwb-input", value: entry.comment ?? entry.name ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      h3(Field3, { label: uiMessage("world.entry.primaryKeys") }, h3("input", { className: "dwb-input", value: (entry.keys ?? []).join(", "), onChange: (event) => patch({ keys: parseKeywords(event.target.value) }) })),
      h3(Field3, { label: uiMessage("world.entry.secondaryKeys") }, h3("input", { className: "dwb-input", value: secondaryKeys.join(", "), onChange: (event) => {
        const keys = parseKeywords(event.target.value);
        patch({ secondary_keys: keys, selective: keys.length > 0 });
      } })),
      secondaryKeys.length > 0 ? h3(Field3, { label: uiMessage("world.entry.secondaryLogicShort") }, h3(
        "select",
        {
          className: "dwb-select",
          value: entry.selectiveLogic ?? entry.extensions?.selectiveLogic ?? "and_any",
          onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true, extensions: { ...entry.extensions ?? {}, selectiveLogic: event.target.value } })
        },
        h3("option", { value: "and_any" }, uiMessage("world.logic.andAny")),
        h3("option", { value: "and_all" }, uiMessage("world.logic.andAll")),
        h3("option", { value: "not_any" }, uiMessage("world.logic.notAny")),
        h3("option", { value: "not_all" }, uiMessage("world.logic.notAll"))
      )) : null,
      h3(Field3, { label: uiMessage("world.entry.body") }, h3("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      h3(
        "div",
        { className: "dwb-grid" },
        h3(Field3, { label: uiMessage("world.entry.position") }, h3("select", { className: "dwb-select", value: position, onChange: (event) => {
          const value = Number(event.target.value);
          patch({ position: value === 0 ? "before_char" : value === 1 ? "after_char" : entry.position, extensions: { ...entry.extensions ?? {}, position: value } });
        } }, ...POSITIONS.map(([_value, key], value) => h3("option", { key: value, value }, uiMessage(key))))),
        h3(Field3, { label: uiMessage("world.entry.order") }, h3("input", { className: "dwb-input", type: "number", value: entry.insertion_order ?? 100, onChange: (event) => patch({ insertion_order: Number(event.target.value) }) })),
        h3(Field3, { label: uiMessage("world.entry.probability") }, h3("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? entry.extensions?.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), extensions: { ...entry.extensions ?? {}, probability: Number(event.target.value), useProbability: true } }) }))
      ),
      h3(
        "div",
        { className: "dwb-checks" },
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), uiMessage("common.enable")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), uiMessage("world.entry.constant")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: (entry.case_sensitive ?? entry.extensions?.case_sensitive) === true, onChange: (event) => patch({ case_sensitive: event.target.checked, extensions: { ...entry.extensions ?? {}, case_sensitive: event.target.checked } }) }), uiMessage("world.entry.caseSensitive")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: (entry.match_whole_words ?? entry.extensions?.match_whole_words) === true, onChange: (event) => patch({ match_whole_words: event.target.checked, extensions: { ...entry.extensions ?? {}, match_whole_words: event.target.checked } }) }), uiMessage("world.entry.wholeWord"))
      ),
      h3("div", { className: "dwb-actions" }, h3("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, uiMessage("world.entry.delete")))
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
    comment: translate("world.entry.untitled", { id: uid }),
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
function deriveUserWorldBookSource(active, catalog2) {
  const user = active?.resources?.user ?? null;
  const selection = active?.worldBookSelection ?? {};
  const userBoundIds = Array.isArray(selection.userBoundIds) ? selection.userBoundIds : [];
  const duplicateIds = new Set(Array.isArray(selection.duplicateIds) ? selection.duplicateIds : []);
  const known = new Map([
    ...Array.isArray(catalog2?.worldBooks) ? catalog2.worldBooks : [],
    ...Array.isArray(active?.resources?.worldBooks) ? active.resources.worldBooks : []
  ].map((item) => [item.id, item]));
  return {
    user,
    books: userBoundIds.map((id) => ({
      id,
      name: known.get(id)?.name ?? id,
      duplicate: duplicateIds.has(id)
    }))
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
      h3("span", { className: "dwb-entry-name" }, entry.comment ? rawText(entry.comment) : uiMessage("world.entry.fallback", { id: entry.uid ?? index })),
      h3("span", { className: "dwb-entry-state" }, entry.constant ? uiMessage("world.entry.constant") : (entry.keys ?? []).length > 0 ? rawText(entry.keys.join(", ")) : uiMessage("world.entry.noKeywords"))
    ),
    h3(
      "div",
      { className: "dwb-entry-body" },
      h3(Field3, { label: uiMessage("world.entry.title") }, h3("input", { className: "dwb-input", value: entry.comment ?? "", onChange: (event) => patch({ comment: event.target.value }) })),
      h3(Field3, { label: uiMessage("world.entry.primaryKeys") }, h3("input", { className: "dwb-input", value: (entry.keys ?? []).join(", "), onChange: (event) => patch({ keys: parseKeywords(event.target.value) }) })),
      h3(Field3, { label: uiMessage("world.entry.secondaryKeys") }, h3("input", { className: "dwb-input", value: secondary.join(", "), onChange: (event) => {
        const keys = parseKeywords(event.target.value);
        patch({ secondaryKeys: keys, selective: keys.length > 0 });
      } })),
      secondary.length > 0 ? h3(Field3, { label: uiMessage("world.entry.secondaryLogicShort") }, h3(
        "select",
        { className: "dwb-select", value: entry.selectiveLogic ?? "and_any", onChange: (event) => patch({ selectiveLogic: event.target.value, selective: true }) },
        h3("option", { value: "and_any" }, uiMessage("world.logic.andAny")),
        h3("option", { value: "and_all" }, uiMessage("world.logic.andAll")),
        h3("option", { value: "not_any" }, uiMessage("world.logic.notAny")),
        h3("option", { value: "not_all" }, uiMessage("world.logic.notAll"))
      )) : null,
      h3(Field3, { label: uiMessage("world.entry.body") }, h3("textarea", { className: "dwb-textarea", value: entry.content ?? "", onChange: (event) => patch({ content: event.target.value }) })),
      h3(
        "div",
        { className: "dwb-grid" },
        h3(Field3, { label: uiMessage("world.entry.position") }, h3("select", { className: "dwb-select", value: entry.position, onChange: (event) => patch({ position: event.target.value }) }, ...POSITIONS.map(([value, key]) => h3("option", { key: value, value }, uiMessage(key))))),
        h3(Field3, { label: uiMessage("world.entry.order") }, h3("input", { className: "dwb-input", type: "number", value: entry.insertionOrder ?? 100, onChange: (event) => patch({ insertionOrder: Number(event.target.value) }) })),
        h3(Field3, { label: uiMessage("world.entry.probability") }, h3("input", { className: "dwb-input", type: "number", min: 0, max: 100, value: entry.probability ?? 100, onChange: (event) => patch({ probability: Number(event.target.value), useProbability: true }) }))
      ),
      h3(
        "div",
        { className: "dwb-checks" },
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.enabled === true, onChange: (event) => patch({ enabled: event.target.checked }) }), uiMessage("common.enable")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.constant === true, onChange: (event) => patch({ constant: event.target.checked }) }), uiMessage("world.entry.constant")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.caseSensitive === true, onChange: (event) => patch({ caseSensitive: event.target.checked }) }), uiMessage("world.entry.caseSensitive")),
        h3("label", { className: "dwb-check" }, h3("input", { type: "checkbox", checked: entry.matchWholeWords === true, onChange: (event) => patch({ matchWholeWords: event.target.checked }) }), uiMessage("world.entry.wholeWord"))
      ),
      h3("div", { className: "dwb-actions" }, h3("button", { className: "dwb-button dwb-danger", type: "button", onClick: () => remove(index) }, uiMessage("world.entry.delete")))
    )
  );
}
function WorldBookPanel({ sessionId, close }) {
  const [catalog2, setCatalog] = (0, import_react3.useState)(null);
  const [document2, setDocument] = (0, import_react3.useState)(null);
  const [draft, setDraft] = (0, import_react3.useState)(null);
  const [selection, setSelection] = (0, import_react3.useState)([]);
  const [appliedSelection, setAppliedSelection] = (0, import_react3.useState)([]);
  const [userSelection, setUserSelection] = (0, import_react3.useState)([]);
  const [appliedUserSelection, setAppliedUserSelection] = (0, import_react3.useState)([]);
  const [active, setActive] = (0, import_react3.useState)(null);
  const [embeddedCharacterId, setEmbeddedCharacterId] = (0, import_react3.useState)(null);
  const [embeddedDraft, setEmbeddedDraft] = (0, import_react3.useState)(null);
  const [embeddedDirty, setEmbeddedDirty] = (0, import_react3.useState)(false);
  const [dirty, setDirty] = (0, import_react3.useState)(false);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [status, setStatus] = (0, import_react3.useState)({ error: false, key: "common.loading" });
  const fileRef = (0, import_react3.useRef)(null);
  const standaloneEditorRef = (0, import_react3.useRef)(null);
  const generation = (0, import_react3.useRef)(0);
  const run = (0, import_react3.useCallback)(async (operation, success, values) => {
    setBusy(true);
    try {
      const value = await operation();
      setStatus({ error: false, key: success, values });
      return value;
    } catch (error) {
      setStatus({
        error: true,
        key: error.uiKey,
        values: error.uiValues,
        text: error instanceof Error ? error.message : String(error)
      });
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
    const resolvedUserIds = activeView2.resources?.user === null || activeView2.resources?.user === void 0 ? [] : activeView2.worldBookSelection?.userBoundIds ?? [];
    const userIds = Array.isArray(resolvedUserIds) ? resolvedUserIds : [];
    setCatalog(list);
    setSelection(ids);
    setAppliedSelection(ids);
    setUserSelection(userIds);
    setAppliedUserSelection(userIds);
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
    run(() => refresh(), "world.status.loaded");
    const onRefresh = () => run(() => refresh(), "world.status.refreshed");
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => {
      generation.current += 1;
      window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    };
  }, [refresh, run]);
  const load = (id) => run(async () => {
    const detail = await api3(`/world-books/${encodeURIComponent(id)}`);
    setDocument(detail.worldBook);
    setDraft(structuredClone(detail.worldBook.book));
    setDirty(false);
  }, "world.status.detailsLoaded");
  const editUserBook = async (id) => {
    await load(id);
    requestAnimationFrame(() => standaloneEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const create = () => run(async () => {
    const data = await api3("/world-books", { method: "POST", body: JSON.stringify({ name: translate("world.defaultName") }) });
    await refresh(data.worldBook.id);
  }, "world.status.created");
  const importFile = (file) => run(async () => {
    const response = await fetch(`${API_V1}/world-books/import?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: file
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) throw new Error(errorMessage2(data, response.status));
    if (fileRef.current !== null) fileRef.current.value = "";
    await refresh(data.worldBook.id);
  }, "world.status.imported");
  const save = () => run(async () => {
    const data = await api3(`/world-books/${encodeURIComponent(document2.id)}`, { method: "PATCH", body: JSON.stringify({ book: draft }) });
    setDocument(data.worldBook);
    setDraft(structuredClone(data.worldBook.book));
    setDirty(false);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.saved");
  const saveSelection = () => run(async () => {
    if (!sessionId) throw uiError("world.error.needSession");
    const data = await api3("/world-book-selection", { method: "POST", body: JSON.stringify({ sessionId, worldBookIds: selection }) });
    setSelection(data.selection.worldBookIds);
    setAppliedSelection(data.selection.worldBookIds);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.bindingSaved");
  const saveUserSelection = () => run(async () => {
    const userId = active?.resources?.user?.id;
    if (!userId) throw uiError("world.user.error.noUser");
    const data = await api3(`/users/${encodeURIComponent(userId)}/world-books`, {
      method: "PUT",
      body: JSON.stringify({ worldBookIds: userSelection })
    });
    const ids = data.binding.worldBookIds;
    setUserSelection(ids);
    setAppliedUserSelection(ids);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.user.saveSuccess");
  const remove = () => run(async () => {
    if (document2 === null || !window.confirm(unwrapText(uiMessage("world.confirmDelete", { name: document2.name })))) return;
    await api3(`/world-books/${encodeURIComponent(document2.id)}`, { method: "DELETE" });
    setDocument(null);
    setDraft(null);
    await refresh(null);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.deleted");
  const saveEmbedded = () => run(async () => {
    const data = await api3(`/characters/${encodeURIComponent(embeddedCharacterId)}/world-book`, {
      method: "PATCH",
      body: JSON.stringify({ characterBook: embeddedDraft })
    });
    setEmbeddedDraft(structuredClone(data.character.data.characterBook));
    setEmbeddedDirty(false);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  }, "world.status.embeddedSaved");
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
  const userSelectionDirty = userSelection.length !== appliedUserSelection.length || userSelection.some((id, index) => id !== appliedUserSelection[index]);
  const userSource = deriveUserWorldBookSource(active, catalog2);
  const catalogBooks = Array.isArray(catalog2?.worldBooks) ? catalog2.worldBooks : [];
  const catalogById = new Map(catalogBooks.map((book) => [book.id, book]));
  const userCatalog = [
    ...userSelection.map((id) => catalogById.get(id)).filter(Boolean),
    ...catalogBooks.filter((book) => !userSelection.includes(book.id))
  ];
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("world.title")) });
  return h3(
    "div",
    { className: "dwb-panel" },
    h3("div", { className: "dwb-header" }, h3("div", { className: "dwb-title" }, uiMessage("world.title")), h3("button", { className: "dwb-close", type: "button", onClick: close, title: closeLabel, "aria-label": closeLabel }, "\u2715")),
    h3(
      "div",
      { className: "dwb-body" },
      h3(
        "div",
        { className: "dwb-toolbar" },
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => fileRef.current?.click() }, uiMessage("world.importJson")),
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: create }, uiMessage("world.create")),
        h3("button", { className: "dwb-button", type: "button", disabled: busy, onClick: () => {
          if (!dirty || window.confirm(unwrapText(uiMessage("world.confirmDiscardChanges")))) run(() => refresh(), "world.status.refreshed");
        } }, uiMessage("common.refresh")),
        h3("input", { ref: fileRef, hidden: true, type: "file", accept: ".json,application/json", onChange: (event) => {
          const file = event.target.files?.[0];
          if (file !== void 0) importFile(file);
        } })
      ),
      h3("p", { className: "dwb-note" }, uiMessage("world.currentSession", { session: sessionId || translate("common.none") })),
      h3("div", { className: "dwb-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "standalone" },
        h3("h2", { className: "dwb-section-title" }, uiMessage("world.standalone")),
        h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, uiMessage("world.sessionBinding")),
          catalog2?.worldBooks.length ? h3("div", { className: "dwb-bindings" }, ...catalog2.worldBooks.map((item) => h3(
            "label",
            { className: "dwb-check", key: item.id },
            h3("input", { type: "checkbox", checked: selection.includes(item.id), onChange: (event) => setSelection((current2) => event.target.checked ? [...current2, item.id] : current2.filter((id) => id !== item.id)) }),
            uiMessage("world.catalogItem", { name: item.name, count: item.entryCount })
          ))) : h3("p", { className: "dwb-note" }, uiMessage("world.libraryEmpty")),
          selectionDirty ? h3("div", { className: "dwb-status", "data-warning": true }, uiMessage("world.bindingUnsaved")) : h3("p", { className: "dwb-note" }, uiMessage("world.bindingApplied")),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !sessionId || !selectionDirty, onClick: saveSelection }, selectionDirty ? uiMessage("world.applyBinding") : uiMessage("world.bindingAppliedButton")),
            h3("button", { className: "dwb-button", type: "button", disabled: busy || !sessionId || selection.length === 0, onClick: () => setSelection([]) }, uiMessage("world.clearPending"))
          )
        ),
        h3(Field3, { label: uiMessage("world.browse") }, h3(
          "select",
          { className: "dwb-select", value: document2?.id ?? "", disabled: busy || !catalog2?.worldBooks.length, onChange: (event) => {
            if (!dirty || window.confirm(unwrapText(uiMessage("world.confirmDiscardChanges")))) load(event.target.value);
          } },
          ...catalog2?.worldBooks.length ? [] : [h3("option", { key: "empty", value: "" }, uiMessage("world.catalogEmpty"))],
          ...(catalog2?.worldBooks ?? []).map((item) => h3("option", { key: item.id, value: item.id }, rawText(item.name)))
        )),
        draft === null ? null : h3(
          "div",
          { className: "dwb-resource", ref: standaloneEditorRef },
          h3(Field3, { label: uiMessage("world.bookName") }, h3("input", { className: "dwb-input", value: draft.name ?? "", onChange: (event) => {
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
            } }, uiMessage("world.addEntry")),
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !dirty, onClick: save }, dirty ? uiMessage("common.saveChanges") : uiMessage("common.saved")),
            h3("a", { className: "dwb-button", href: `${API_V1}/world-books/${encodeURIComponent(document2.id)}/json`, download: "" }, uiMessage("common.exportJson")),
            h3("button", { className: "dwb-button dwb-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("world.deleteStandalone"))
          ),
          ...entries.map((entry, index) => h3(EntryEditor, { key: `${String(entry.uid)}-${index}`, entry, index, update: updateEntry, remove: (itemIndex) => {
            if (window.confirm(unwrapText(uiMessage("world.confirmDeleteEntry")))) {
              setDraft((current2) => ({ ...current2, entries: current2.entries.filter((_item, candidate) => candidate !== itemIndex) }));
              setDirty(true);
            }
          } }))
        )
      ),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "user" },
        h3("h2", { className: "dwb-section-title" }, uiMessage("world.user.title")),
        userSource.user === null ? h3("p", { className: "dwb-note" }, uiMessage("world.user.none")) : h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, uiMessage("world.user.current", { name: userSource.user.name || userSource.user.id })),
          userCatalog.length ? h3("div", { className: "dwb-bindings dwb-user-bindings" }, ...userCatalog.map((book) => {
            const checked = userSelection.includes(book.id);
            const wasApplied = appliedUserSelection.includes(book.id);
            const badge = checked && !wasApplied ? uiMessage("world.user.pendingAdd") : !checked && wasApplied ? uiMessage("world.user.pendingRemove") : checked && selection.includes(book.id) ? uiMessage("world.user.duplicate") : checked ? uiMessage("world.user.appended") : null;
            return h3(
              "div",
              { className: "dwb-user-binding-row", key: book.id },
              h3(
                "label",
                { className: "dwb-check" },
                h3("input", {
                  type: "checkbox",
                  checked,
                  onChange: (event) => setUserSelection((current2) => event.target.checked ? [...current2, book.id] : current2.filter((id) => id !== book.id))
                }),
                h3("span", { className: "dwb-source-book-name" }, rawText(book.name)),
                badge === null ? null : h3("span", { className: "dwb-source-badge" }, badge)
              ),
              checked || wasApplied ? h3("button", { className: "dwb-button dwb-inline-edit", type: "button", disabled: busy, onClick: () => editUserBook(book.id) }, uiMessage("world.user.editContent")) : null
            );
          })) : h3("p", { className: "dwb-note" }, uiMessage("world.user.libraryEmpty")),
          userSelectionDirty ? h3("div", { className: "dwb-status", "data-warning": true }, uiMessage("world.user.unsaved")) : h3("p", { className: "dwb-note" }, userSource.books.length === 0 ? uiMessage("world.user.empty") : uiMessage("world.user.saved")),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !userSelectionDirty, onClick: saveUserSelection }, userSelectionDirty ? uiMessage("world.user.save") : uiMessage("world.user.saveApplied")),
            h3("button", { className: "dwb-button", type: "button", disabled: busy || userSelection.length === 0, onClick: () => setUserSelection([]) }, uiMessage("world.user.clear"))
          ),
          h3("p", { className: "dwb-note" }, uiMessage("world.user.order")),
          h3("p", { className: "dwb-note" }, uiMessage("world.user.editHint"))
        )
      ),
      h3(
        "section",
        { className: "dwb-source-section", "data-source": "character" },
        h3("h2", { className: "dwb-section-title" }, uiMessage("world.characterBound")),
        embeddedDraft !== null ? h3(
          "div",
          { className: "dwb-resource" },
          h3("div", { className: "dwb-resource-title" }, embeddedDraft.name || embedded[0]?.name ? rawText(embeddedDraft.name || embedded[0]?.name) : uiMessage("world.embeddedTitle")),
          h3("p", { className: "dwb-note" }, uiMessage("world.embeddedMeta", { count: embeddedEntries.length })),
          h3(
            "div",
            { className: "dwb-actions" },
            h3("button", { className: "dwb-button", type: "button", onClick: () => {
              const ids = embeddedEntries.map((entry) => Number(entry.id)).filter(Number.isSafeInteger);
              const id = ids.length === 0 ? 0 : Math.max(...ids) + 1;
              setEmbeddedDraft((current2) => ({ ...structuredClone(current2), entries: [...current2.entries, { id, keys: [], secondary_keys: [], comment: translate("world.entry.untitled", { id }), content: "", enabled: true, constant: false, selective: false, insertion_order: 100, position: "after_char", extensions: { position: 1, probability: 100, useProbability: true } }] }));
              setEmbeddedDirty(true);
            } }, uiMessage("world.addEmbeddedEntry")),
            h3("button", { className: "dwb-button dwb-primary", type: "button", disabled: busy || !embeddedDirty, onClick: saveEmbedded }, embeddedDirty ? uiMessage("world.saveEmbedded") : uiMessage("world.embeddedSaved"))
          ),
          ...embeddedEntries.map((entry, index) => h3(EmbeddedEntryEditor, { key: `${String(entry.id)}-${index}`, entry, index, update: (itemIndex, value) => {
            setEmbeddedDraft((current2) => {
              const next = structuredClone(current2);
              next.entries[itemIndex] = { ...next.entries[itemIndex], ...value };
              return next;
            });
            setEmbeddedDirty(true);
          }, remove: (itemIndex) => {
            if (window.confirm(unwrapText(uiMessage("world.confirmDeleteEmbeddedEntry")))) {
              setEmbeddedDraft((current2) => ({ ...structuredClone(current2), entries: current2.entries.filter((_item, candidate) => candidate !== itemIndex) }));
              setEmbeddedDirty(true);
            }
          } }))
        ) : h3("p", { className: "dwb-note" }, uiMessage("world.embeddedEmpty"))
      ),
      diagnostics.length > 0 ? h3("details", { className: "dwb-resource" }, h3("summary", { className: "dwb-resource-title" }, uiMessage("world.diagnostics", { count: diagnostics.length })), h3("ul", { className: "dwb-list" }, ...diagnostics.map((item, index) => h3("li", { key: `${item.code}-${index}` }, rawText(item.message))))) : null,
      h3("p", { className: "dwb-note" }, uiMessage("world.matcherNote"))
    )
  );
}
function installWorldBookStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-world-book"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-world-book`;
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
var css4 = `
.dtu-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;font-family:Inter,var(--dsw-font-family),sans-serif}.dtu-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtu-title{font-size:16px;font-weight:650;flex:1}.dtu-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px;font-size:14px}.dtu-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtu-toolbar,.dtu-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtu-button{min-height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:13px}.dtu-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtu-button:disabled{opacity:.5;cursor:default}.dtu-primary{background:var(--dsw-alias-state-business-primary);color:white;border-color:transparent}.dtu-danger{color:var(--dsw-alias-state-error)}.dtu-field{display:flex;flex-direction:column;gap:5px}.dtu-label{font-size:12px;color:var(--dsw-alias-label-tertiary);font-weight:600}.dtu-input,.dtu-textarea,.dtu-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:8px 9px}.dtu-input,.dtu-select{height:36px}.dtu-textarea{min-height:220px;line-height:1.5;resize:vertical}.dtu-note{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtu-status{font-size:13px;line-height:1.45;border-radius:7px;padding:7px 9px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtu-status[data-error=true]{color:var(--dsw-alias-state-error)}.dtu-status[data-warning=true]{color:var(--dsw-alias-state-warning,var(--dsw-alias-label-primary))}.dtu-editor{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;display:flex;flex-direction:column;gap:10px}.dtu-bindings{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:9px}.dtu-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.4}.dtu-section-title{font-size:14px;margin:4px 0 0}.dtu-footer{position:sticky;bottom:-12px;margin:0 -12px -12px;padding:10px 12px;background:var(--dsw-alias-bg-base);border-top:1px solid var(--dsw-alias-border-l2)}
`;
function errorMessage3(data, status) {
  return data?.error?.message ?? data?.error ?? `HTTP ${status}`;
}
async function api4(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const response = await fetch(`${API_V1}${path}`, {
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
  window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
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
  const [status, setStatus] = (0, import_react4.useState)({ error: false, key: "common.loading" });
  const generation = (0, import_react4.useRef)(0);
  const draftId = (0, import_react4.useRef)(null);
  const dirtyRef = (0, import_react4.useRef)(false);
  draftId.current = draft?.id ?? null;
  const dirty = userPanelDirty(draft, savedDraft, worldBookIds, appliedWorldBookIds);
  dirtyRef.current = dirty;
  const resourceDirty = userResourceDirty(draft, savedDraft);
  const bindingDirty = !sameOrderedIds(worldBookIds, appliedWorldBookIds);
  const run = (0, import_react4.useCallback)(async (operation, success, values) => {
    setBusy(true);
    try {
      const result = await operation();
      setStatus({ error: false, key: success, values });
      return result;
    } catch (error) {
      setStatus({
        error: true,
        key: error.uiKey,
        values: error.uiValues,
        text: error instanceof Error ? error.message : String(error)
      });
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
    run(() => refresh(), "user.status.loaded");
    const onRefresh = () => {
      if (dirtyRef.current) {
        setStatus({ error: false, key: "user.status.skippedRefresh" });
        return;
      }
      run(() => refresh(draftId.current), "user.status.refreshed");
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => {
      generation.current += 1;
      window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
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
    if (dirty && !window.confirm(unwrapText(uiMessage("user.confirmDiscardForCreate")))) return;
    run(async () => {
      const data = await api4("/users", { method: "POST", body: JSON.stringify({ name: translate("user.defaultName"), description: "" }) });
      draftId.current = data.user.id;
      await refresh(data.user.id);
      notifyRefresh();
    }, "user.status.created");
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
  }, "user.status.saved"), [draft, run]);
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
  }, "user.status.worldBooksSaved"), [draft, run, worldBookIds]);
  const chooseUser = (0, import_react4.useCallback)((id) => {
    if (dirty && !window.confirm(unwrapText(uiMessage("user.confirmDiscardForSwitch")))) return;
    run(() => refresh(id), "user.status.userLoaded");
  }, [dirty, refresh, run]);
  const bind = (0, import_react4.useCallback)(() => run(async () => {
    if (!sessionId || draft === null) throw uiError("user.error.needSession");
    if (selectedUserId !== draft.id && sessionBlank === false && !window.confirm(unwrapText(uiMessage("user.confirmHistoricalSwitch")))) return;
    const data = await api4("/user-selection", {
      method: "POST",
      body: JSON.stringify({ sessionId, userId: draft.id })
    });
    setSelectedUserId(data.selection.userId);
    notifyRefresh();
  }, "user.status.bound"), [draft, run, selectedUserId, sessionBlank, sessionId]);
  const unbind = (0, import_react4.useCallback)(() => run(async () => {
    if (!sessionId) throw uiError("user.error.noSessionToUnbind");
    await api4("/user-selection", { method: "POST", body: JSON.stringify({ sessionId, userId: null }) });
    setSelectedUserId(null);
    notifyRefresh();
  }, "user.status.unbound"), [run, sessionId]);
  const remove = (0, import_react4.useCallback)(() => run(async () => {
    if (draft === null || !window.confirm(unwrapText(uiMessage("user.confirmDelete", { name: draft.name })))) return;
    await api4(`/users/${encodeURIComponent(draft.id)}`, { method: "DELETE", body: "{}" });
    draftId.current = null;
    await refresh(null);
    notifyRefresh();
  }, "user.status.deleted"), [draft, refresh, run]);
  const activeName = selectedUserId === null ? translate("nav.user.empty") : users?.find((user) => user.id === selectedUserId)?.name ?? selectedUserId;
  const requestClose = () => {
    if (!dirty || window.confirm(unwrapText(uiMessage("user.confirmCloseDirty")))) close();
  };
  const dirtyParts = [
    resourceDirty ? translate("user.dirty.name") : "",
    bindingDirty ? translate("user.dirty.binding") : ""
  ].filter(Boolean);
  const dirtyText = uiMessage("user.dirty", { parts: dirtyParts.join(translate("common.listSeparator")) });
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("user.title")) });
  return h4(
    "div",
    { className: "dtu-panel" },
    h4(
      "div",
      { className: "dtu-header" },
      h4("div", { className: "dtu-title" }, uiMessage("user.title")),
      h4("button", { className: "dtu-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: requestClose }, "\u2715")
    ),
    h4(
      "div",
      { className: "dtu-body" },
      h4(
        "div",
        { className: "dtu-toolbar" },
        h4("button", { className: "dtu-button", type: "button", disabled: busy, onClick: create }, uiMessage("user.create")),
        h4("button", { className: "dtu-button", type: "button", disabled: busy, onClick: () => {
          if (!dirty || window.confirm(unwrapText(uiMessage("user.confirmDiscardRefresh")))) run(() => refresh(draft?.id), "user.status.refreshed");
        } }, uiMessage("common.refresh"))
      ),
      h4(Field4, { label: uiMessage("user.browse") }, h4(
        "select",
        {
          className: "dtu-select",
          value: draft?.id ?? "",
          disabled: busy || users === null || users.length === 0,
          onChange: (event) => chooseUser(event.target.value)
        },
        ...users?.length ? [] : [h4("option", { key: "empty", value: "" }, uiMessage("user.libraryEmpty"))],
        ...(users ?? []).map((user) => h4("option", { key: user.id, value: user.id }, rawText(user.name)))
      )),
      h4("p", { className: "dtu-note" }, uiMessage("user.sessionBinding", { session: sessionId || translate("common.none"), name: activeName })),
      h4("div", { className: "dtu-status", "data-error": status.error || void 0, role: "status", "aria-live": "polite" }, statusText(status)),
      dirty ? h4("div", { className: "dtu-status", "data-warning": true, role: "status" }, dirtyText) : h4("p", { className: "dtu-note" }, uiMessage("user.savedNote")),
      draft === null ? h4("p", { className: "dtu-note" }, users === null ? uiMessage("user.loading") : uiMessage("user.emptyHint")) : h4(
        "div",
        { className: "dtu-editor" },
        h4(Field4, { label: uiMessage("user.name", { macro: "{{user}}" }) }, h4("input", { className: "dtu-input", value: draft.name, maxLength: 200, onChange: (event) => setDraft((current2) => ({ ...current2, name: event.target.value })) })),
        h4(Field4, { label: uiMessage("user.description") }, h4("textarea", { className: "dtu-textarea", value: draft.description, maxLength: 1e5, onChange: (event) => setDraft((current2) => ({ ...current2, description: event.target.value })) })),
        h4(
          "div",
          { className: "dtu-actions" },
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !resourceDirty, onClick: save }, resourceDirty ? uiMessage("user.saveResource") : uiMessage("user.resourceSaved")),
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !sessionId || dirty, onClick: bind }, dirty ? uiMessage("user.saveFirst") : selectedUserId === draft.id ? uiMessage("user.refreshBinding") : uiMessage("user.bind"))
        ),
        h4("h2", { className: "dtu-section-title" }, uiMessage("user.worldBooksTitle")),
        h4("p", { className: "dtu-note" }, uiMessage("user.worldBooksHint")),
        worldBooks?.length ? h4("div", { className: "dtu-bindings" }, ...worldBooks.map((book) => h4(
          "label",
          { className: "dtu-check", key: book.id },
          h4("input", {
            type: "checkbox",
            checked: worldBookIds.includes(book.id),
            onChange: (event) => setWorldBookIds((current2) => event.target.checked ? [...current2, book.id] : current2.filter((id) => id !== book.id))
          }),
          h4("span", null, uiMessage("world.catalogItem", { name: book.name, count: book.entryCount }))
        ))) : h4("p", { className: "dtu-note" }, worldBooks === null ? uiMessage("user.worldBooksLoading") : uiMessage("user.worldBooksEmpty")),
        h4(
          "div",
          { className: "dtu-actions" },
          h4("button", { className: "dtu-button dtu-primary", type: "button", disabled: busy || !bindingDirty, onClick: saveWorldBooks }, bindingDirty ? uiMessage("user.saveWorldBooks") : uiMessage("user.worldBooksSaved")),
          h4("button", { className: "dtu-button", type: "button", disabled: busy || worldBookIds.length === 0, onClick: () => setWorldBookIds([]) }, uiMessage("user.clearPending"))
        ),
        h4("button", { className: "dtu-button", type: "button", disabled: busy || !sessionId || selectedUserId === null, onClick: unbind }, uiMessage("user.unbind")),
        h4("p", { className: "dtu-note" }, uiMessage("user.identityNote")),
        h4("div", { className: "dtu-footer" }, h4("button", { className: "dtu-button dtu-danger", type: "button", disabled: busy, onClick: remove }, uiMessage("user.delete")))
      )
    )
  );
}
function installUserStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-user"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-user`;
  style.textContent = css4;
  document.head.append(style);
}

// packages/tavern-trace/src/client.js
var import_react5 = require("react");
var h5 = createLocalizedElement(import_react5.createElement);
var TRACE_API = `${API_V1}/traces`;
var css5 = `
.dttrace-root{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Inter,var(--dsw-font-family),sans-serif}
.dttrace-toolbar{min-height:48px;box-sizing:border-box;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;align-items:center;gap:10px;flex:none;zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1))}.dttrace-title{font-size:16px;font-weight:680;flex:1}.dttrace-button{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 10px;font-size:13px;cursor:pointer}.dttrace-button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dttrace-body{flex:1;min-height:0;overflow:auto;padding:12px max(14px,calc((100% - 880px)/2)) 28px}.dttrace-scale{zoom:var(--dtv-trace-scale,1);width:calc(100%/var(--dtv-trace-scale,1));display:flex;flex-direction:column;gap:10px;padding-bottom:8px}.dttrace-note,.dttrace-status{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0}.dttrace-status{padding:9px 10px;border-radius:8px;background:var(--dsw-specific-tip)}.dttrace-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dttrace-record{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);overflow:visible}.dttrace-record>summary{list-style:none;cursor:pointer;padding:10px 12px;display:flex;align-items:center;gap:8px;border-radius:10px}.dttrace-record[open]>summary{border-radius:10px 10px 0 0}.dttrace-record>summary::-webkit-details-marker{display:none}.dttrace-round{font-size:14px;font-weight:670}.dttrace-time{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-left:auto}.dttrace-badge{border-radius:999px;padding:2px 7px;font-size:11px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-secondary)}.dttrace-badge[data-ok=true]{background:color-mix(in srgb,var(--dsw-alias-state-success,#2fa36b) 18%,transparent);color:var(--dsw-alias-state-success,#2fa36b)}
.dttrace-content{border-top:1px solid var(--dsw-alias-border-l1);padding:11px 12px 16px;display:flex;flex-direction:column;gap:10px}.dttrace-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dttrace-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;min-width:0}.dttrace-label{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}.dttrace-value{font-size:13px;font-weight:620;margin-top:3px;overflow-wrap:anywhere}.dttrace-meta{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary);margin-top:3px;overflow-wrap:anywhere}
.dttrace-section{display:flex;flex-direction:column;gap:6px}.dttrace-section-title{font-size:14px;font-weight:670}.dttrace-book{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px}.dttrace-decision{display:grid;grid-template-columns:76px minmax(110px,.7fr) minmax(160px,1.5fr);gap:7px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.45}.dttrace-decision:first-of-type{border-top:0}.dttrace-decision-state{font-weight:650}.dttrace-decision[data-included=true] .dttrace-decision-state{color:var(--dsw-alias-state-success,#2fa36b)}.dttrace-keywords{overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}.dttrace-list{margin:0;padding-left:18px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
@media(max-width:760px){.dttrace-grid{grid-template-columns:1fr}.dttrace-decision{grid-template-columns:70px 1fr}.dttrace-keywords{grid-column:1/-1}}
`;
var reasonLabels = Object.freeze({
  constant: "trace.reason.constant",
  "primary-key-match": "trace.reason.primary-key-match",
  "primary-key-miss": "trace.reason.primary-key-miss",
  "secondary-and_any-match": "trace.reason.secondary-and_any-match",
  "secondary-and_any-miss": "trace.reason.secondary-and_any-miss",
  "secondary-and_all-match": "trace.reason.secondary-and_all-match",
  "secondary-and_all-miss": "trace.reason.secondary-and_all-miss",
  "secondary-not_any-match": "trace.reason.secondary-not_any-match",
  "secondary-not_any-miss": "trace.reason.secondary-not_any-miss",
  "secondary-not_all-match": "trace.reason.secondary-not_all-match",
  "secondary-not_all-miss": "trace.reason.secondary-not_all-miss",
  disabled: "trace.reason.disabled",
  "external-vector-match-required": "trace.reason.external-vector-match-required",
  "inclusion-group-loser": "trace.reason.inclusion-group-loser",
  "probability-failed": "trace.reason.probability-failed",
  "budget-exceeded": "trace.reason.budget-exceeded",
  "empty-content": "trace.reason.empty-content",
  "outlet-unsupported": "trace.reason.outlet-unsupported"
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
  return uiMessage("trace.storage.summary", { limits: parts.join(translate("common.listSeparator")) });
}
function resourceCard(labelKey, value) {
  return h5(
    "div",
    { className: "dttrace-card", key: labelKey },
    h5("div", { className: "dttrace-label" }, uiMessage(labelKey)),
    h5("div", { className: "dttrace-value" }, value?.name ? rawText(value.name) : uiMessage("trace.unused")),
    value?.id ? h5("div", { className: "dttrace-meta" }, rawText(value.id)) : null
  );
}
function keywords(decision) {
  const configuredPrimary = decision.primaryKeys ?? [];
  const configuredSecondary = decision.secondaryKeys ?? [];
  const primary = decision.primaryMatches ?? [];
  const secondary = decision.secondaryMatches ?? [];
  const separator = translate("common.listSeparator");
  const configured = [
    configuredPrimary.length > 0 ? translate("trace.keywords.primary", { values: configuredPrimary.map((value) => JSON.stringify(value)).join(separator) }) : null,
    configuredSecondary.length > 0 ? translate("trace.keywords.secondary", { values: configuredSecondary.map((value) => JSON.stringify(value)).join(separator) }) : null
  ].filter(Boolean).join(" \xB7 ") || translate("trace.noConfiguredKeywords");
  const matched = [
    primary.length > 0 ? translate("trace.keywords.primary", { values: primary.map((value) => JSON.stringify(value)).join(separator) }) : null,
    secondary.length > 0 ? translate("trace.keywords.secondary", { values: secondary.map((value) => JSON.stringify(value)).join(separator) }) : null
  ].filter(Boolean).join(" \xB7 ") || translate("trace.noKeywordMatches");
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
      result: value.appliedPosition ? translate("trace.position.applied", {
        position: value.appliedPosition,
        approximate: value.approximatePosition ? translate("trace.position.approximate") : ""
      }) : translate("trace.position.notInserted")
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
    h5("div", { className: "dttrace-section-title" }, name2 ? rawText(name2) : uiMessage("nav.worldBook")),
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
        h5("div", { className: "dttrace-decision-state" }, item.decision === "included" ? uiMessage("trace.inserted") : uiMessage("trace.rejected")),
        h5(
          "div",
          null,
          h5("div", null, item.entryName ? rawText(item.entryName) : uiMessage("world.entry.fallback", { id: String(item.entryId ?? index + 1) })),
          h5("div", { className: "dttrace-meta" }, reasonLabels[item.reason] ? uiMessage(reasonLabels[item.reason]) : rawText(item.reason))
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
  const reusedHeader = authority.headerReused ? translate("trace.reusedHeader") : "";
  const profileStatus = translate(authority.tavernProfilePresent === false ? "trace.profile.missing" : authority.tavernProfilePresent === true ? "trace.profile.consistent" : "trace.profile.absent");
  const configStatus = translate(authority.tavernCallConfigApplied === false ? "trace.config.inconsistent" : "trace.config.consistent");
  return h5(
    "details",
    { className: "dttrace-record", open: latest },
    h5(
      "summary",
      null,
      h5("span", { className: "dttrace-round" }, uiMessage(record.attempt > 1 ? "trace.roundAttempt" : "trace.round", { turn: record.turn, step: record.step, attempt: record.attempt })),
      h5("span", { className: "dttrace-badge", "data-ok": linked || void 0 }, linked ? rawText(`request/header #${authority.headerEventSeq}`) : uiMessage("trace.waitingHeader")),
      h5("span", { className: "dttrace-time" }, rawText(formatTime(record.recordedAt)))
    ),
    h5(
      "div",
      { className: "dttrace-content" },
      h5("div", { className: "dttrace-status" }, linked ? uiMessage("trace.recordAligned", { sequence: authority.headerEventSeq, reused: reusedHeader, profile: profileStatus, config: configStatus }) : uiMessage("trace.pendingHeader")),
      h5(
        "div",
        { className: "dttrace-grid" },
        resourceCard("trace.resource.preset", record.resources?.preset),
        resourceCard("trace.resource.character", record.resources?.characterCard),
        resourceCard("trace.resource.user", record.resources?.userProfile)
      ),
      h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, uiMessage("trace.assembly")),
        h5("div", { className: "dttrace-meta" }, uiMessage("trace.assemblyMeta", {
          section: record.assembly.profileSection,
          order: record.assembly.profileOrder,
          mode: record.assembly.systemPromptMode,
          characters: record.assembly.systemCharacters,
          config: Object.keys(record.assembly.callConfig ?? {}).join(", ") || translate("common.none")
        }))
      ),
      record.worldBooks?.length > 0 ? h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, uiMessage("trace.worldBookDecisions")),
        h5("div", { className: "dttrace-meta" }, record.activation?.pendingMessageCount > 0 ? uiMessage("trace.activationPending", {
          included: record.activation.includedPendingMessageCount,
          pending: record.activation.pendingMessageCount,
          truncated: record.activation.truncated ? translate("trace.truncated") : ""
        }) : uiMessage("trace.historyOnly")),
        ...record.worldBooks.map((book, index) => h5(WorldBookAudit, { book, key: `${book.resource?.id ?? "book"}-${index}` }))
      ) : h5("div", { className: "dttrace-note" }, uiMessage("trace.noSource")),
      record.diagnostics?.length > 0 ? h5(
        "div",
        { className: "dttrace-section" },
        h5("div", { className: "dttrace-section-title" }, uiMessage("trace.diagnostics", { count: record.diagnostics.length })),
        h5("ul", { className: "dttrace-list" }, ...record.diagnostics.map((item, index) => h5("li", { key: `${item.code}-${index}` }, rawText(`${item.code}: ${item.message}`))))
      ) : null,
      h5("p", { className: "dttrace-note" }, uiMessage("trace.privacy"))
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
    window.addEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
  }, []);
  const records = [...data?.records ?? []].reverse();
  return h5(
    "div",
    {
      className: "dttrace-root",
      lang: uiSettings.locale,
      style: { "--dtv-trace-scale": String(uiSettings.scale) }
    },
    h5(
      "div",
      { className: "dttrace-toolbar" },
      h5("div", { className: "dttrace-title" }, uiMessage("trace.title")),
      h5("button", { className: "dttrace-button", type: "button", onClick: refresh }, uiMessage("common.refresh"))
    ),
    h5(
      "div",
      { className: "dttrace-body" },
      h5(
        "div",
        { className: "dttrace-scale" },
        h5("p", { className: "dttrace-note" }, uiMessage("trace.intro")),
        error ? h5("div", { className: "dttrace-status", "data-error": true }, rawText(error)) : null,
        data === null && !error ? h5("div", { className: "dttrace-status" }, uiMessage("trace.reading")) : null,
        data !== null ? h5("div", { className: "dttrace-status" }, storageStatus(data.storage)) : null,
        records.length === 0 && data !== null ? h5("div", { className: "dttrace-status" }, uiMessage("trace.empty")) : null,
        ...records.map((record, index) => h5(TraceRecord, { record, latest: index === 0, key: record.id }))
      )
    )
  );
}
function installTavernTraceStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-trace"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-trace`;
  style.textContent = css5;
  document.head.append(style);
}
function registerTavernTraceView(ctx) {
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "tavern-trace",
    order: 20,
    label: translate("trace.title"),
    inject: () => ({})
  }, TavernTraceView));
}

// packages/session-template/src/client.js
var import_react6 = require("react");
var h6 = createLocalizedElement(import_react6.createElement);
async function api5(path, options = {}) {
  const response = await fetch(`${API_V1}${path}`, {
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
function resourceValue(resource, emptyKey) {
  return resource === null || resource === void 0 ? uiMessage(emptyKey) : rawText(resource.name || resource.id);
}
function TemplatePreview({ template }) {
  const contents = template?.contents ?? {};
  const character = template?.selection?.character ?? contents.character ?? {};
  const books = Array.isArray(contents.worldBooks) ? contents.worldBooks : [];
  const enabledLabel = character.preferCharacterSystemPrompt === false ? translate("common.disabled") : translate("common.enabled");
  const postHistoryLabel = character.preferCharacterPostHistory === false ? translate("common.disabled") : translate("common.enabled");
  return h6(
    "div",
    { className: "dtv-preview" },
    h6("div", { className: "dtv-preview-title" }, uiMessage("template.preview.title")),
    h6(PreviewRow, { label: uiMessage("nav.preset"), value: resourceValue(contents.preset, "nav.preset.empty"), missing: contents.preset?.missing }),
    h6(PreviewRow, { label: uiMessage("nav.character"), value: resourceValue(contents.characterCard, "nav.character.empty"), missing: contents.characterCard?.missing }),
    contents.characterCard === null || contents.characterCard === void 0 ? null : h6(
      "div",
      { className: "dtv-preview-options" },
      h6("span", null, uiMessage("template.preview.greeting", { value: Number(character.greetingIndex ?? 0) + 1 })),
      h6("span", null, uiMessage("template.preview.systemPrompt", { value: enabledLabel })),
      h6("span", null, uiMessage("template.preview.postHistory", { value: postHistoryLabel }))
    ),
    h6(PreviewRow, { label: uiMessage("nav.user"), value: resourceValue(contents.user, "nav.user.empty"), missing: contents.user?.missing }),
    h6(
      "div",
      { className: "dtv-preview-row dtv-preview-books" },
      h6("span", { className: "dtv-preview-label" }, uiMessage("template.preview.worldBooks")),
      books.length === 0 ? h6("span", { className: "dtv-preview-value" }, uiMessage("nav.worldBook.empty")) : h6("ol", { className: "dtv-preview-list" }, ...books.map((book) => h6("li", { key: book.id, "data-missing": book.missing || void 0 }, rawText(book.name || book.id))))
    )
  );
}
function SessionTemplatePanel({ sessionId, workspaceId, createCleanSession, close }) {
  const [templates, setTemplates] = (0, import_react6.useState)([]);
  const [selectedId, setSelectedId] = (0, import_react6.useState)(null);
  const [name2, setName] = (0, import_react6.useState)(() => translate("template.defaultName"));
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [status, setStatus] = (0, import_react6.useState)({ error: false, key: "template.ready" });
  const selected = templates.find((item) => item.id === selectedId) ?? null;
  const refresh = (0, import_react6.useCallback)(async () => {
    const data = await api5("/session-templates");
    setTemplates(data.templates);
    setSelectedId(data.selectedId);
    const active = data.templates.find((item) => item.id === data.selectedId);
    if (active !== void 0) setName(active.name);
  }, []);
  (0, import_react6.useEffect)(() => {
    refresh().catch((reason) => setStatus({
      error: true,
      key: reason.uiKey,
      values: reason.uiValues,
      text: reason instanceof Error ? reason.message : String(reason)
    }));
    const onRefresh = () => refresh().catch((reason) => setStatus({
      error: true,
      key: reason.uiKey,
      values: reason.uiValues,
      text: reason instanceof Error ? reason.message : String(reason)
    }));
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [refresh]);
  const run = (0, import_react6.useCallback)(async (operation, success) => {
    setBusy(true);
    try {
      const result = await operation();
      const next = typeof success === "function" ? success(result) : success;
      setStatus(typeof next === "string" ? { error: false, key: next } : { error: false, ...next });
      await refresh();
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
      return result;
    } catch (reason) {
      const diagnostics2 = Array.isArray(reason?.diagnostics) ? reason.diagnostics : [];
      setStatus({
        error: true,
        key: reason.uiKey,
        values: reason.uiValues,
        text: diagnostics2[0]?.message ?? (reason instanceof Error ? reason.message : String(reason))
      });
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
  }, "template.status.selected");
  const create = () => run(async () => {
    if (!sessionId) throw uiError("template.error.needSessionToSave");
    return api5("/session-templates", {
      method: "POST",
      body: JSON.stringify({ name: name2, sourceSessionId: sessionId })
    });
  }, (result) => ({ key: "template.status.created", values: { name: result.template.name } }));
  const rename = () => run(async () => {
    if (selectedId === null) throw uiError("template.error.needTemplate");
    return api5(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name2 })
    });
  }, (result) => ({ key: "template.status.renamed", values: { name: result.template.name } }));
  const update = () => run(async () => {
    if (!sessionId || selectedId === null) throw uiError("template.error.needSessionAndTemplate");
    return api5(`/session-templates/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: name2, sourceSessionId: sessionId })
    });
  }, (result) => ({ key: "template.status.updated", values: { name: result.template.name } }));
  const remove = () => {
    if (selectedId === null || !window.confirm(unwrapText(uiMessage("template.confirmDelete", { name: selected?.name ?? selectedId })))) return;
    run(() => api5(`/session-templates/${encodeURIComponent(selectedId)}`, { method: "DELETE", body: JSON.stringify({}) }), "template.status.deleted");
  };
  const start = (mode) => run(async () => {
    if (mode === "current" && !sessionId) throw uiError("template.error.needSourceSession");
    if (workspaceId === null) throw uiError("template.error.needWorkspace");
    const source = mode === "current" ? { mode: "current", sessionId } : { mode: "template", templateId: selectedId };
    if (mode === "template" && selectedId === null) throw uiError("template.error.needTemplate");
    return createCleanSession({ workspaceId, source });
  }, (id) => ({ key: "template.status.switched", values: { id } }));
  const diagnostics = Array.isArray(selected?.diagnostics) ? selected.diagnostics : [];
  const closeLabel = uiMessage("panel.close", { title: unwrapText(uiMessage("template.title")) });
  return h6(
    "div",
    { className: "dtv-panel" },
    h6(
      "div",
      { className: "dtv-header" },
      h6("div", { className: "dtv-title" }, uiMessage("template.title")),
      h6("button", { className: "dtv-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: close }, "\u2715")
    ),
    h6(
      "div",
      { className: "dtv-body" },
      h6("button", {
        className: "dtv-button dtv-primary",
        type: "button",
        disabled: busy || !sessionId || workspaceId === null,
        onClick: () => start("current")
      }, uiMessage("template.startCurrent")),
      h6("p", { className: "dtv-note" }, uiMessage("template.inheritNote")),
      workspaceId === null ? h6("div", { className: "dtv-status", "data-error": true }, uiMessage("template.noWorkspace")) : null,
      h6(
        "div",
        { className: "dtv-resource" },
        h6("div", { className: "dtv-resource-title" }, uiMessage("template.listTitle", { count: templates.length })),
        h6(
          "label",
          { className: "dtv-field" },
          h6("span", { className: "dtv-label" }, uiMessage("template.selected")),
          h6(
            "select",
            { className: "dtv-select", value: selectedId ?? "", disabled: busy, onChange: select },
            h6("option", { value: "" }, uiMessage("template.noneSelected")),
            ...templates.map((template) => h6("option", { key: template.id, value: template.id }, rawText(template.name)))
          )
        ),
        h6(
          "label",
          { className: "dtv-field" },
          h6("span", { className: "dtv-label" }, uiMessage("template.name")),
          h6("input", { className: "dtv-input", value: name2, maxLength: 120, disabled: busy, onChange: (event) => setName(event.target.value) })
        ),
        h6(
          "div",
          { className: "dtv-template-actions" },
          h6("button", { className: "dtv-button", type: "button", disabled: busy || !sessionId, onClick: create }, uiMessage("template.createFromCurrent")),
          h6("button", { className: "dtv-button", type: "button", disabled: busy || selectedId === null, onClick: rename }, uiMessage("template.saveNameOnly")),
          h6("button", { className: "dtv-button", type: "button", disabled: busy || !sessionId || selectedId === null, onClick: update }, uiMessage("template.updateFromCurrent")),
          h6("button", { className: "dtv-button dtv-danger", type: "button", disabled: busy || selectedId === null, onClick: remove }, uiMessage("template.delete"))
        ),
        h6("p", { className: "dtv-note" }, uiMessage("template.currentSettingsReminder")),
        selected === null ? null : h6(TemplatePreview, { template: selected }),
        diagnostics.length === 0 ? null : h6(
          "div",
          { className: "dtv-status", "data-error": true },
          h6("div", null, uiMessage("template.unusable")),
          h6("ul", { className: "dtv-list" }, ...diagnostics.map((item, index) => h6("li", { key: `${item.code}-${index}` }, rawText(item.message))))
        ),
        h6("button", {
          className: "dtv-button dtv-primary",
          type: "button",
          disabled: busy || selectedId === null || diagnostics.length > 0 || workspaceId === null,
          onClick: () => start("template")
        }, uiMessage("template.startFromTemplate"))
      ),
      h6("div", { className: "dtv-status", "data-error": status.error || void 0, role: "status" }, statusText(status)),
      h6("p", { className: "dtv-note" }, uiMessage("template.blankSessionNote"))
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
  { id: "preset", labelKey: "nav.preset", emptyTitleKey: "nav.preset.empty", available: true },
  { id: "character", labelKey: "nav.character", emptyTitleKey: "nav.character.empty", available: true },
  { id: "world-info", labelKey: "nav.worldBook", emptyTitleKey: "nav.worldBook.empty", available: true },
  { id: "regex", labelKey: "nav.regex", emptyTitleKey: "nav.regex.empty", available: true, binding: false, showBinding: false, playOnly: true },
  { id: "user", labelKey: "nav.user", emptyTitleKey: "nav.user.empty", available: true },
  { id: "session-template", labelKey: "nav.sessionTemplate", emptyTitleKey: "nav.sessionTemplate.empty", available: true, binding: false, showBinding: false },
  { id: "settings", labelKey: "nav.settings", emptyTitleKey: "nav.settings.empty", available: true, binding: false, showBinding: false }
]);
var TAVERN_LAUNCHER_SIZE = 44;
var TAVERN_LAUNCHER_PANEL = Object.freeze({ width: 300, height: 376 });
function isRecord2(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function firstRecord(...values) {
  return values.find(isRecord2) ?? null;
}
function firstArray(...values) {
  return values.find(Array.isArray) ?? [];
}
function resourceTitle(resource, fallback = "") {
  if (!isRecord2(resource)) return fallback;
  for (const key of ["name", "title", "displayName", "label"]) {
    if (typeof resource[key] === "string" && resource[key].trim() !== "") return resource[key].trim();
  }
  return fallback;
}
function catalog(snapshot, ...keys) {
  for (const container of [snapshot?.catalog, snapshot?.catalogs]) {
    if (!isRecord2(container)) continue;
    for (const key of keys) {
      if (Array.isArray(container[key])) return container[key];
      if (Array.isArray(container[key]?.items)) return container[key].items;
    }
  }
  return [];
}
function findResourceById(items, id) {
  return items.find((item) => isRecord2(item) && String(item.id ?? item.resourceId ?? "") === String(id)) ?? null;
}
function selectionIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.map((item) => isRecord2(item) ? item.id ?? item.resourceId : item).filter((id) => typeof id === "string" && id !== "" || Number.isSafeInteger(id));
  return ids.filter((id, index) => ids.findIndex((item) => String(item) === String(id)) === index);
}
function singleStatus({ id, resource, items, emptyTitleKey }) {
  const bound = id !== null && id !== void 0 && id !== "";
  const directResource = isRecord2(resource) && (resource.id === void 0 || String(resource.id) === String(id)) ? resource : null;
  const resolved = firstRecord(directResource, bound ? findResourceById(items, id) : null);
  return {
    bound,
    title: bound ? resourceTitle(resolved, String(id)) : null,
    titleKey: bound ? null : emptyTitleKey,
    count: bound ? 1 : 0
  };
}
function launcherResourceStatuses(snapshot) {
  const selection = isRecord2(snapshot?.selection) ? snapshot.selection : {};
  const resources = isRecord2(snapshot?.resources) ? snapshot.resources : {};
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
  const resolvedWorlds = firstArray(resources.worldBooks, resources.worldBook).filter(isRecord2);
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
  const worldTitles = selectedWorlds.map((resource) => resourceTitle(resource, String(resource.id ?? resource.resourceId ?? "")));
  return {
    preset: singleStatus({
      id: presetId,
      resource: presetResource,
      items: catalog(snapshot, "presets", "preset"),
      emptyTitleKey: "nav.preset.empty"
    }),
    character: singleStatus({
      id: characterId,
      resource: characterResource,
      items: catalog(snapshot, "characters", "characterCards", "character"),
      emptyTitleKey: "nav.character.empty"
    }),
    "world-info": {
      bound: selectedWorlds.length > 0,
      count: selectedWorlds.length,
      title: selectedWorlds.length === 0 ? null : selectedWorlds.length === 1 ? worldTitles[0] : worldTitles.join(" \xB7 "),
      titleKey: selectedWorlds.length === 0 ? "nav.worldBook.empty" : null
    },
    user: singleStatus({
      id: userId,
      resource: userResource,
      items: catalog(snapshot, "users", "userProfiles", "personas"),
      emptyTitleKey: "nav.user.empty"
    }),
    "session-template": { bound: false, count: 0, title: null, titleKey: "nav.sessionTemplate.empty" },
    settings: { bound: false, count: 0, title: null, titleKey: "nav.settings.empty" },
    regex: { bound: false, count: 0, title: null, titleKey: "nav.regex.empty" }
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

// packages/client/src/play/chrome.js
function nextChromeMode(mode) {
  return mode === "play" ? "native" : "play";
}
function createChromeClickController({
  getMode,
  persistMode,
  openMenu,
  closeMenu,
  setMode,
  setError = () => {
  }
}) {
  if (typeof getMode !== "function") throw new TypeError("getMode is required");
  if (typeof persistMode !== "function") throw new TypeError("persistMode is required");
  if (typeof openMenu !== "function") throw new TypeError("openMenu is required");
  if (typeof closeMenu !== "function") throw new TypeError("closeMenu is required");
  if (typeof setMode !== "function") throw new TypeError("setMode is required");
  let switching = false;
  let disposed = false;
  const switchMode = async ({ suppressed = false } = {}) => {
    closeMenu();
    if (disposed || suppressed || switching) return false;
    switching = true;
    try {
      const saved = await persistMode(nextChromeMode(getMode()));
      if (disposed) return false;
      setMode(saved.mode);
      setError(null);
      return true;
    } catch (reason) {
      if (!disposed) setError(reason);
      return false;
    } finally {
      switching = false;
    }
  };
  return {
    click({ suppressed = false } = {}) {
      if (disposed || suppressed || switching) return false;
      openMenu();
      return true;
    },
    switchMode,
    dispose() {
      disposed = true;
    }
  };
}

// packages/client/src/play/chat.js
var import_react8 = require("react");

// packages/client/src/play/chat-model.js
function normalizedPath(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/").replace(/\/+$/, "").toLocaleLowerCase() : "";
}
function rootSessionId(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  return typeof value === "string" && value !== "" ? value : null;
}
function adoptedVariant(node) {
  return node?.variants?.find((variant) => variant.id === node.adoptedVariantId) ?? null;
}
function sessionIsInRpWorkspace(workspace, session) {
  if (workspace?.selected !== true || session == null) return false;
  const root = normalizedPath(workspace.rootPath);
  return root !== "" && normalizedPath(session.cwd) === root;
}
function findPlaythroughForSession(sessionId, catalog2, timelines = {}) {
  if (typeof sessionId !== "string" || sessionId === "") return null;
  for (const playthrough of catalog2?.playthroughs ?? []) {
    const timeline = timelines[playthrough.path];
    if (rootSessionId(playthrough) === sessionId) return { playthrough, timeline: timeline ?? null };
    if (timeline?.nodes?.some((node) => node.variants?.some((variant) => variant.sessionId === sessionId))) {
      return { playthrough, timeline };
    }
  }
  return null;
}
async function loadTimelines(client, playthroughs, concurrency = 4) {
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < playthroughs.length) {
      const playthrough = playthroughs[cursor];
      cursor += 1;
      result[playthrough.path] = await client.getTimeline(playthrough);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), playthroughs.length) },
    worker
  ));
  return result;
}
async function loadCurrentPlaythrough(client, session, options = {}) {
  if (client == null) throw new TypeError("playClient.required");
  const workspace = await client.getWorkspace();
  if (!sessionIsInRpWorkspace(workspace, session)) return null;
  const catalog2 = await client.getCatalog();
  const playthroughs = catalog2.playthroughs ?? [];
  const sessionId = session.id ?? session.sessionId;
  const root = playthroughs.find((item) => rootSessionId(item) === sessionId);
  if (root !== void 0) {
    return { workspace, playthrough: root, timeline: await client.getTimeline(root) };
  }
  const timelines = await loadTimelines(client, playthroughs, options.concurrency);
  const match = findPlaythroughForSession(sessionId, catalog2, timelines);
  return match === null ? null : { workspace, ...match };
}
function projectTimelineQa(timeline, messagesBySession = {}) {
  const result = [];
  for (const node of timeline?.nodes ?? []) {
    if (node.kind !== "qa") continue;
    const variant = adoptedVariant(node);
    if (variant === null) continue;
    const messages = messagesBySession[variant.sessionId]?.messages ?? messagesBySession[variant.sessionId] ?? [];
    const within = messages.filter((message) => Number.isSafeInteger(message.seq) && message.seq >= variant.startEventId && message.seq <= variant.endEventId);
    const user = within.find((message) => message.role === "user") ?? null;
    const assistant = [...within].reverse().find((message) => message.role === "assistant") ?? null;
    result.push({
      id: node.id,
      hidden: node.hidden === true,
      userText: user?.text ?? "",
      assistantText: node.displayOverride ?? assistant?.text ?? "",
      originalAssistantText: assistant?.text ?? "",
      displayOverridden: node.displayOverride !== null,
      variant,
      variants: node.variants,
      variantCount: node.variants.length
    });
  }
  return result;
}
function projectGreeting({
  timeline,
  messages,
  selectionResponse,
  characterResponse
} = {}) {
  if ((timeline?.nodes?.length ?? 0) !== 0 || (messages?.length ?? 0) !== 0) return null;
  const selection = selectionResponse?.selection;
  const character = characterResponse?.character;
  if (typeof selection?.characterCardId !== "string" || selection.characterCardId === "" || character?.id !== selection.characterCardId) return null;
  const options = characterGreetingOptions(character);
  if (options.length === 0) return null;
  const requested = Number(selection.character?.greetingIndex ?? 0);
  const selected = options.find((option) => option.index === requested) ?? options[0];
  if (selected.text === "") return null;
  return {
    characterId: character.id,
    characterName: character.data?.nickname || character.data?.name || character.name || character.id,
    index: selected.index,
    text: selected.text,
    options
  };
}
function adjacentGreetingIndex(greeting, direction) {
  const options = greeting?.options ?? [];
  if (options.length === 0) return null;
  const cursor = Math.max(0, options.findIndex((option) => option.index === greeting.index));
  const offset = direction === "previous" ? -1 : 1;
  return options[(cursor + offset + options.length) % options.length].index;
}

// packages/client/src/play/regex.js
var REGEX_PATH = "ui/regex.json";
function isRecord3(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function stringValue(...values) {
  return values.find((value) => typeof value === "string") ?? "";
}
function importedEnabled(value) {
  if (typeof value.enabled === "boolean") return value.enabled;
  if (typeof value.disabled === "boolean") return !value.disabled;
  return true;
}
function normalizeScope(value, fallback = { kind: "global", resourceId: null }) {
  const source = isRecord3(value) ? value : fallback;
  const kind = ["global", "preset", "character"].includes(source.kind) ? source.kind : fallback.kind;
  const resourceId = kind === "global" ? null : stringValue(source.resourceId, fallback.resourceId);
  return { kind, resourceId: resourceId || null };
}
function normalizeTarget(value) {
  return ["user", "assistant", "both"].includes(value) ? value : "assistant";
}
function generatedId() {
  return `regex-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}
function normalizeRegexRule(value, { scope } = {}) {
  if (!isRecord3(value)) throw new TypeError("regex rule must be an object");
  const source = stringValue(value.find, value.findRegex, value.regex);
  return {
    id: stringValue(value.id) || generatedId(),
    name: stringValue(value.name, value.script_name, value.scriptName) || "Regex",
    enabled: importedEnabled(value),
    find: source,
    replace: stringValue(value.replace, value.replaceString, value.replacement),
    flags: stringValue(value.flags),
    target: normalizeTarget(value.target ?? value.placement),
    scope: normalizeScope(value.scope, scope),
    ext: isRecord3(value.ext) ? structuredClone(value.ext) : {}
  };
}
function normalizeRegexDocument(value) {
  if (!isRecord3(value)) throw new TypeError("regex document must be an object");
  const rules = Array.isArray(value.rules) ? value.rules : [];
  return { schemaVersion: 1, rules: rules.map((rule) => normalizeRegexRule(rule)) };
}
function importRegexDocument(value, { scope = { kind: "global", resourceId: null } } = {}) {
  const candidates = Array.isArray(value) ? value : Array.isArray(value?.rules) ? value.rules : Array.isArray(value?.regex_scripts) ? value.regex_scripts : Array.isArray(value?.extensions?.regex_scripts) ? value.extensions.regex_scripts : null;
  if (candidates === null) throw new TypeError("No regex rules were found");
  return candidates.map((rule) => normalizeRegexRule(rule, { scope }));
}
async function getRegexDocument(client) {
  try {
    const file = await client.getFile(REGEX_PATH);
    return normalizeRegexDocument(JSON.parse(file.content));
  } catch (error) {
    if (error?.status === 404 || error?.code === "PLAY_FILE_NOT_FOUND") {
      return { schemaVersion: 1, rules: [] };
    }
    throw error;
  }
}
async function putRegexDocument(client, document2) {
  const normalized = normalizeRegexDocument(document2);
  await client.createDirs("ui");
  await client.putFile(REGEX_PATH, JSON.stringify(normalized, null, 2));
  return normalized;
}
function expression(rule) {
  if (rule.find.startsWith("/")) {
    const closing = rule.find.lastIndexOf("/");
    if (closing > 0) {
      const pattern = rule.find.slice(1, closing);
      const flags = rule.flags || rule.find.slice(closing + 1);
      return new RegExp(pattern, flags);
    }
  }
  return new RegExp(rule.find, rule.flags || "g");
}
function applies(rule, bindings, target) {
  if (!rule.enabled || rule.target !== "both" && rule.target !== target) return false;
  if (rule.scope.kind === "global") return true;
  if (rule.scope.kind === "preset") return rule.scope.resourceId === bindings?.presetId;
  return rule.scope.resourceId === bindings?.characterId;
}
function applyDisplayRegex(text, rules, bindings, target = "assistant") {
  let output = String(text ?? "");
  const diagnostics = [];
  for (const rule of rules ?? []) {
    if (!applies(rule, bindings, target)) continue;
    try {
      output = output.replace(expression(rule), rule.replace);
    } catch (error) {
      diagnostics.push({ ruleId: rule.id, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { text: output, diagnostics };
}

// packages/client/src/play/turn-actions.js
var import_react7 = require("react");

// packages/client/src/play/nodes.js
function nodeById(timeline, nodeId) {
  const index = timeline.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) throw new TypeError(`Unknown timeline node ${nodeId}`);
  return { index, node: timeline.nodes[index] };
}
function replaceNode(timeline, index, node) {
  const nodes = [...timeline.nodes];
  nodes[index] = node;
  return { ...timeline, nodes };
}
function defaultDelay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function defaultId(startEventId, endEventId) {
  const random = globalThis.crypto?.randomUUID?.() ?? Date.now();
  return ["variant", startEventId, endEventId, random].join("-").slice(0, 200);
}
function completedPairAfter(messageState, eventId) {
  if (messageState?.incompleteTurn === true) return null;
  const messages = (messageState?.messages ?? []).filter((message) => Number.isSafeInteger(message.seq) && message.seq > eventId).sort((left, right) => left.seq - right.seq);
  const user = messages.find((message) => message.role === "user");
  if (user === void 0) return null;
  const assistant = [...messages].reverse().find((message) => message.role === "assistant" && message.seq > user.seq);
  return assistant === void 0 ? null : { user, assistant };
}
function createPlayNodeController(client, {
  delay = defaultDelay,
  pollInterval = 500,
  maxPolls = 240,
  idFactory = defaultId
} = {}) {
  if (client == null) throw new TypeError("playClient.required");
  let pending = Promise.resolve();
  const schedule = (operation) => {
    const task = pending.then(operation);
    pending = task.catch(() => {
    });
    return task;
  };
  const update = (playthrough, nodeId, transform) => schedule(async () => {
    const timeline = await client.getTimeline(playthrough);
    const { index, node } = nodeById(timeline, nodeId);
    const next = replaceNode(timeline, index, transform(node));
    await client.putTimeline(playthrough, next);
    return next;
  });
  return {
    setHidden(playthrough, nodeId, hidden) {
      if (typeof hidden !== "boolean") throw new TypeError("hidden must be a boolean");
      return update(playthrough, nodeId, (node) => ({ ...node, hidden }));
    },
    setDisplayOverride(playthrough, nodeId, value) {
      if (value !== null && typeof value !== "string") {
        throw new TypeError("displayOverride must be a string or null");
      }
      return update(playthrough, nodeId, (node) => ({ ...node, displayOverride: value }));
    },
    adoptVariant(playthrough, nodeId, variantId) {
      if (typeof variantId !== "string" || variantId === "") throw new TypeError("variantId is required");
      return schedule(async () => {
        const timeline = await client.getTimeline(playthrough);
        const { index, node } = nodeById(timeline, nodeId);
        const variant = node.variants.find((item) => item.id === variantId);
        if (variant === void 0) throw new TypeError(`Unknown variant ${variantId}`);
        const next = replaceNode(timeline, index, { ...node, adoptedVariantId: variantId });
        await client.putTimeline(playthrough, next);
        const focus = await client.getFocus(playthrough);
        if (focus.sessionId !== variant.sessionId) throw new Error("Saved variant does not match derived focus");
        return { timeline: next, sessionId: variant.sessionId };
      });
    },
    createReplySwipe(playthrough, nodeId) {
      return schedule(async () => {
        const timeline = await client.getTimeline(playthrough);
        const { node } = nodeById(timeline, nodeId);
        const adopted = node.variants.find((item) => item.id === node.adoptedVariantId);
        if (adopted === void 0) throw new TypeError("Adopted variant is missing");
        const source = await client.getMessages(adopted.sessionId);
        const user = source.messages.find((message) => message.role === "user" && message.seq >= adopted.startEventId && message.seq <= adopted.endEventId);
        if (user === void 0 || typeof user.text !== "string" || user.text === "") {
          throw new TypeError("Adopted variant has no reusable user message");
        }
        const forkEventId = Math.max(0, adopted.startEventId - 1);
        const branch = await client.postBranch(adopted.sessionId, forkEventId);
        const newSessionId = branch?.sessionId;
        if (typeof newSessionId !== "string" || newSessionId === "") {
          throw new TypeError("Branch response has no sessionId");
        }
        await client.postUserMessage(newSessionId, user.text);
        let pair = null;
        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          pair = completedPairAfter(await client.getMessages(newSessionId), forkEventId);
          if (pair !== null) break;
          if (attempt + 1 < maxPolls) await delay(pollInterval);
        }
        if (pair === null) throw new Error("Timed out waiting for the swipe reply");
        const latest = await client.getTimeline(playthrough);
        const current2 = nodeById(latest, nodeId);
        const variantId = idFactory(pair.user.seq, pair.assistant.seq, newSessionId);
        const variant = {
          id: variantId,
          sessionId: newSessionId,
          startEventId: pair.user.seq,
          endEventId: pair.assistant.seq
        };
        const nextNode = {
          ...current2.node,
          adoptedVariantId: variantId,
          variants: [...current2.node.variants, variant]
        };
        const next = replaceNode(latest, current2.index, nextNode);
        await client.putTimeline(playthrough, next);
        const focus = await client.getFocus(playthrough);
        if (focus.sessionId !== newSessionId) throw new Error("Saved swipe does not match derived focus");
        return { timeline: next, sessionId: newSessionId, variantId };
      });
    }
  };
}

// packages/client/src/play/turn-actions.js
var h7 = createLocalizedElement(import_react7.createElement);
var controllers = /* @__PURE__ */ new WeakMap();
var css6 = `
.dtv-play-turn-actions{display:flex;align-items:center;gap:2px;min-height:28px}.dtv-play-turn-action{width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;display:grid;place-items:center}.dtv-play-turn-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dtv-play-turn-action:disabled{cursor:default;opacity:.38}.dtv-play-turn-position{padding:0 5px;color:var(--dsw-alias-label-tertiary);font-size:10px}
`;
function installStyles() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-turn-actions"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-turn-actions`;
  style.textContent = css6;
  document.head.append(style);
}
function controller(client) {
  let value = controllers.get(client);
  if (value === void 0) {
    value = createPlayNodeController(client);
    controllers.set(client, value);
  }
  return value;
}
function Action({ icon, label, disabled = false, disabledLabel, onClick }) {
  return h7("button", {
    type: "button",
    className: "dtv-play-turn-action",
    disabled,
    title: disabled ? disabledLabel ?? uiMessage("play.chat.runningDisabled") : label,
    "aria-label": label,
    onClick
  }, icon);
}
function PlayTurnActions({
  turn,
  playthrough,
  playClient,
  openSession,
  running,
  onChanged,
  onError
}) {
  installStyles();
  const [busy, setBusy] = (0, import_react7.useState)(false);
  const disabled = running || busy;
  const position = Math.max(0, turn.variants.findIndex((item) => item.id === turn.variant.id));
  const mutate = async (operation) => {
    if (disabled) return;
    setBusy(true);
    onError("");
    try {
      await operation();
      onChanged();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const adopt = (offset) => mutate(async () => {
    const target = turn.variants[(position + offset + turn.variants.length) % turn.variants.length];
    const result = await controller(playClient).adoptVariant(playthrough, turn.id, target.id);
    openSession(result.sessionId);
  });
  const copy = async () => {
    try {
      if (typeof navigator.clipboard?.writeText !== "function") throw new Error(translate("play.chat.copyUnavailable"));
      await navigator.clipboard.writeText(turn.assistantText);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  if (turn.hidden) {
    return h7(
      "div",
      { className: "dtv-play-turn-actions" },
      h7(Action, {
        icon: "\u25C9",
        label: uiMessage("play.chat.restoreNode"),
        disabled,
        onClick: () => mutate(() => controller(playClient).setHidden(playthrough, turn.id, false))
      })
    );
  }
  return h7(
    "div",
    { className: "dtv-play-turn-actions" },
    h7(Action, { icon: "\u29C9", label: uiMessage("play.chat.copy"), onClick: copy }),
    h7(Action, {
      icon: "\u2039",
      label: uiMessage("play.chat.previousReply"),
      disabled: disabled || turn.variants.length < 2,
      disabledLabel: turn.variants.length < 2 ? uiMessage("play.chat.noOtherReply") : void 0,
      onClick: () => adopt(-1)
    }),
    turn.variants.length < 2 ? null : h7("span", { className: "dtv-play-turn-position" }, `${position + 1}/${turn.variants.length}`),
    h7(Action, {
      icon: "\u203A",
      label: uiMessage("play.chat.nextReply"),
      disabled: disabled || turn.variants.length < 2,
      disabledLabel: turn.variants.length < 2 ? uiMessage("play.chat.noOtherReply") : void 0,
      onClick: () => adopt(1)
    }),
    h7(Action, {
      icon: "\u2726",
      label: uiMessage("play.chat.generateReply"),
      disabled,
      onClick: () => mutate(async () => {
        const result = await controller(playClient).createReplySwipe(playthrough, turn.id);
        openSession(result.sessionId);
      })
    }),
    h7(Action, {
      icon: "\u270E",
      label: uiMessage("play.chat.editDisplay"),
      disabled,
      onClick: () => {
        const value = window.prompt(translate("play.chat.editDisplayPrompt"), turn.assistantText);
        if (value !== null) mutate(() => controller(playClient).setDisplayOverride(playthrough, turn.id, value));
      }
    }),
    turn.displayOverridden ? h7(Action, {
      icon: "\u21BA",
      label: uiMessage("play.chat.restoreOriginal"),
      disabled,
      onClick: () => mutate(() => controller(playClient).setDisplayOverride(playthrough, turn.id, null))
    }) : null,
    h7(Action, {
      icon: "\u2298",
      label: uiMessage("play.chat.hideNode"),
      disabled,
      onClick: () => {
        if (window.confirm(translate("play.chat.hideConfirm"))) {
          mutate(() => controller(playClient).setHidden(playthrough, turn.id, true));
        }
      }
    })
  );
}

// packages/client/src/play/turns.js
function recordedEndSeq(timeline, sessionId) {
  let end = -1;
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) {
      if (variant.sessionId === sessionId) end = Math.max(end, variant.endEventId);
    }
  }
  return end;
}
function defaultId2(prefix, sessionId, startEventId, endEventId) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${startEventId}-${endEventId}-${random}`.slice(0, 200);
}
function appendCompletedTurns(timeline, messageState, sessionId, {
  idFactory = defaultId2
} = {}) {
  if (typeof sessionId !== "string" || sessionId === "") throw new TypeError("sessionId is required");
  if (messageState?.incompleteTurn === true) return { timeline, added: [] };
  const boundary = recordedEndSeq(timeline, sessionId);
  const messages = [...messageState?.messages ?? []].filter((message) => Number.isSafeInteger(message.seq) && message.seq > boundary).sort((left, right) => left.seq - right.seq);
  const added = [];
  let cursor = 0;
  while (cursor < messages.length) {
    while (cursor < messages.length && messages[cursor].role !== "user") cursor += 1;
    if (cursor >= messages.length) break;
    const user = messages[cursor];
    cursor += 1;
    let assistant = null;
    while (cursor < messages.length && messages[cursor].role !== "user") {
      if (messages[cursor].role === "assistant") assistant = messages[cursor];
      cursor += 1;
    }
    if (assistant === null) break;
    const nodeId = idFactory("qa", sessionId, user.seq, assistant.seq);
    const variantId = idFactory("variant", sessionId, user.seq, assistant.seq);
    added.push({
      id: nodeId,
      kind: "qa",
      hidden: false,
      displayOverride: null,
      adoptedVariantId: variantId,
      variants: [{
        id: variantId,
        sessionId,
        startEventId: user.seq,
        endEventId: assistant.seq
      }]
    });
  }
  if (added.length === 0) return { timeline, added };
  return { timeline: { ...timeline, nodes: [...timeline.nodes, ...added] }, added };
}
function createTurnReconciler(client) {
  if (client == null) throw new TypeError("playClient.required");
  let pending = Promise.resolve();
  return function reconcile(sessionId, playthrough) {
    const task = pending.then(async () => {
      const messages = await client.getMessages(sessionId);
      if (messages.incompleteTurn) return { timeline: null, added: [] };
      const timeline = await client.getTimeline(playthrough);
      const next = appendCompletedTurns(timeline, messages, sessionId);
      if (next.added.length === 0) return next;
      await client.putTimeline(playthrough, next.timeline);
      return next;
    });
    pending = task.catch(() => {
    });
    return task;
  };
}

// packages/client/src/play/chat.js
var h8 = createLocalizedElement(import_react8.createElement);
var turnReconcilers = /* @__PURE__ */ new WeakMap();
var css7 = `
.dtv-play-chat{height:100%;min-height:0;box-sizing:border-box;overflow:auto;padding:22px max(18px,calc((100% - 780px)/2)) 36px;color:var(--dsw-alias-label-primary)}
.dtv-play-chat-list{display:flex;flex-direction:column;gap:22px}.dtv-play-chat-row{display:flex;flex-direction:column;gap:8px}.dtv-play-chat-role{font-size:11px;font-weight:700;color:var(--dsw-alias-label-tertiary)}
.dtv-play-chat-bubble{max-width:88%;box-sizing:border-box;border-radius:14px;padding:12px 14px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65}.dtv-play-chat-user{align-self:flex-end;background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-play-chat-assistant{align-self:flex-start;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block))}
.dtv-play-greeting{position:relative;align-self:flex-start;max-width:88%;display:grid;grid-template-columns:30px minmax(0,1fr) 30px;align-items:center;gap:6px}.dtv-play-greeting-text{border-radius:14px;padding:13px 15px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.65}
.dtv-play-greeting-button{width:30px;height:34px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}.dtv-play-greeting-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-greeting-button:disabled{opacity:.4;cursor:default}
.dtv-play-chat-status{margin:16px 0;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,var(--dsw-specific-block));color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.55}.dtv-play-chat-status[data-error=true]{color:var(--dsw-alias-state-error)}
`;
function installStyles2() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-chat"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-chat`;
  style.textContent = css7;
  document.head.append(style);
}
function adoptedSessionIds(timeline, currentSessionId) {
  const ids = /* @__PURE__ */ new Set([currentSessionId]);
  for (const node of timeline?.nodes ?? []) {
    const variant = node.variants?.find((item) => item.id === node.adoptedVariantId);
    if (typeof variant?.sessionId === "string" && variant.sessionId !== "") ids.add(variant.sessionId);
  }
  return [...ids];
}
async function loadMessages(client, sessionIds, concurrency = 4) {
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < sessionIds.length) {
      const sessionId = sessionIds[cursor];
      cursor += 1;
      result[sessionId] = await client.getMessages(sessionId);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sessionIds.length) }, worker));
  return result;
}
function turnReconciler(client) {
  let reconcile = turnReconcilers.get(client);
  if (reconcile === void 0) {
    reconcile = createTurnReconciler(client);
    turnReconcilers.set(client, reconcile);
  }
  return reconcile;
}
async function loadChatState(client, sessionId, playthrough) {
  const reconciled = await turnReconciler(client)(sessionId, playthrough);
  const timeline = reconciled.timeline ?? await client.getTimeline(playthrough);
  const messagesBySession = await loadMessages(client, adoptedSessionIds(timeline, sessionId));
  const selectionResponse = await client.getCharacterSelection(sessionId);
  const characterId = selectionResponse?.selection?.characterCardId;
  const characterResponse = typeof characterId === "string" && characterId !== "" ? await client.getCharacter(characterId) : null;
  const [regexDocument, active] = await Promise.all([
    typeof client.getFile === "function" ? getRegexDocument(client) : { schemaVersion: 1, rules: [] },
    typeof client.getActive === "function" ? client.getActive(sessionId) : null
  ]);
  const bindings = {
    presetId: active?.selection?.presetId ?? null,
    characterId: characterId ?? active?.selection?.characterCardId ?? null
  };
  const regexDiagnostics = [];
  const renderText = (text, target) => {
    const result = applyDisplayRegex(text, regexDocument.rules, bindings, target);
    regexDiagnostics.push(...result.diagnostics);
    return result.text;
  };
  const turns = projectTimelineQa(timeline, messagesBySession).map((turn) => ({
    ...turn,
    userText: renderText(turn.userText, "user"),
    assistantText: renderText(turn.assistantText, "assistant")
  }));
  const greeting = projectGreeting({
    timeline,
    messages: messagesBySession[sessionId]?.messages ?? [],
    selectionResponse,
    characterResponse
  });
  const importContextPath = playthrough?.ext?.pmpDshTavern?.importContextPath;
  let importedTurns = [];
  if (typeof importContextPath === "string" && importContextPath !== "") {
    const imported = JSON.parse((await client.getFile(importContextPath)).content);
    importedTurns = [
      ...typeof imported.greeting === "string" && imported.greeting !== "" ? [{
        id: "import-greeting",
        imported: true,
        hidden: false,
        userText: "",
        assistantText: renderText(imported.greeting, "assistant"),
        originalAssistantText: imported.greeting
      }] : [],
      ...(imported.qa ?? []).map((qa, index) => ({
        id: `import-${index}`,
        imported: true,
        hidden: false,
        userText: renderText(qa.user, "user"),
        assistantText: renderText(qa.assistant, "assistant"),
        originalAssistantText: qa.assistant
      }))
    ];
  }
  return {
    timeline,
    turns: [...importedTurns, ...turns],
    greeting: importedTurns.length > 0 ? null : greeting === null ? null : { ...greeting, text: renderText(greeting.text, "assistant") },
    regexDiagnostics
  };
}
function Greeting({ greeting, busy, change }) {
  const multiple = greeting.options.length > 1;
  return h8(
    "div",
    { className: "dtv-play-chat-row" },
    h8("span", { className: "dtv-play-chat-role" }, rawText(greeting.characterName)),
    h8(
      "div",
      { className: "dtv-play-greeting" },
      h8("button", {
        type: "button",
        className: "dtv-play-greeting-button",
        disabled: busy || !multiple,
        title: uiMessage("play.chat.previousGreeting"),
        "aria-label": uiMessage("play.chat.previousGreeting"),
        onClick: () => change("previous")
      }, "\u2039"),
      h8("div", { className: "dtv-play-greeting-text" }, rawText(greeting.text)),
      h8("button", {
        type: "button",
        className: "dtv-play-greeting-button",
        disabled: busy || !multiple,
        title: uiMessage("play.chat.nextGreeting"),
        "aria-label": uiMessage("play.chat.nextGreeting"),
        onClick: () => change("next")
      }, "\u203A")
    )
  );
}
function Turn({ turn, ...actionProps }) {
  if (turn.hidden) {
    return h8(
      "div",
      { className: "dtv-play-chat-row" },
      h8("p", { className: "dtv-play-chat-status" }, uiMessage("play.chat.hiddenNode")),
      h8(PlayTurnActions, { turn, ...actionProps })
    );
  }
  return h8(
    "div",
    { className: "dtv-play-chat-row" },
    turn.userText === "" ? null : h8("div", { className: "dtv-play-chat-bubble dtv-play-chat-user" }, rawText(turn.userText)),
    turn.assistantText === "" ? null : h8("div", { className: "dtv-play-chat-bubble dtv-play-chat-assistant" }, rawText(turn.assistantText)),
    turn.imported ? null : h8(PlayTurnActions, { turn, ...actionProps })
  );
}
function MowanChatView({ sessionId, useSession, playClient, playthrough, openSession }) {
  installStyles2();
  const sessionRevision = useSession((state2) => `${state2.nodes?.length ?? 0}:${state2.running === true}:${state2.blank === true}`);
  const [revision, setRevision] = (0, import_react8.useState)(0);
  const running = useSession((state2) => state2.running === true);
  const [state, setState] = (0, import_react8.useState)(null);
  const [error, setError] = (0, import_react8.useState)("");
  const [greetingBusy, setGreetingBusy] = (0, import_react8.useState)(false);
  (0, import_react8.useEffect)(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh);
  }, []);
  (0, import_react8.useEffect)(() => {
    let active = true;
    setError("");
    loadChatState(playClient, sessionId, playthrough).then((next) => {
      if (active) setState(next);
    }).catch((reason) => {
      if (!active) return;
      setState(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      active = false;
    };
  }, [playClient, playthrough, revision, sessionId, sessionRevision]);
  const changeGreeting = async (direction) => {
    if (state?.greeting == null || greetingBusy) return;
    const next = adjacentGreetingIndex(state.greeting, direction);
    if (next === null) return;
    setGreetingBusy(true);
    setError("");
    try {
      await playClient.putGreetingIndex(sessionId, next);
      setRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setGreetingBusy(false);
    }
  };
  return h8(
    "div",
    { className: "dtv-play-chat" },
    error === "" ? null : h8("p", { className: "dtv-play-chat-status", "data-error": true }, rawText(error)),
    state === null && error === "" ? h8("p", { className: "dtv-play-chat-status" }, uiMessage("play.chat.loading")) : null,
    state === null ? null : h8(
      "div",
      { className: "dtv-play-chat-list" },
      state.greeting === null ? null : h8(Greeting, { greeting: state.greeting, busy: greetingBusy, change: changeGreeting }),
      ...state.turns.map((turn) => h8(Turn, {
        key: turn.id,
        turn,
        playthrough,
        playClient,
        openSession,
        running,
        onChanged: () => setRevision((value) => value + 1),
        onError: setError
      })),
      state.greeting === null && state.turns.length === 0 ? h8("p", { className: "dtv-play-chat-status" }, uiMessage("play.chat.empty")) : null
    )
  );
}

// packages/client/src/play/io-menu.js
var import_react9 = require("react");

// packages/client/src/play/export.js
function rootSessionId2(playthrough, timeline) {
  const root = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  if (typeof root === "string" && root !== "") return root;
  for (const node of timeline?.nodes ?? []) {
    const variant = node.variants?.find((item) => item.id === node.adoptedVariantId);
    if (typeof variant?.sessionId === "string") return variant.sessionId;
  }
  return null;
}
function allSessionIds(timeline) {
  const result = /* @__PURE__ */ new Set();
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node.variants ?? []) result.add(variant.sessionId);
  }
  return [...result];
}
async function loadMessages2(client, sessionIds, concurrency = 4) {
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < sessionIds.length) {
      const sessionId = sessionIds[cursor];
      cursor += 1;
      result[sessionId] = await client.getMessages(sessionId);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sessionIds.length) }, worker));
  return result;
}
function selectedGreeting(selectionResponse, characterResponse) {
  const selection = selectionResponse?.selection;
  const character = characterResponse?.character;
  if (character?.id !== selection?.characterCardId) return null;
  const options = characterGreetingOptions(character);
  const index = Number(selection.character?.greetingIndex ?? 0);
  const option = options.find((item) => item.index === index) ?? options[0];
  return option?.text ? option.text : null;
}
async function loadPlaythroughExport(client, playthrough) {
  const timeline = await client.getTimeline(playthrough);
  const sessionIds = allSessionIds(timeline);
  const messagesBySession = await loadMessages2(client, sessionIds);
  const root = rootSessionId2(playthrough, timeline);
  const selectionResponse = root === null ? null : await client.getCharacterSelection(root);
  const characterId = selectionResponse?.selection?.characterCardId;
  const characterResponse = typeof characterId === "string" && characterId !== "" ? await client.getCharacter(characterId) : null;
  const turns = projectTimelineQa(timeline, messagesBySession);
  const greeting = selectedGreeting(selectionResponse, characterResponse);
  const [regexDocument, active] = await Promise.all([
    typeof client.getFile === "function" ? getRegexDocument(client) : { schemaVersion: 1, rules: [] },
    root !== null && typeof client.getActive === "function" ? client.getActive(root) : null
  ]);
  const bindings = {
    presetId: active?.selection?.presetId ?? null,
    characterId: characterId ?? active?.selection?.characterCardId ?? null
  };
  const render = (text, target) => applyDisplayRegex(text, regexDocument.rules, bindings, target).text;
  return {
    playthrough,
    timeline,
    messagesBySession,
    turns,
    displayTurns: turns.map((turn) => ({
      ...turn,
      userText: render(turn.userText, "user"),
      assistantText: render(turn.assistantText, "assistant")
    })),
    character: characterResponse?.character ?? null,
    greeting,
    displayGreeting: greeting === null ? null : render(greeting, "assistant"),
    exportedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function staticHtmlExport(snapshot) {
  const title = snapshot.playthrough.title || snapshot.character?.name || snapshot.playthrough.id;
  const rows = (snapshot.displayTurns ?? snapshot.turns).filter((turn) => !turn.hidden).map((turn) => `
    <article class="turn">
      <div class="user">${escapeHtml(turn.userText)}</div>
      <div class="assistant">${escapeHtml(turn.assistantText)}</div>
    </article>`).join("");
  const displayGreeting = snapshot.displayGreeting ?? snapshot.greeting;
  const greeting = displayGreeting === null || displayGreeting === void 0 ? "" : `<div class="assistant greeting">${escapeHtml(displayGreeting)}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{max-width:800px;margin:32px auto;padding:0 18px;background:#101216;color:#e8eaf0;font:15px/1.65 system-ui}.turn{display:flex;flex-direction:column;gap:10px;margin:24px 0}.user,.assistant{padding:12px 15px;border-radius:14px;white-space:pre-wrap}.user{align-self:flex-end;background:#1c3651}.assistant{align-self:flex-start;background:#24262d}.greeting{margin:24px 0}</style></head><body><h1>${escapeHtml(title)}</h1>${greeting}${rows}</body></html>`;
}
function sillyTavernJsonlExport(snapshot) {
  const characterName = snapshot.character?.data?.name || snapshot.character?.name || "Assistant";
  const lines = [JSON.stringify({
    user_name: "User",
    character_name: characterName,
    create_date: snapshot.exportedAt,
    chat_metadata: { source: "pmp-dsh-tavern", playthroughId: snapshot.playthrough.id }
  })];
  if (snapshot.greeting !== null) {
    lines.push(JSON.stringify({ name: characterName, is_user: false, is_name: true, mes: snapshot.greeting }));
  }
  for (const turn of snapshot.turns) {
    if (turn.hidden) continue;
    lines.push(JSON.stringify({ name: "User", is_user: true, is_name: true, mes: turn.userText }));
    lines.push(JSON.stringify({ name: characterName, is_user: false, is_name: true, mes: turn.originalAssistantText }));
  }
  return `${lines.join("\n")}
`;
}
function portableBundleExport(snapshot) {
  return JSON.stringify({
    kind: "pmp-dsh-tavern-playthrough",
    schemaVersion: 1,
    exportedAt: snapshot.exportedAt,
    playthrough: snapshot.playthrough,
    timeline: snapshot.timeline,
    messagesBySession: snapshot.messagesBySession,
    resources: {
      characterId: snapshot.character?.id ?? null,
      greeting: snapshot.greeting
    }
  }, null, 2);
}
function playthroughExportDocument(snapshot, format) {
  if (format === "html") return { extension: "html", mime: "text/html;charset=utf-8", content: staticHtmlExport(snapshot) };
  if (format === "st") return { extension: "jsonl", mime: "application/x-ndjson;charset=utf-8", content: sillyTavernJsonlExport(snapshot) };
  if (format === "bundle") return { extension: "json", mime: "application/json;charset=utf-8", content: portableBundleExport(snapshot) };
  throw new TypeError(`Unknown export format ${format}`);
}

// packages/client/src/play/schema.js
var CHROME_MODES = /* @__PURE__ */ new Set(["native", "play"]);
var MESSAGE_ROLES = /* @__PURE__ */ new Set(["user", "assistant", "system"]);
function isRecord4(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fail(label, detail) {
  throw new TypeError(`${label}: ${detail}`);
}
function stringId(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(label, "must be a non-empty string");
  return value;
}
function eventSeq(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(label, "must be a non-negative integer");
  return value;
}
function extRecord(value, label) {
  if (value === void 0) return void 0;
  if (!isRecord4(value)) fail(label, "must be an object");
  return value;
}
function normalizeChrome(value, label = "chrome") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!CHROME_MODES.has(value.mode)) fail(label, "mode must be native or play");
  return { mode: value.mode };
}
function normalizeWorkspace(value, label = "workspace") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (typeof value.selected !== "boolean") fail(label, "selected must be a boolean");
  if (value.rootPath !== null && value.rootPath !== void 0 && typeof value.rootPath !== "string") {
    fail(label, "rootPath must be a string or null");
  }
  if (!Number.isSafeInteger(value.contractVersion) || value.contractVersion < 1) {
    fail(label, "contractVersion must be a positive integer");
  }
  const warnings = Array.isArray(value.warnings) ? value.warnings.filter(isRecord4).map((item) => ({
    code: typeof item.code === "string" ? item.code : "",
    message: typeof item.message === "string" ? item.message : ""
  })) : [];
  return {
    selected: value.selected,
    rootPath: value.rootPath ?? null,
    workspaceId: typeof value.workspaceId === "string" ? value.workspaceId : null,
    contractVersion: value.contractVersion,
    activeTimelinePath: typeof value.activeTimelinePath === "string" ? value.activeTimelinePath : null,
    firstSelection: value.firstSelection === true,
    warnings
  };
}
function normalizeTimelineVariant(value, label = "variant") {
  if (!isRecord4(value)) fail(label, "must be an object");
  const startEventId = eventSeq(value.startEventId, `${label}.startEventId`);
  const endEventId = eventSeq(value.endEventId, `${label}.endEventId`);
  if (startEventId > endEventId) fail(label, "startEventId must not exceed endEventId");
  const ext = extRecord(value.ext, `${label}.ext`);
  return {
    id: stringId(value.id, `${label}.id`),
    sessionId: stringId(value.sessionId, `${label}.sessionId`),
    startEventId,
    endEventId,
    ...ext === void 0 ? {} : { ext }
  };
}
function normalizeTimelineNode(value, label = "node") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (value.kind !== "qa") fail(label, "kind must be qa");
  if (!Array.isArray(value.variants) || value.variants.length === 0) {
    fail(label, "variants must be a non-empty array");
  }
  const variants = value.variants.map((item, index) => normalizeTimelineVariant(item, `${label}.variants[${index}]`));
  const adoptedVariantId = stringId(value.adoptedVariantId, `${label}.adoptedVariantId`);
  if (!variants.some((item) => item.id === adoptedVariantId)) fail(label, "adoptedVariantId must match a variant");
  if (value.hidden !== void 0 && typeof value.hidden !== "boolean") fail(label, "hidden must be a boolean");
  if (value.displayOverride !== void 0 && value.displayOverride !== null && typeof value.displayOverride !== "string") {
    fail(label, "displayOverride must be a string or null");
  }
  const ext = extRecord(value.ext, `${label}.ext`);
  return {
    id: stringId(value.id, `${label}.id`),
    kind: "qa",
    hidden: value.hidden === true,
    displayOverride: value.displayOverride ?? null,
    adoptedVariantId,
    variants,
    ...ext === void 0 ? {} : { ext }
  };
}
function normalizeTimeline(value, label = "timeline") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!Array.isArray(value.nodes)) fail(label, "nodes must be an array");
  const nodes = value.nodes.map((item, index) => normalizeTimelineNode(item, `${label}.nodes[${index}]`));
  const ids = /* @__PURE__ */ new Set();
  for (const node of nodes) {
    if (ids.has(node.id)) fail(label, `duplicate node id ${node.id}`);
    ids.add(node.id);
  }
  const ext = extRecord(value.ext, `${label}.ext`);
  return { nodes, ...ext === void 0 ? {} : { ext } };
}
function normalizeCatalog(value, label = "catalog") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!Array.isArray(value.playthroughs)) fail(label, "playthroughs must be an array");
  const playthroughs = value.playthroughs.map((item, index) => {
    const itemLabel = `${label}.playthroughs[${index}]`;
    if (!isRecord4(item)) fail(itemLabel, "must be an object");
    const ext2 = extRecord(item.ext, `${itemLabel}.ext`);
    return {
      id: stringId(item.id, `${itemLabel}.id`),
      path: stringId(item.path, `${itemLabel}.path`),
      ...typeof item.title === "string" ? { title: item.title } : {},
      ...typeof item.lastOpenedAt === "string" ? { lastOpenedAt: item.lastOpenedAt } : {},
      ...ext2 === void 0 ? {} : { ext: ext2 }
    };
  });
  const ext = extRecord(value.ext, `${label}.ext`);
  return { playthroughs, ...ext === void 0 ? {} : { ext } };
}
function parseJsonDocument(content, normalize, label) {
  if (typeof content !== "string") fail(label, "content must be a JSON string");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    fail(label, "content must be valid JSON");
  }
  return normalize(parsed, label);
}
function projectContentText(content) {
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (!isRecord4(part)) return "";
    if (typeof part.text === "string") return part.text;
    return typeof part.type === "string" && part.type !== "text" ? `\u27E6${part.type}\u27E7` : "";
  }).join("");
}
function normalizeSessionMessages(value, label = "messages") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (!Array.isArray(value.messages)) fail(label, "messages must be an array");
  if (typeof value.incompleteTurn !== "boolean") fail(label, "incompleteTurn must be a boolean");
  const messages = value.messages.map((item, index) => {
    const itemLabel = `${label}.messages[${index}]`;
    if (!isRecord4(item)) fail(itemLabel, "must be an object");
    if (!MESSAGE_ROLES.has(item.role)) fail(itemLabel, "role is invalid");
    if (!Array.isArray(item.content)) fail(itemLabel, "content must be an array");
    if (item.seq !== null && (!Number.isSafeInteger(item.seq) || item.seq < 0)) fail(itemLabel, "seq must be a non-negative integer or null");
    return {
      id: stringId(item.id, `${itemLabel}.id`),
      role: item.role,
      content: item.content,
      seq: item.seq,
      text: projectContentText(item.content)
    };
  });
  return { messages, incompleteTurn: value.incompleteTurn };
}
function normalizeFocus(value, label = "focus") {
  if (!isRecord4(value)) fail(label, "must be an object");
  if (value.sessionId !== null && (typeof value.sessionId !== "string" || value.sessionId === "")) {
    fail(label, "sessionId must be a non-empty string or null");
  }
  return { sessionId: value.sessionId };
}
function timelinePath(value, label = "timeline path") {
  const path = typeof value === "string" ? value : value?.path;
  stringId(path, label);
  if (!path.endsWith("timeline.json")) fail(label, "must point to timeline.json");
  return path;
}
function playthroughCharacterId(playthrough) {
  const explicit = playthrough?.ext?.pmpDshTavern?.characterId;
  if (typeof explicit === "string" && explicit !== "") return explicit;
  const path = typeof playthrough?.path === "string" ? playthrough.path.replaceAll("\\", "/") : "";
  const first = path.split("/").filter(Boolean)[0];
  return first || null;
}

// packages/client/src/play/import.js
function parseJsonl(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  if (rows.length === 0) throw new TypeError("play.import.empty");
  const messages = rows.slice(1).filter((row) => typeof row?.mes === "string");
  let greeting = null;
  const qa = [];
  let pending = null;
  for (const message of messages) {
    if (message.is_user === true) {
      if (pending !== null) throw new TypeError("play.import.unpaired");
      pending = message.mes;
    } else if (pending === null && qa.length === 0 && greeting === null) {
      greeting = message.mes;
    } else if (pending !== null) {
      qa.push({ user: pending, assistant: message.mes });
      pending = null;
    }
  }
  if (pending !== null) throw new TypeError("play.import.unpaired");
  return { greeting, qa, source: { format: "sillytavern-jsonl" } };
}
function parseBundle(value) {
  if (value?.kind !== "pmp-dsh-tavern-playthrough" || value.schemaVersion !== 1) {
    throw new TypeError("play.import.unsupported");
  }
  const turns = projectTimelineQa(value.timeline, value.messagesBySession);
  return {
    greeting: typeof value.resources?.greeting === "string" ? value.resources.greeting : null,
    qa: turns.filter((turn) => !turn.hidden).map((turn) => ({ user: turn.userText, assistant: turn.originalAssistantText })),
    source: { format: "pmp-dsh-tavern-bundle", playthroughId: value.playthrough?.id ?? null }
  };
}
function parsePlaythroughImport(text, fileName = "") {
  if (typeof text !== "string" || text.trim() === "") throw new TypeError("play.import.empty");
  const parsed = text.trimStart().startsWith("{") && !text.trimStart().includes("\n") ? parseBundle(JSON.parse(text)) : (() => {
    try {
      return parseBundle(JSON.parse(text));
    } catch (error) {
      if (text.includes("\n")) return parseJsonl(text);
      throw error;
    }
  })();
  return { schemaVersion: 1, ...parsed, source: { ...parsed.source, fileName } };
}
function rootSessionId3(playthrough) {
  const value = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  return typeof value === "string" && value !== "" ? value : null;
}
async function importPlaythrough(client, playthrough, file, {
  now = () => /* @__PURE__ */ new Date(),
  randomUUID = () => globalThis.crypto.randomUUID()
} = {}) {
  const document2 = parsePlaythroughImport(await file.text(), file.name);
  const characterId = playthroughCharacterId(playthrough);
  if (characterId === null) throw new TypeError("play.import.characterRequired");
  const id = `playthrough-${randomUUID()}`;
  const directory = `${characterId}/${id}`;
  const path = `${directory}/timeline.json`;
  const contextPath = `${directory}/import-context.json`;
  await client.createDirs(directory);
  await client.putFile(contextPath, JSON.stringify(document2, null, 2));
  const created = await client.postSession(rootSessionId3(playthrough), { path: contextPath });
  const imported = {
    id,
    path,
    title: `${playthrough.title || characterId} \xB7 ${file.name}`,
    lastOpenedAt: now().toISOString(),
    ext: { pmpDshTavern: { characterId, rootSessionId: created.sessionId, importContextPath: contextPath } }
  };
  const catalog2 = await client.getCatalog();
  await client.putTimeline(imported, { nodes: [], ext: { pmpDshTavern: { importContextPath: contextPath } } });
  await client.putCatalog({ ...catalog2, playthroughs: [...catalog2.playthroughs, imported] });
  return { sessionId: created.sessionId, playthrough: imported, document: document2 };
}

// packages/client/src/play/io-menu.js
var h9 = createLocalizedElement(import_react9.createElement);
var css8 = `
.dtv-play-io{position:relative;display:inline-flex}.dtv-play-io-trigger{width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.dtv-play-io-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-play-io-menu{position:absolute;z-index:30;left:0;bottom:calc(100% + 6px);min-width:210px;padding:6px;border:1px solid var(--dsw-alias-border-subtle);border-radius:11px;background:var(--dsw-alias-bg-layer-1,#181a20);box-shadow:0 12px 30px #0008;display:flex;flex-direction:column;gap:2px}.dtv-play-io[data-placement=sidebar] .dtv-play-io-menu{left:auto;right:0;bottom:auto;top:calc(100% + 4px)}
.dtv-play-io-item{min-height:34px;border:0;border-radius:8px;padding:6px 9px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;text-align:left;cursor:pointer}.dtv-play-io-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-io-item:disabled{opacity:.45;cursor:default}.dtv-play-io-error{max-width:240px;margin:3px 5px;color:var(--dsw-alias-state-error);font-size:10px;overflow-wrap:anywhere}
`;
function installStyles3() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-io"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-io`;
  style.textContent = css8;
  document.head.append(style);
}
function safeFilename(value) {
  const normalized = String(value ?? "playthrough").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
  return normalized === "" ? "playthrough" : normalized.slice(0, 100);
}
function downloadDocument(playthrough, document2) {
  const blob = new Blob([document2.content], { type: document2.mime });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(playthrough.title || playthrough.id)}.${document2.extension}`;
  anchor.style.display = "none";
  window.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  queueMicrotask(() => URL.revokeObjectURL(url));
}
function PlayIoMenu({ playClient, playthrough, openSession, trigger = "+", placement = "composer" }) {
  installStyles3();
  const root = (0, import_react9.useRef)(null);
  const importInput = (0, import_react9.useRef)(null);
  const [open, setOpen] = (0, import_react9.useState)(false);
  const [busy, setBusy] = (0, import_react9.useState)(false);
  const [error, setError] = (0, import_react9.useState)("");
  (0, import_react9.useEffect)(() => {
    if (!open) return void 0;
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    window.document.addEventListener("pointerdown", close);
    return () => window.document.removeEventListener("pointerdown", close);
  }, [open]);
  const exportAs = async (format) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const snapshot = await loadPlaythroughExport(playClient, playthrough);
      downloadDocument(playthrough, playthroughExportDocument(snapshot, format));
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await importPlaythrough(playClient, playthrough, file);
      window.dispatchEvent(new Event("pmp-dsh-tavern:refresh"));
      openSession?.(result.sessionId);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return h9(
    "div",
    { ref: root, className: "dtv-play-io", "data-placement": placement },
    h9("button", {
      type: "button",
      className: "dtv-play-io-trigger",
      title: uiMessage("play.io.menu"),
      "aria-label": uiMessage("play.io.menu"),
      "aria-expanded": open,
      onClick: (event) => {
        event.stopPropagation();
        setOpen((value) => !value);
      }
    }, rawText(trigger)),
    !open ? null : h9(
      "div",
      { className: "dtv-play-io-menu" },
      h9("button", { type: "button", className: "dtv-play-io-item", disabled: busy, onClick: () => exportAs("html") }, uiMessage("play.io.exportHtml")),
      h9("button", { type: "button", className: "dtv-play-io-item", disabled: busy, onClick: () => exportAs("st") }, uiMessage("play.io.exportSt")),
      h9("button", { type: "button", className: "dtv-play-io-item", disabled: busy, onClick: () => exportAs("bundle") }, uiMessage("play.io.exportBundle")),
      h9("button", {
        type: "button",
        className: "dtv-play-io-item",
        disabled: busy,
        onClick: () => importInput.current?.click()
      }, uiMessage("play.io.import")),
      h9("input", { ref: importInput, hidden: true, type: "file", accept: ".json,.jsonl,application/json,application/x-ndjson", onChange: importFile }),
      error === "" ? null : h9("p", { className: "dtv-play-io-error" }, rawText(error))
    )
  );
}

// packages/client/src/play/sidebar.js
var import_react10 = require("react");

// packages/client/src/play/sidebar-model.js
var SIDEBAR_LOAD_CONCURRENCY = 4;
function characterIdFromSelection(value) {
  const selection = value?.selection ?? value;
  const id = selection?.characterCardId;
  return typeof id === "string" && id !== "" ? id : null;
}
function rootSessionId4(playthrough) {
  const id = playthrough?.ext?.pmpDshTavern?.rootSessionId;
  return typeof id === "string" && id !== "" ? id : null;
}
function sessionTitle(session, id) {
  if (typeof session?.displayTitle === "string" && session.displayTitle !== "") return session.displayTitle;
  if (typeof session?.title === "string" && session.title !== "") return session.title;
  return id;
}
function normalizedPath2(value) {
  if (typeof value !== "string") return "";
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}
function requiresSystemWorkspaceConfirmation(value) {
  const path = typeof value === "string" ? value.replaceAll("\\", "/") : "";
  return /^c:\//i.test(path) || path === "/" || path === "/usr" || path.startsWith("/usr/") || path === "/System" || path.startsWith("/System/");
}
function timelineFor(timelines, playthrough) {
  return timelines?.[playthrough.path] ?? timelines?.[playthrough.id] ?? null;
}
function playthroughMembers(playthrough, timeline) {
  const ids = /* @__PURE__ */ new Set();
  const rootId = rootSessionId4(playthrough);
  if (rootId !== null) ids.add(rootId);
  for (const node of timeline?.nodes ?? []) {
    for (const variant of node?.variants ?? []) {
      if (typeof variant?.sessionId === "string" && variant.sessionId !== "") ids.add(variant.sessionId);
    }
  }
  return ids;
}
function sessionIdsInRpWorkspace({ workspace, workspaceItems = [], sessions = {} } = {}) {
  const ids = /* @__PURE__ */ new Set();
  if (workspace?.selected !== true) return ids;
  if (typeof workspace.workspaceId === "string" && workspace.workspaceId !== "") {
    const item = workspaceItems.find((candidate) => candidate?.workspaceId === workspace.workspaceId);
    if (item !== void 0) {
      for (const id of item.sessionIds ?? []) if (typeof id === "string" && id !== "") ids.add(id);
      return ids;
    }
  }
  const root = normalizedPath2(workspace.rootPath);
  if (root === "") return ids;
  for (const [id, session] of Object.entries(sessions)) {
    if (normalizedPath2(session?.cwd) === root) ids.add(id);
  }
  return ids;
}
var SessionCharacterBindingCache = class {
  constructor() {
    this.entries = /* @__PURE__ */ new Map();
    this.generation = 0;
  }
  clear() {
    this.generation += 1;
    this.entries.clear();
  }
  get(client, sessionId) {
    const cached = this.entries.get(sessionId);
    if (cached !== void 0) return cached.promise ?? Promise.resolve(cached.value);
    const generation = this.generation;
    const readSelection = typeof client.getSelection === "function" ? client.getSelection.bind(client) : client.getCharacterSelection.bind(client);
    const promise = readSelection(sessionId).then(characterIdFromSelection, () => null);
    this.entries.set(sessionId, { promise });
    promise.then((value) => {
      if (this.generation === generation) this.entries.set(sessionId, { value });
    });
    return promise;
  }
};
async function loadSessionCharacterBindings(client, sessionIds, {
  concurrency = SIDEBAR_LOAD_CONCURRENCY,
  cache = new SessionCharacterBindingCache()
} = {}) {
  if (client == null || typeof client.getSelection !== "function" && typeof client.getCharacterSelection !== "function") return {};
  const ids = [...new Set(sessionIds)].filter((id) => typeof id === "string" && id !== "");
  const result = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const index = cursor;
      cursor += 1;
      const id = ids[index];
      result[id] = await cache.get(client, id);
    }
  };
  const requested = Number.isFinite(concurrency) ? Math.floor(concurrency) : SIDEBAR_LOAD_CONCURRENCY;
  const workerCount = Math.min(ids.length, Math.max(1, Math.min(SIDEBAR_LOAD_CONCURRENCY, requested)));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return result;
}
async function mapConcurrent(values, mapper, concurrency = SIDEBAR_LOAD_CONCURRENCY) {
  const result = new Array(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(values.length, concurrency) }, worker));
  return result;
}
async function loadPlaySidebarResources(client) {
  if (client == null) throw new TypeError("playClient.required");
  const [workspace, characterResponse] = await Promise.all([
    client.getWorkspace(),
    client.getCharacters()
  ]);
  const characters = Array.isArray(characterResponse?.characters) ? characterResponse.characters : [];
  if (workspace.selected !== true) return { workspace, characters, catalog: { playthroughs: [] }, timelines: {}, diagnostics: [] };
  let catalog2;
  try {
    catalog2 = await client.getCatalog();
  } catch (reason) {
    if (reason?.code !== "PLAY_PATH_NOT_FOUND") throw reason;
    catalog2 = { playthroughs: [] };
  }
  const timelines = {};
  const diagnostics = [];
  await mapConcurrent(catalog2.playthroughs, async (playthrough) => {
    try {
      timelines[playthrough.path] = await client.getTimeline(playthrough);
    } catch (reason) {
      diagnostics.push({
        playthroughId: playthrough.id,
        path: playthrough.path,
        message: reason instanceof Error ? reason.message : String(reason)
      });
    }
  });
  return { workspace, characters, catalog: catalog2, timelines, diagnostics };
}
function projectPlaySidebar({
  workspace = { selected: false },
  workspaceItems = [],
  characters = [],
  catalog: catalog2 = { playthroughs: [] },
  timelines = {},
  sessions = {},
  sessionIds = [],
  archivedSessionIds = [],
  currentId = null,
  sessionCharacters = {}
} = {}) {
  const archived = new Set(archivedSessionIds);
  const rpSessionIds = sessionIdsInRpWorkspace({ workspace, workspaceItems, sessions });
  const characterById = /* @__PURE__ */ new Map();
  const ensureCharacter = (id, name2 = id) => {
    if (!characterById.has(id)) characterById.set(id, { id, name: name2, playthroughs: [], unassigned: [] });
    return characterById.get(id);
  };
  for (const character of characters) {
    if (typeof character?.id !== "string" || character.id === "") continue;
    ensureCharacter(character.id, typeof character.name === "string" && character.name !== "" ? character.name : character.id);
  }
  const claimedRpSessions = /* @__PURE__ */ new Set();
  for (const playthrough of catalog2.playthroughs ?? []) {
    const rootId = rootSessionId4(playthrough);
    const characterId = playthroughCharacterId(playthrough);
    if (characterId === null) continue;
    const allMembers = playthroughMembers(playthrough, timelineFor(timelines, playthrough));
    const members = [...allMembers].filter((id) => rpSessionIds.has(id) && !archived.has(id));
    for (const id of members) claimedRpSessions.add(id);
    ensureCharacter(characterId).playthroughs.push({
      ...playthrough,
      title: typeof playthrough.title === "string" && playthrough.title !== "" ? playthrough.title : playthrough.id,
      rootSessionId: rootId !== null && members.includes(rootId) ? rootId : null,
      sessionIds: members,
      active: currentId !== null && members.includes(currentId),
      missing: members.length === 0
    });
  }
  const ids = sessionIds.length > 0 ? sessionIds : Object.keys(sessions);
  const otherSessions = [];
  for (const id of ids) {
    const session = sessions[id];
    if (session == null || archived.has(id)) continue;
    if (!rpSessionIds.has(id)) {
      otherSessions.push({ id, title: sessionTitle(session, id), active: currentId === id, kind: "external" });
      continue;
    }
    if (claimedRpSessions.has(id)) continue;
    const characterId = sessionCharacters[id];
    if (typeof characterId === "string" && characterId !== "") {
      ensureCharacter(characterId).unassigned.push({ id, title: sessionTitle(session, id), active: currentId === id });
      continue;
    }
    otherSessions.push({ id, title: sessionTitle(session, id), active: currentId === id, kind: "ordinary" });
  }
  return {
    workspaceReady: workspace.selected === true,
    rpSessionIds: [...rpSessionIds],
    playSessionIds: [...claimedRpSessions],
    characters: [...characterById.values()],
    otherSessions
  };
}
function shouldShowUnboundNotice({ workspace, session, selection } = {}) {
  if (workspace == null || session == null) return false;
  if (workspace.selected !== true) return true;
  const workspacePath = normalizedPath2(workspace.rootPath);
  const sessionPath = normalizedPath2(session.cwd);
  if (workspacePath === "" || sessionPath !== workspacePath) return true;
  return characterIdFromSelection(selection) === null;
}

// packages/client/src/play/create.js
var SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
var SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
function safeSegment(value, label) {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value)) {
    throw new TypeError(`${label} must be a safe path segment`);
  }
  return value;
}
function safeSessionId(value) {
  if (typeof value !== "string" || !SAFE_SESSION_ID.test(value)) {
    throw new TypeError("session.id must be a valid DSH session id");
  }
  return value;
}
function isoNow(now) {
  const value = now();
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) throw new TypeError("now must return a valid Date");
  return value.toISOString();
}
async function catalogOrEmpty(client) {
  try {
    return await client.getCatalog();
  } catch (reason) {
    if (reason?.code === "PLAY_PATH_NOT_FOUND") return { playthroughs: [] };
    throw reason;
  }
}
function sourceSessionIdForCharacter(character) {
  const activePlaythrough = character?.playthroughs?.find((item) => item.active && typeof item.rootSessionId === "string");
  if (activePlaythrough !== void 0) return activePlaythrough.rootSessionId;
  const activeLoose = character?.unassigned?.find((item) => item.active);
  if (activeLoose !== void 0) return activeLoose.id;
  const loose = character?.unassigned?.find((item) => typeof item.id === "string");
  if (loose !== void 0) return loose.id;
  const rooted = character?.playthroughs?.find((item) => typeof item.rootSessionId === "string");
  return rooted?.rootSessionId ?? null;
}
async function createCharacterPlaythrough(client, {
  character,
  selectionFromSessionId = null,
  now = () => /* @__PURE__ */ new Date(),
  randomUUID = () => globalThis.crypto.randomUUID()
} = {}) {
  if (client == null) throw new TypeError("playClient.required");
  const characterId = safeSegment(character?.id, "character.id");
  const characterName = typeof character?.name === "string" && character.name.trim() !== "" ? character.name.trim() : characterId;
  const createdAt = isoNow(now);
  const playthroughId = safeSegment(`playthrough-${randomUUID()}`, "playthrough.id");
  const directory = `${characterId}/${playthroughId}`;
  const path = `${directory}/timeline.json`;
  const sourceId = typeof selectionFromSessionId === "string" && selectionFromSessionId !== "" ? selectionFromSessionId : null;
  const created = await client.postSession(sourceId);
  const sessionId = safeSessionId(created?.sessionId);
  if (sourceId === null) {
    await client.putCharacterSelection(sessionId, characterId, { greetingIndex: 0 });
  }
  const selection = await client.getCharacterSelection(sessionId);
  if (characterIdFromSelection(selection) !== characterId) {
    throw new Error("playthrough character selection did not persist");
  }
  const catalog2 = await catalogOrEmpty(client);
  const playthrough = {
    id: playthroughId,
    path,
    title: typeof created?.title === "string" && created.title !== "" ? created.title : `${characterName} ${createdAt.slice(0, 16).replace("T", " ")}`,
    lastOpenedAt: createdAt,
    ext: {
      pmpDshTavern: {
        characterId,
        rootSessionId: sessionId
      }
    }
  };
  await client.createDirs(directory);
  await client.putTimeline(playthrough, { nodes: [] });
  await client.putCatalog({
    ...catalog2,
    playthroughs: [...catalog2.playthroughs, playthrough]
  });
  const [savedCatalog, savedTimeline] = await Promise.all([
    client.getCatalog(),
    client.getTimeline(playthrough)
  ]);
  const saved = savedCatalog.playthroughs.find((item) => item.id === playthroughId);
  if (saved?.ext?.pmpDshTavern?.rootSessionId !== sessionId || savedTimeline.nodes.length !== 0) {
    throw new Error("playthrough verification failed");
  }
  return { sessionId, playthrough: saved };
}
function createPlaythroughController(client, dependencies = {}) {
  const inFlight = /* @__PURE__ */ new Map();
  let tail = Promise.resolve();
  return {
    create(args) {
      const characterId = safeSegment(args?.character?.id, "character.id");
      const existing = inFlight.get(characterId);
      if (existing !== void 0) return existing;
      const task = tail.catch(() => {
      }).then(() => createCharacterPlaythrough(client, {
        ...dependencies,
        ...args
      }));
      tail = task;
      inFlight.set(characterId, task);
      task.finally(() => {
        if (inFlight.get(characterId) === task) inFlight.delete(characterId);
      }).catch(() => {
      });
      return task;
    }
  };
}

// packages/client/src/play/sidebar.js
var h10 = createLocalizedElement(import_react10.createElement);
var css9 = `
.dtv-play-sidebar{height:100%;min-height:0;box-sizing:border-box;display:flex;flex-direction:column;gap:4px;padding:6px 7px 10px;overflow:auto;zoom:var(--dtv-ui-scale,1);color:var(--dsw-alias-label-primary)}
.dtv-play-section{display:flex;flex-direction:column;gap:2px;border-radius:10px}.dtv-play-section[data-open=true]{padding-bottom:3px}
.dtv-play-group,.dtv-play-row{width:100%;box-sizing:border-box;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:7px}.dtv-play-group:hover,.dtv-play-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-play-row-line{display:flex;align-items:center;gap:2px}.dtv-play-row-line>.dtv-play-row{min-width:0;flex:1}.dtv-play-row-line>.dtv-play-io{flex:none}
.dtv-play-group{min-height:38px;padding:4px 6px;font-size:12px;font-weight:680}.dtv-play-row{min-height:32px;padding:4px 7px 4px 27px;font-size:11px}.dtv-play-row[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip));font-weight:650}.dtv-play-row:disabled{cursor:default;opacity:.55}
.dtv-play-group-line{display:flex;align-items:center;gap:3px}.dtv-play-group-line>.dtv-play-group{min-width:0;flex:1}.dtv-play-create{width:30px;height:30px;flex:none;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}.dtv-play-create:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-create:disabled{cursor:default;opacity:.5}
.dtv-play-chevron{width:10px;flex:none;text-align:center;color:var(--dsw-alias-label-tertiary)}.dtv-play-title{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dtv-play-count{flex:none;border-radius:9px;padding:1px 6px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-tertiary);font-size:9px}
.dtv-play-avatar{position:relative;width:25px;height:25px;flex:none;border-radius:50%;overflow:hidden;background:var(--dsw-specific-tip);display:grid;place-items:center;color:var(--dsw-alias-label-secondary);font-size:10px}.dtv-play-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.dtv-play-subgroup{display:flex;flex-direction:column;gap:1px}.dtv-play-subgroup>.dtv-play-group{min-height:30px;padding-left:25px;font-size:10px;font-weight:620;color:var(--dsw-alias-label-secondary)}
.dtv-play-empty,.dtv-play-status{margin:0;padding:7px 9px;font-size:10px;line-height:1.45;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}.dtv-play-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-play-rail{height:100%;box-sizing:border-box;padding:7px;display:flex;flex-direction:column;align-items:center;gap:7px;overflow:auto;zoom:var(--dtv-ui-scale,1)}.dtv-play-rail-button{width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;display:grid;place-items:center}.dtv-play-rail-button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-play-rail-button .dtv-play-avatar{width:30px;height:30px}
`;
function installStyles4() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-sidebar"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-sidebar`;
  style.textContent = css9;
  document.head.append(style);
}
function useUiScale() {
  const [scale, setScale] = (0, import_react10.useState)(() => getClientUiSettings().scale);
  (0, import_react10.useEffect)(() => {
    const onSettings = (event) => {
      const next = Number(event.detail?.scale);
      if (Number.isFinite(next)) setScale(next);
    };
    window.addEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(CLIENT_UI_SETTINGS_EVENT, onSettings);
  }, []);
  return scale;
}
function Avatar({ character }) {
  const fallback = (character.name || character.id).slice(0, 1).toUpperCase();
  return h10(
    "span",
    { className: "dtv-play-avatar", "aria-hidden": "true" },
    rawText(fallback),
    h10("img", {
      src: `${API_V1}/characters/${encodeURIComponent(character.id)}/png`,
      alt: "",
      onError: (event) => {
        event.currentTarget.hidden = true;
      }
    })
  );
}
function Rail({ model, scale, expandSidebar }) {
  return h10(
    "div",
    { className: "dtv-play-rail", style: { "--dtv-ui-scale": scale } },
    ...model.characters.map((character) => h10("button", {
      key: character.id,
      type: "button",
      className: "dtv-play-rail-button",
      title: rawText(character.name),
      "aria-label": rawText(character.name),
      onClick: expandSidebar
    }, h10(Avatar, { character }))),
    h10("button", {
      type: "button",
      className: "dtv-play-rail-button",
      title: uiMessage("play.sidebar.other"),
      "aria-label": uiMessage("play.sidebar.other"),
      onClick: expandSidebar
    }, "\u2630")
  );
}
function CharacterGroup({ character, collapsed, unassignedOpen, creating, createDisabled, toggle, toggleUnassigned, createPlaythrough, openPlaythrough, openSession, playClient }) {
  const count = character.playthroughs.length + character.unassigned.length;
  return h10(
    "section",
    { className: "dtv-play-section", "data-open": !collapsed },
    h10(
      "div",
      { className: "dtv-play-group-line" },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-group",
          "aria-expanded": !collapsed,
          onClick: toggle
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, collapsed ? "\u203A" : "\u2304"),
        h10(Avatar, { character }),
        h10("span", { className: "dtv-play-title" }, rawText(character.name)),
        h10("span", { className: "dtv-play-count" }, rawText(String(count)))
      ),
      h10("button", {
        type: "button",
        className: "dtv-play-create",
        disabled: createDisabled,
        title: uiMessage("play.sidebar.newPlaythrough", { name: character.name }),
        "aria-label": uiMessage("play.sidebar.newPlaythrough", { name: character.name }),
        onClick: () => createPlaythrough(character)
      }, creating ? "\u2026" : "+")
    ),
    collapsed ? null : character.playthroughs.length === 0 && character.unassigned.length === 0 ? h10("p", { className: "dtv-play-empty" }, uiMessage("play.sidebar.noPlaythroughs")) : null,
    collapsed ? null : character.playthroughs.map((playthrough) => h10(
      "div",
      {
        key: playthrough.id,
        className: "dtv-play-row-line"
      },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-row",
          "data-active": playthrough.active,
          disabled: playthrough.missing,
          title: playthrough.missing ? uiMessage("play.sidebar.sessionMissing") : rawText(playthrough.title),
          onClick: () => openPlaythrough(playthrough)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u25C6"),
        h10("span", { className: "dtv-play-title" }, rawText(playthrough.title))
      ),
      h10(PlayIoMenu, { playClient, playthrough, openSession, trigger: "\u22EF", placement: "sidebar" })
    )),
    collapsed || character.unassigned.length === 0 ? null : h10(
      "div",
      { className: "dtv-play-subgroup" },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-group",
          "aria-expanded": unassignedOpen,
          onClick: toggleUnassigned
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, unassignedOpen ? "\u2304" : "\u203A"),
        h10("span", { className: "dtv-play-title" }, uiMessage("play.sidebar.unassigned")),
        h10("span", { className: "dtv-play-count" }, rawText(String(character.unassigned.length)))
      ),
      unassignedOpen ? character.unassigned.map((session) => h10(
        "button",
        {
          key: session.id,
          type: "button",
          className: "dtv-play-row",
          "data-active": session.active,
          onClick: () => openSession(session.id)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u2022"),
        h10("span", { className: "dtv-play-title" }, rawText(session.title))
      )) : null
    )
  );
}
function PlayWorkspaceBrowser({
  wide = true,
  expandSidebar,
  useSessions,
  useWorkspaces,
  playClient,
  openSession
}) {
  installStyles4();
  const scale = useUiScale();
  const sessionIds = useSessions((state) => state.ids);
  const sessions = useSessions((state) => state.byId);
  const currentId = useSessions((state) => state.current ?? null);
  const workspaceItems = useWorkspaces((state) => state.items);
  const archivedSessionIds = useWorkspaces((state) => state.archivedSessionIds);
  const cache = (0, import_react10.useRef)(null);
  if (cache.current === null) cache.current = new SessionCharacterBindingCache();
  const creator = (0, import_react10.useRef)(null);
  if (creator.current?.client !== playClient) {
    creator.current = { client: playClient, controller: createPlaythroughController(playClient) };
  }
  const [creatingCharacterId, setCreatingCharacterId] = (0, import_react10.useState)(null);
  const [revision, setRevision] = (0, import_react10.useState)(0);
  const [resources, setResources] = (0, import_react10.useState)(null);
  const [sessionCharacters, setSessionCharacters] = (0, import_react10.useState)({});
  const [status, setStatus] = (0, import_react10.useState)(null);
  const [collapsedCharacters, setCollapsedCharacters] = (0, import_react10.useState)(() => /* @__PURE__ */ new Set());
  const [expandedUnassigned, setExpandedUnassigned] = (0, import_react10.useState)(() => /* @__PURE__ */ new Set());
  const [otherOpen, setOtherOpen] = (0, import_react10.useState)(false);
  (0, import_react10.useEffect)(() => {
    const refresh = () => {
      cache.current.clear();
      setRevision((value) => value + 1);
    };
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh);
  }, []);
  (0, import_react10.useEffect)(() => {
    let active = true;
    setStatus(null);
    loadPlaySidebarResources(playClient).then((next) => {
      if (active) setResources(next);
    }).catch((reason) => {
      if (!active) return;
      setResources(null);
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    });
    return () => {
      active = false;
    };
  }, [playClient, revision]);
  const rpIds = resources === null ? [] : [...sessionIdsInRpWorkspace({
    workspace: resources.workspace,
    workspaceItems,
    sessions
  })];
  const rpKey = rpIds.join("\0");
  (0, import_react10.useEffect)(() => {
    let active = true;
    if (resources === null) {
      setSessionCharacters({});
      return () => {
        active = false;
      };
    }
    loadSessionCharacterBindings(playClient, rpIds, { cache: cache.current }).then((next) => {
      if (active) setSessionCharacters(next);
    });
    return () => {
      active = false;
    };
  }, [playClient, resources, rpKey, revision]);
  const model = projectPlaySidebar({
    workspace: resources?.workspace,
    workspaceItems,
    characters: resources?.characters,
    catalog: resources?.catalog,
    timelines: resources?.timelines,
    sessions,
    sessionIds,
    archivedSessionIds,
    currentId,
    sessionCharacters
  });
  const bindWorkspace = async (workspace) => {
    if (requiresSystemWorkspaceConfirmation(workspace.path) && !window.confirm(unwrapText(uiMessage("play.sidebar.systemWorkspaceConfirm", { path: workspace.path })))) return;
    setStatus(null);
    try {
      await playClient.putWorkspace(workspace.path);
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    }
  };
  const createPlaythrough = async (character) => {
    if (creatingCharacterId !== null) return;
    setCreatingCharacterId(character.id);
    setStatus(null);
    try {
      const result = await creator.current.controller.create({
        character,
        selectionFromSessionId: sourceSessionIdForCharacter(character)
      });
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
      openSession(result.sessionId);
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    } finally {
      setCreatingCharacterId(null);
    }
  };
  const openPlaythrough = async (playthrough) => {
    setStatus(null);
    try {
      const focus = await playClient.getFocus(playthrough);
      const target = typeof focus.sessionId === "string" ? focus.sessionId : playthrough.rootSessionId;
      if (typeof target !== "string" || !playthrough.sessionIds.includes(target)) {
        setStatus({ key: "play.sidebar.sessionMissing" });
        return;
      }
      openSession(target);
    } catch (reason) {
      setStatus({ message: reason instanceof Error ? reason.message : String(reason) });
    }
  };
  if (wide === false) return h10(Rail, { model, scale, expandSidebar });
  const toggleSet = (setter, id) => setter((current2) => {
    const next = new Set(current2);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return h10(
    "div",
    { className: "dtv-play-sidebar", style: { "--dtv-ui-scale": scale } },
    resources === null && status === null ? h10("p", { className: "dtv-play-status" }, uiMessage("play.sidebar.loading")) : null,
    resources?.workspace?.selected === false ? h10(
      "section",
      { className: "dtv-play-section", "data-open": true },
      h10("p", { className: "dtv-play-status" }, uiMessage("play.sidebar.workspaceMissing")),
      ...workspaceItems.map((workspace) => {
        const label = uiMessage("play.sidebar.selectWorkspace", { name: workspace.title });
        return h10(
          "button",
          {
            key: workspace.workspaceId,
            type: "button",
            className: "dtv-play-row",
            title: label,
            "aria-label": label,
            onClick: () => bindWorkspace(workspace)
          },
          h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u25C7"),
          h10("span", { className: "dtv-play-title" }, rawText(workspace.title))
        );
      })
    ) : null,
    status === null ? null : h10("p", { className: "dtv-play-status", "data-error": true }, status.key ? uiMessage(status.key) : rawText(status.message)),
    (resources?.diagnostics.length ?? 0) === 0 ? null : h10("p", { className: "dtv-play-status", "data-error": true }, uiMessage("play.sidebar.timelineErrors", { count: resources.diagnostics.length })),
    ...(resources?.diagnostics ?? []).map((diagnostic) => h10("p", {
      key: diagnostic.playthroughId,
      className: "dtv-play-status",
      "data-error": true
    }, rawText(`${diagnostic.path}: ${diagnostic.message}`))),
    resources !== null && model.characters.length === 0 ? h10("p", { className: "dtv-play-empty" }, uiMessage("play.sidebar.noCharacters")) : null,
    ...model.characters.map((character) => h10(CharacterGroup, {
      key: character.id,
      character,
      collapsed: collapsedCharacters.has(character.id),
      unassignedOpen: expandedUnassigned.has(character.id),
      creating: creatingCharacterId === character.id,
      createDisabled: !model.workspaceReady || creatingCharacterId !== null,
      createPlaythrough,
      playClient,
      toggle: () => toggleSet(setCollapsedCharacters, character.id),
      toggleUnassigned: () => toggleSet(setExpandedUnassigned, character.id),
      openPlaythrough,
      openSession
    })),
    h10(
      "section",
      { className: "dtv-play-section", "data-open": otherOpen },
      h10(
        "button",
        {
          type: "button",
          className: "dtv-play-group",
          "aria-expanded": otherOpen,
          onClick: () => setOtherOpen((value) => !value)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, otherOpen ? "\u2304" : "\u203A"),
        h10("span", { className: "dtv-play-title" }, uiMessage("play.sidebar.other")),
        h10("span", { className: "dtv-play-count" }, rawText(String(model.otherSessions.length)))
      ),
      otherOpen && model.otherSessions.length === 0 ? h10("p", { className: "dtv-play-empty" }, uiMessage("play.sidebar.otherEmpty")) : null,
      otherOpen ? model.otherSessions.map((session) => h10(
        "button",
        {
          key: session.id,
          type: "button",
          className: "dtv-play-row",
          "data-active": session.active,
          "data-kind": session.kind,
          onClick: () => openSession(session.id)
        },
        h10("span", { className: "dtv-play-chevron", "aria-hidden": "true" }, "\u2022"),
        h10("span", { className: "dtv-play-title" }, rawText(session.title))
      )) : null
    )
  );
}

// packages/client/src/play/notice.js
var import_react11 = require("react");
var h11 = createLocalizedElement(import_react11.createElement);
var css10 = `
.dtv-play-unbound-notice{box-sizing:border-box;width:100%;margin:0;padding:7px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 34%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-state-warning,#d79921) 8%,transparent);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.45}
`;
function installStyles5() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-play-notice"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-play-notice`;
  style.textContent = css10;
  document.head.append(style);
}
function PlayUnboundNotice({ session, useSessions, playClient }) {
  installStyles5();
  const sessionId = session?.sessionId ?? null;
  const summary = useSessions((state) => sessionId === null ? null : state.byId?.[sessionId] ?? null);
  const [revision, setRevision] = (0, import_react11.useState)(0);
  const [visible, setVisible] = (0, import_react11.useState)(false);
  (0, import_react11.useEffect)(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(CLIENT_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, refresh);
  }, []);
  (0, import_react11.useEffect)(() => {
    let active = true;
    setVisible(false);
    if (sessionId === null || summary === null) return () => {
      active = false;
    };
    Promise.all([
      playClient.getWorkspace(),
      playClient.getCharacterSelection(sessionId)
    ]).then(([workspace, selection]) => {
      if (active) setVisible(shouldShowUnboundNotice({ workspace, session: summary, selection }));
    }, () => {
      if (active) setVisible(false);
    });
    return () => {
      active = false;
    };
  }, [playClient, revision, sessionId, summary]);
  if (!visible) return null;
  return h11("p", {
    className: "dtv-play-unbound-notice",
    role: "note"
  }, uiMessage("play.notice.unbound"));
}

// packages/client/src/play/occupancy.js
var PLAY_SLOT_PRIORITY = -100;
function installPlaySlotOccupancy(ctx, playClient) {
  let mode = "native";
  let declared = false;
  let disposeEntry = null;
  let disposeEffect = null;
  let noticeDeclared = false;
  let disposeNoticeEntry = null;
  let disposeNoticeEffect = null;
  let chatDeclared = false;
  let ioDeclared = false;
  let chatGeneration = 0;
  let disposeChatEntry = null;
  let disposeIoEntry = null;
  let disposeSessionSubscription = null;
  let refreshChatListener = null;
  const dropEntry = () => {
    const dispose = disposeEntry;
    disposeEntry = null;
    dispose?.();
  };
  const dropEffect = () => {
    const dispose = disposeEffect;
    disposeEffect = null;
    dispose?.();
    dropEntry();
  };
  const mount = () => {
    if (!declared || mode !== "play" || disposeEntry !== null) return;
    disposeEntry = ctx.slots.register({
      name: "sidebar.workspaces",
      priority: PLAY_SLOT_PRIORITY,
      inject: () => ({
        playClient,
        openSession: (sessionId) => ctx.sessions.open(sessionId)
      })
    }, PlayWorkspaceBrowser);
  };
  const reconcile = () => {
    dropEffect();
    if (!declared || mode !== "play") return;
    const effect = () => {
      mount();
      return dropEntry;
    };
    if (typeof ctx.effect === "function") {
      const dispose = ctx.effect(effect, "pmp-dsh-tavern:play-sidebar-shadow");
      disposeEffect = typeof dispose === "function" ? dispose : null;
    } else {
      disposeEffect = effect();
    }
  };
  const dropNoticeEntry = () => {
    const dispose = disposeNoticeEntry;
    disposeNoticeEntry = null;
    dispose?.();
  };
  const dropNoticeEffect = () => {
    const dispose = disposeNoticeEffect;
    disposeNoticeEffect = null;
    dispose?.();
    dropNoticeEntry();
  };
  const mountNotice = () => {
    if (!noticeDeclared || mode !== "play" || disposeNoticeEntry !== null) return;
    disposeNoticeEntry = ctx.slots.register({
      name: "conversation.input.dock",
      id: "pmp-dsh-tavern-unbound-notice",
      order: 90,
      inject: () => ({ playClient })
    }, PlayUnboundNotice);
  };
  const reconcileNotice = () => {
    dropNoticeEffect();
    if (!noticeDeclared || mode !== "play") return;
    const effect = () => {
      mountNotice();
      return dropNoticeEntry;
    };
    if (typeof ctx.effect === "function") {
      const dispose = ctx.effect(effect, "pmp-dsh-tavern:play-unbound-notice");
      disposeNoticeEffect = typeof dispose === "function" ? dispose : null;
    } else {
      disposeNoticeEffect = effect();
    }
  };
  const dropChatEntry = () => {
    const dispose = disposeChatEntry;
    disposeChatEntry = null;
    dispose?.();
    const disposeIo = disposeIoEntry;
    disposeIoEntry = null;
    disposeIo?.();
  };
  const currentSession = () => {
    const snapshot = ctx.sessions?.list?.getSnapshot?.();
    const sessionId = snapshot?.current;
    if (typeof sessionId !== "string" || sessionId === "") return null;
    const session = snapshot.byId?.[sessionId];
    return session == null ? null : { ...session, id: session.id ?? sessionId };
  };
  const reconcileChat = () => {
    chatGeneration += 1;
    const generation = chatGeneration;
    dropChatEntry();
    if (!chatDeclared && !ioDeclared || mode !== "play") return;
    const session = currentSession();
    if (session === null) return;
    const sessionId = session.id;
    loadCurrentPlaythrough(playClient, session).then((match) => {
      if (generation !== chatGeneration || mode !== "play" || !chatDeclared && !ioDeclared || currentSession()?.id !== sessionId || match === null) return;
      if (chatDeclared) {
        disposeChatEntry = ctx.slots.register({
          name: "conversation.view",
          id: "chat",
          order: 0,
          priority: PLAY_SLOT_PRIORITY,
          label: () => translate("play.chat.label"),
          inject: () => ({
            playClient,
            playthrough: match.playthrough,
            openSession: (sessionId2) => ctx.sessions.open(sessionId2)
          })
        }, MowanChatView);
      }
      if (ioDeclared) {
        disposeIoEntry = ctx.slots.register({
          name: "conversation.input.left",
          id: "pmp-dsh-tavern-play-io",
          order: 80,
          inject: () => ({ playClient, playthrough: match.playthrough, openSession: (sessionId2) => ctx.sessions.open(sessionId2) })
        }, PlayIoMenu);
      }
    }).catch(() => {
    });
  };
  const stopChatObserver = () => {
    chatGeneration += 1;
    dropChatEntry();
    const dispose = disposeSessionSubscription;
    disposeSessionSubscription = null;
    dispose?.();
    if (refreshChatListener !== null && typeof window !== "undefined") {
      window.removeEventListener(CLIENT_REFRESH_EVENT, refreshChatListener);
    }
    refreshChatListener = null;
  };
  const startChatObserver = () => {
    stopChatObserver();
    const list = ctx.sessions?.list;
    if (typeof list?.subscribe === "function") {
      const dispose = list.subscribe(reconcileChat);
      disposeSessionSubscription = typeof dispose === "function" ? dispose : null;
    }
    if (typeof window !== "undefined") {
      refreshChatListener = reconcileChat;
      window.addEventListener(CLIENT_REFRESH_EVENT, refreshChatListener);
    }
    reconcileChat();
  };
  ctx.slots.inject("sidebar.workspaces", () => {
    declared = true;
    reconcile();
    return () => {
      declared = false;
      dropEffect();
    };
  });
  ctx.slots.inject("conversation.input.dock", () => {
    noticeDeclared = true;
    reconcileNotice();
    return () => {
      noticeDeclared = false;
      dropNoticeEffect();
    };
  });
  ctx.slots.inject("conversation.view", () => {
    chatDeclared = true;
    startChatObserver();
    return () => {
      chatDeclared = false;
      if (ioDeclared) startChatObserver();
      else stopChatObserver();
    };
  });
  ctx.slots.inject("conversation.input.left", () => {
    ioDeclared = true;
    startChatObserver();
    return () => {
      ioDeclared = false;
      if (chatDeclared) startChatObserver();
      else stopChatObserver();
    };
  });
  return {
    setMode(next) {
      const normalized = next === "play" ? "play" : "native";
      if (mode === normalized) return;
      mode = normalized;
      reconcile();
      reconcileNotice();
      reconcileChat();
    }
  };
}

// packages/client/src/play/live.js
function errorMessage4(data, status) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.message === "string") return data.error.message;
  return `HTTP ${status}`;
}
function createRequester(fetchImpl, root) {
  return async function request(method, path, body2) {
    const hasBody = body2 !== void 0;
    const response = await fetchImpl(`${root}${path}`, {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : void 0,
      body: hasBody ? JSON.stringify(body2) : void 0
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok === false) {
      const error = new Error(errorMessage4(data, response.status));
      error.status = response.status;
      error.code = data?.code ?? data?.error?.code;
      error.diagnostics = data?.diagnostics ?? data?.error?.diagnostics ?? [];
      throw error;
    }
    return data;
  };
}
function fileContent(value, label) {
  if (typeof value?.content !== "string") throw new TypeError(`${label}: content must be a string`);
  return value.content;
}
function pathQuery(path) {
  return `?path=${encodeURIComponent(path)}`;
}
function createLivePlayClient({
  fetchImpl = globalThis.fetch,
  apiRoot = API_V2,
  v1Root = API_V1
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required");
  const v1 = createRequester(fetchImpl, v1Root);
  const v2 = createRequester(fetchImpl, apiRoot);
  async function getCharacterSelection(sessionId) {
    const query = typeof sessionId === "string" && sessionId !== "" ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    return v1("GET", `/character-selection${query}`);
  }
  async function getJsonFile(path, normalize, label) {
    const response = await v2("GET", `/workspace/files${pathQuery(path)}`);
    return parseJsonDocument(fileContent(response, label), normalize, label);
  }
  async function putJsonFile(path, value, normalize, label) {
    const normalized = normalize(value, label);
    await v2("PUT", `/workspace/files${pathQuery(path)}`, {
      content: JSON.stringify(normalized)
    });
    return normalized;
  }
  return {
    mode: "live",
    apiRoot,
    v1Root,
    async getChrome() {
      return normalizeChrome(await v2("GET", "/chrome"));
    },
    async putChrome(mode) {
      return normalizeChrome(await v2("PUT", "/chrome", { mode }));
    },
    async getWorkspace() {
      return normalizeWorkspace(await v2("GET", "/workspace"));
    },
    async putWorkspace(path) {
      return normalizeWorkspace(await v2("PUT", "/workspace", { path }));
    },
    async createDirs(path) {
      return v2("POST", "/workspace/dirs", { path });
    },
    async listFiles(prefix = "") {
      return v2("GET", `/workspace/files?list=${encodeURIComponent(prefix)}`);
    },
    async getFile(path) {
      const response = await v2("GET", `/workspace/files${pathQuery(path)}`);
      return { path: response.path, content: fileContent(response, path) };
    },
    async putFile(path, content) {
      if (typeof content !== "string") throw new TypeError("content must be a string");
      return v2("PUT", `/workspace/files${pathQuery(path)}`, { content });
    },
    getCatalog() {
      return getJsonFile("catalog.json", normalizeCatalog, "catalog");
    },
    putCatalog(catalog2) {
      return putJsonFile("catalog.json", catalog2, normalizeCatalog, "catalog");
    },
    getTimeline(playthrough) {
      const path = timelinePath(playthrough);
      return getJsonFile(path, normalizeTimeline, "timeline");
    },
    putTimeline(playthrough, timeline) {
      const path = timelinePath(playthrough);
      return putJsonFile(path, timeline, normalizeTimeline, "timeline");
    },
    async getMessages(sessionId) {
      const response = await v2("GET", `/sessions/${encodeURIComponent(sessionId)}/messages`);
      return normalizeSessionMessages(response);
    },
    async getFocus(playthrough) {
      const query = playthrough === void 0 ? "" : pathQuery(timelinePath(playthrough));
      return normalizeFocus(await v2("GET", `/focus${query}`));
    },
    postUserMessage(sessionId, text) {
      return v2("POST", `/sessions/${encodeURIComponent(sessionId)}/user-message`, { text });
    },
    postBranch(sessionId, atEventId) {
      if (!Number.isSafeInteger(atEventId) || atEventId < 0) {
        throw new TypeError("atEventId must be a non-negative integer");
      }
      return v2("POST", `/sessions/${encodeURIComponent(sessionId)}/branch`, { atEventId });
    },
    postSession(selectionFromSessionId, importContextRef) {
      const body2 = {
        ...typeof selectionFromSessionId === "string" && selectionFromSessionId !== "" ? { selectionFromSessionId } : {},
        ...importContextRef === void 0 ? {} : { importContextRef }
      };
      return v2("POST", "/sessions", body2);
    },
    getCharacterSelection,
    async getSelection(sessionId) {
      const response = await getCharacterSelection(sessionId);
      return response?.selection ?? null;
    },
    putCharacterSelection(sessionId, characterCardId, character = {}) {
      if (typeof sessionId !== "string" || sessionId === "") throw new TypeError("sessionId is required");
      if (typeof characterCardId !== "string" || characterCardId === "") {
        throw new TypeError("characterCardId is required");
      }
      if (character === null || typeof character !== "object" || Array.isArray(character)) {
        throw new TypeError("character selection options must be an object");
      }
      return v1("POST", "/character-selection", {
        sessionId,
        characterCardId,
        character
      });
    },
    getCharacters() {
      return v1("GET", "/characters");
    },
    getCharacter(id) {
      return v1("GET", `/characters/${encodeURIComponent(id)}`);
    },
    getPreset(id) {
      return v1("GET", `/presets/${encodeURIComponent(id)}`);
    },
    getActive(sessionId) {
      const query = typeof sessionId === "string" && sessionId !== "" ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      return v1("GET", `/active${query}`);
    },
    async putGreetingIndex(sessionId, greetingIndex) {
      if (typeof sessionId !== "string" || sessionId === "") throw new TypeError("sessionId is required");
      if (!Number.isSafeInteger(greetingIndex) || greetingIndex < 0) {
        throw new TypeError("greetingIndex must be a non-negative integer");
      }
      const current2 = await getCharacterSelection(sessionId);
      if (typeof current2?.selection?.characterCardId !== "string") {
        throw new TypeError("character selection is empty");
      }
      return v1("POST", "/character-selection", {
        sessionId,
        characterCardId: current2.selection.characterCardId,
        character: { ...current2.selection.character ?? {}, greetingIndex }
      });
    }
  };
}

// packages/client/src/play/regex-panel.js
var import_react12 = require("react");
var h12 = createLocalizedElement(import_react12.createElement);
var EMPTY_DOCUMENT = Object.freeze({ schemaVersion: 1, rules: Object.freeze([]) });
var SCOPE_KINDS = Object.freeze(["global", "preset", "character"]);
function activeRegexBindings(snapshot) {
  return {
    presetId: typeof snapshot?.selection?.presetId === "string" ? snapshot.selection.presetId : null,
    characterId: typeof snapshot?.selection?.characterCardId === "string" ? snapshot.selection.characterCardId : typeof snapshot?.selection?.characterId === "string" ? snapshot.selection.characterId : null
  };
}
function scopeFor(kind, bindings) {
  return {
    kind,
    resourceId: kind === "global" ? null : kind === "preset" ? bindings.presetId : bindings.characterId
  };
}
function downloadJson(document2) {
  const blob = new Blob([JSON.stringify(document2, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = "regex.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
function Field5({ labelKey, children }) {
  return h12(
    "label",
    { className: "dtv-field" },
    h12("span", { className: "dtv-label" }, uiMessage(labelKey)),
    children
  );
}
function RuleEditor({ rule, busy, update, remove }) {
  const set = (patch) => update({ ...rule, ...patch });
  const setScope = (patch) => set({ scope: { ...rule.scope, ...patch } });
  const stateLabel = uiMessage(rule.enabled ? "common.enabled" : "common.disabled");
  return h12(
    "details",
    { className: "dtv-entry dtv-regex-rule", "data-enabled": rule.enabled },
    h12(
      "summary",
      null,
      h12("span", { className: "dtv-entry-dot", "aria-hidden": "true" }),
      h12("span", { className: "dtv-entry-name" }, rawText(rule.name || unwrapText(uiMessage("regex.unnamed")))),
      h12("span", { className: "dtv-entry-state" }, stateLabel)
    ),
    h12(
      "div",
      { className: "dtv-entry-body" },
      h12(
        "label",
        { className: "dtv-check" },
        h12("input", {
          type: "checkbox",
          checked: rule.enabled,
          disabled: busy,
          onChange: (event) => set({ enabled: event.target.checked })
        }),
        uiMessage("regex.enabled")
      ),
      h12(Field5, { labelKey: "regex.name" }, h12("input", {
        className: "dtv-input",
        value: rule.name,
        disabled: busy,
        onChange: (event) => set({ name: event.target.value })
      })),
      h12(Field5, { labelKey: "regex.find" }, h12("textarea", {
        className: "dtv-textarea dtv-regex-expression",
        value: rule.find,
        disabled: busy,
        spellCheck: false,
        onChange: (event) => set({ find: event.target.value })
      })),
      h12(Field5, { labelKey: "regex.replace" }, h12("textarea", {
        className: "dtv-textarea dtv-regex-expression",
        value: rule.replace,
        disabled: busy,
        spellCheck: false,
        onChange: (event) => set({ replace: event.target.value })
      })),
      h12(
        "div",
        { className: "dtv-entry-grid" },
        h12(Field5, { labelKey: "regex.flags" }, h12("input", {
          className: "dtv-input",
          value: rule.flags,
          disabled: busy,
          spellCheck: false,
          onChange: (event) => set({ flags: event.target.value })
        })),
        h12(Field5, { labelKey: "regex.target" }, h12(
          "select",
          {
            className: "dtv-select",
            value: rule.target,
            disabled: busy,
            onChange: (event) => set({ target: event.target.value })
          },
          h12("option", { value: "assistant" }, uiMessage("regex.target.assistant")),
          h12("option", { value: "user" }, uiMessage("regex.target.user")),
          h12("option", { value: "both" }, uiMessage("regex.target.both"))
        ))
      ),
      h12(
        "div",
        { className: "dtv-entry-grid" },
        h12(Field5, { labelKey: "regex.scope" }, h12(
          "select",
          {
            className: "dtv-select",
            value: rule.scope.kind,
            disabled: busy,
            onChange: (event) => setScope({
              kind: event.target.value,
              resourceId: event.target.value === "global" ? null : rule.scope.resourceId
            })
          },
          ...SCOPE_KINDS.map((kind) => h12("option", { key: kind, value: kind }, uiMessage(`regex.scope.${kind}`)))
        )),
        rule.scope.kind === "global" ? null : h12(Field5, { labelKey: "regex.resourceId" }, h12("input", {
          className: "dtv-input",
          value: rule.scope.resourceId ?? "",
          disabled: busy,
          onChange: (event) => setScope({ resourceId: event.target.value || null })
        }))
      ),
      h12("div", { className: "dtv-entry-actions" }, h12("button", {
        className: "dtv-button dtv-danger",
        type: "button",
        disabled: busy,
        onClick: remove
      }, uiMessage("common.delete")))
    )
  );
}
function RegexPanel({ client, activeSnapshot, close }) {
  const [document2, setDocument] = (0, import_react12.useState)(EMPTY_DOCUMENT);
  const [savedDocument, setSavedDocument] = (0, import_react12.useState)(EMPTY_DOCUMENT);
  const [scopeKind, setScopeKind] = (0, import_react12.useState)("global");
  const [busy, setBusy] = (0, import_react12.useState)(false);
  const [status, setStatus] = (0, import_react12.useState)({ text: uiMessage("common.loading"), error: false });
  const fileInput = (0, import_react12.useRef)(null);
  const bindings = activeRegexBindings(activeSnapshot);
  const dirty = JSON.stringify(document2) !== JSON.stringify(savedDocument);
  const load = async () => {
    setBusy(true);
    try {
      const next = await getRegexDocument(client);
      setDocument(next);
      setSavedDocument(next);
      setStatus({ text: uiMessage("regex.loaded", { count: next.rules.length }), error: false });
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true });
    } finally {
      setBusy(false);
    }
  };
  (0, import_react12.useEffect)(() => {
    load();
  }, [client]);
  const persist = async (next) => {
    setBusy(true);
    try {
      const saved = await putRegexDocument(client, next);
      setDocument(saved);
      setSavedDocument(saved);
      setStatus({ text: uiMessage("regex.saved", { count: saved.rules.length }), error: false });
      window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true });
    } finally {
      setBusy(false);
    }
  };
  const guardedLoad = () => {
    if (dirty && !window.confirm(unwrapText(uiMessage("regex.confirmReload")))) return;
    load();
  };
  const guardedClose = () => {
    if (dirty && !window.confirm(unwrapText(uiMessage("regex.confirmClose")))) return;
    close();
  };
  const addRule = () => {
    const rule = normalizeRegexRule({
      name: unwrapText(uiMessage("regex.newRule")),
      enabled: true,
      find: "",
      replace: "",
      flags: "g",
      target: "assistant"
    }, { scope: scopeFor(scopeKind, bindings) });
    setDocument((current2) => ({ ...current2, rules: [...current2.rules, rule] }));
  };
  const updateRule = (next) => setDocument((current2) => ({
    ...current2,
    rules: current2.rules.map((rule) => rule.id === next.id ? next : rule)
  }));
  const removeRule = (id) => setDocument((current2) => ({
    ...current2,
    rules: current2.rules.filter((rule) => rule.id !== id)
  }));
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const imported = importRegexDocument(JSON.parse(await file.text()), {
        scope: scopeFor(scopeKind, bindings)
      });
      await persist({ ...document2, rules: [...document2.rules, ...imported] });
      setStatus({ text: uiMessage("regex.imported", { count: imported.length }), error: false });
    } catch (reason) {
      setStatus({ text: rawText(reason instanceof Error ? reason.message : String(reason)), error: true });
      setBusy(false);
    }
  };
  const visibleRules = document2.rules.filter((rule) => rule.scope.kind === scopeKind);
  const title = uiMessage("regex.title");
  const closeLabel = uiMessage("panel.close", { title: unwrapText(title) });
  return h12(
    "div",
    { className: "dtv-panel dtv-regex-panel" },
    h12(
      "div",
      { className: "dtv-header" },
      h12("div", { className: "dtv-title" }, title),
      h12("button", { className: "dtv-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: guardedClose }, "\u2715")
    ),
    h12(
      "div",
      { className: "dtv-body" },
      h12("p", { className: "dtv-note" }, uiMessage("regex.displayOnlyNote")),
      h12(
        "div",
        { className: "dtv-regex-scopes", role: "tablist", "aria-label": uiMessage("regex.scopes") },
        ...SCOPE_KINDS.map((kind) => h12("button", {
          className: "dtv-button",
          type: "button",
          role: "tab",
          key: kind,
          "aria-selected": scopeKind === kind,
          "data-selected": scopeKind === kind,
          onClick: () => setScopeKind(kind)
        }, uiMessage(`regex.scope.${kind}`)))
      ),
      scopeKind === "preset" && bindings.presetId === null ? h12("p", { className: "dtv-note" }, uiMessage("regex.noPreset")) : scopeKind === "character" && bindings.characterId === null ? h12("p", { className: "dtv-note" }, uiMessage("regex.noCharacter")) : null,
      h12(
        "div",
        { className: "dtv-book-toolbar" },
        h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: addRule }, uiMessage("regex.add")),
        h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: () => fileInput.current?.click() }, uiMessage("common.importJson")),
        h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: () => downloadJson(document2) }, uiMessage("common.exportJson"))
      ),
      h12("input", { ref: fileInput, type: "file", accept: "application/json,.json", hidden: true, onChange: importFile }),
      visibleRules.length === 0 ? h12("p", { className: "dtv-note" }, uiMessage("regex.emptyScope")) : visibleRules.map((rule) => h12(RuleEditor, {
        key: rule.id,
        rule,
        busy,
        update: updateRule,
        remove: () => removeRule(rule.id)
      })),
      h12("div", { className: "dtv-status", "data-error": status.error }, status.text),
      h12(
        "div",
        { className: "dtv-regex-footer" },
        h12("button", { className: "dtv-button", type: "button", disabled: busy, onClick: guardedLoad }, uiMessage("common.reload")),
        h12("button", { className: "dtv-button dtv-primary", type: "button", disabled: busy || !dirty, onClick: () => persist(document2) }, busy ? uiMessage("common.working") : uiMessage("common.saveChanges"))
      )
    )
  );
}

// packages/client/src/index.js
var h13 = createLocalizedElement(import_react13.createElement);
var css11 = `
.dtv-layer{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:Inter,var(--dsw-font-family),sans-serif;color:var(--dsw-alias-label-primary)}
.dtv-launcher{position:absolute;z-index:2;width:44px;height:44px;pointer-events:auto;overflow:hidden;border:0 solid transparent;border-radius:22px;background:transparent;box-shadow:none;transition:width .22s ease,height .22s ease,border-radius .22s ease,background-color .18s ease,box-shadow .18s ease;display:block}
.dtv-launcher[data-open=true] .dtv-menu{overflow-y:auto}
.dtv-launcher[data-open=true]{width:300px;height:376px;border-width:1px;border-color:var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-base);box-shadow:var(--ds-shadow-3,0 12px 34px rgba(0,0,0,.24))}
.dtv-ball-row{position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:flex-start;pointer-events:none}.dtv-launcher[data-side=left] .dtv-ball-row{justify-content:flex-end}.dtv-launcher[data-vertical=up] .dtv-ball-row{top:auto;bottom:0;align-items:flex-end}
.dtv-ball{pointer-events:auto;touch-action:none;user-select:none;width:44px;height:44px;flex:none;border:2px solid #fff;border-radius:50%;background:conic-gradient(from 225deg,#090909 0 56%,#18569d 56% 100%);box-shadow:0 0 0 2px #174e8a,0 6px 20px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.28);color:#fff;font-size:13px;letter-spacing:-.5px;font-weight:850;text-shadow:0 1px 2px #000;cursor:grab;transition:filter .15s ease,transform .18s ease,box-shadow .18s ease,background .18s ease}.dtv-ball:hover{filter:brightness(1.1);box-shadow:0 0 0 2px #2675c9,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-layer[data-chrome=play] .dtv-ball{background:conic-gradient(from 225deg,#090909 0 56%,#b31319 56% 100%);box-shadow:0 0 0 2px #a50f16,0 6px 20px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.28)}.dtv-layer[data-chrome=play] .dtv-ball:hover{box-shadow:0 0 0 2px #d5222b,0 8px 24px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.35)}.dtv-ball:active{cursor:grabbing}.dtv-launcher[data-open=true] .dtv-ball{transform:scale(.82) rotate(-8deg)}
.dtv-menu{position:absolute;left:8px;right:8px;top:52px;bottom:8px;padding:1px;display:flex;flex-direction:column;gap:4px;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-6px);transition:opacity .12s ease,transform .18s ease,visibility 0s linear .18s}.dtv-launcher[data-open=true] .dtv-menu{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:.22s,.16s,.22s}.dtv-launcher[data-vertical=up] .dtv-menu{top:8px;bottom:52px;transform:translateY(6px)}.dtv-launcher[data-open=true][data-vertical=up] .dtv-menu{transform:none}
.dtv-menu-title{flex:none;padding:5px 8px 7px;font-size:11px;line-height:1.35;font-weight:650;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtv-menu-item{min-height:43px;border:0;border-radius:9px;padding:5px 8px;background:transparent;color:var(--dsw-alias-label-primary);text-align:left;font:inherit;cursor:pointer;display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center}.dtv-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dtv-menu-item[data-active=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip))}.dtv-binding-dot{width:8px;height:8px;border-radius:50%;background:#d33239;box-shadow:0 0 0 1px rgba(98,0,4,.38)}.dtv-menu-item[data-bound=true] .dtv-binding-dot{background:#44d17a;box-shadow:0 0 5px #31c66b,0 0 10px rgba(49,198,107,.75)}.dtv-item-copy{min-width:0;display:flex;flex-direction:column;gap:1px}.dtv-item-label{font-size:11px;font-weight:700;line-height:1.2}.dtv-item-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:1.25;color:var(--dsw-alias-label-tertiary)}.dtv-item-count{border-radius:10px;padding:2px 6px;background:var(--dsw-specific-tip);font-size:9px;color:var(--dsw-alias-label-secondary)}.dtv-item-planned{font-size:9px;color:var(--dsw-alias-label-tertiary)}
.dtv-menu-item[data-show-binding=false] .dtv-binding-dot{visibility:hidden}
.dtv-panel{position:absolute;z-index:1;top:0;right:0;bottom:0;width:min(440px,calc(100vw - 56px));pointer-events:auto;border-left:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,-8px 0 28px rgba(0,0,0,.18));background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}
.dtv-header{height:52px;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}.dtv-title{font-size:14px;font-weight:650;flex:1}.dtv-close{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:7px;padding:6px 8px}.dtv-close:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtv-body{min-height:0;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}.dtv-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);margin:0;overflow-wrap:anywhere}.dtv-status{font-size:11px;line-height:1.45;border-radius:7px;padding:8px 10px;background:var(--dsw-specific-tip);overflow-wrap:anywhere}.dtv-status[data-error=true]{color:var(--dsw-alias-state-error)}
.dtv-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dtv-button{min-height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-button-secondary-fill,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;padding:7px 10px;font-size:12px}.dtv-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dtv-button:disabled{opacity:.5;cursor:default}
.dtv-primary{background:var(--dsw-alias-state-business-primary,#2677d9);border-color:transparent;color:var(--dsw-alias-button-primary-label,#fff)}.dtv-primary:hover:not(:disabled){filter:brightness(1.08);background:var(--dsw-alias-state-business-primary,#2677d9)}.dtv-template-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.dtv-resource{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:7px}.dtv-resource-title{font-size:12px;font-weight:650}.dtv-resource-meta{font-size:11px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}.dtv-list{margin:0;padding-left:18px;font-size:11px;line-height:1.55}.dtv-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-specific-tip);padding:9px;display:flex;flex-direction:column;gap:6px}.dtv-preview-title{font-size:12px;font-weight:700}.dtv-preview-row{display:grid;grid-template-columns:112px minmax(0,1fr);gap:8px;font-size:11px;line-height:1.45}.dtv-preview-label{color:var(--dsw-alias-label-tertiary)}.dtv-preview-value{overflow-wrap:anywhere}.dtv-preview-options{margin-left:120px;display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--dsw-alias-label-tertiary)}.dtv-preview-list{margin:0;padding-left:18px}.dtv-preview-row[data-missing=true] .dtv-preview-value,.dtv-preview-list>[data-missing=true]{color:var(--dsw-alias-state-error)}
.dtv-book-toolbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}.dtv-entry{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);overflow:hidden}.dtv-entry>summary{list-style:none;cursor:pointer;padding:8px;display:flex;align-items:center;gap:7px;font-size:11px}.dtv-entry>summary::-webkit-details-marker{display:none}.dtv-entry-dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.dtv-entry[data-enabled=true] .dtv-entry-dot{background:var(--dsw-alias-state-success,#2fa36b)}.dtv-entry-name{font-weight:620;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtv-entry-state{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px}.dtv-entry-body{border-top:1px solid var(--dsw-alias-border-l1);padding:8px;display:flex;flex-direction:column;gap:8px}.dtv-field{display:flex;flex-direction:column;gap:4px}.dtv-label{font-size:10px;font-weight:620;color:var(--dsw-alias-label-tertiary)}.dtv-input,.dtv-select,.dtv-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;padding:7px 8px}.dtv-input,.dtv-select{height:32px}.dtv-textarea{min-height:94px;resize:vertical;line-height:1.45}.dtv-policy{min-height:96px}.dtv-entry-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.dtv-checks{display:flex;flex-wrap:wrap;gap:10px}.dtv-check{display:flex;gap:5px;align-items:center;font-size:10px}.dtv-entry-actions{display:flex;justify-content:flex-end}.dtv-danger{color:var(--dsw-alias-state-error)}
.dtv-layer>.dtv-launcher,.dtv-layer>.dtv-panel,.dtv-layer>.dcc-panel,.dtv-layer>.dwb-panel,.dtv-layer>.dtu-panel{zoom:var(--dtv-ui-scale,1)}.dtv-setting-value{font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.dtv-modal-backdrop{position:absolute;inset:0;z-index:20;pointer-events:auto;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:24px}
.dtv-regex-scopes{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.dtv-regex-scopes .dtv-button[data-selected=true]{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-specific-tip));border-color:var(--dsw-alias-state-business-primary,#2677d9)}.dtv-regex-expression{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);min-height:72px}.dtv-regex-footer{position:sticky;bottom:-12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 0 12px;background:var(--dsw-alias-bg-base)}
.dtv-modal{width:min(420px,100%);border-radius:12px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);box-shadow:var(--ds-shadow-3,0 16px 40px rgba(0,0,0,.28));padding:18px 16px;display:flex;flex-direction:column;gap:14px}
.dtv-modal-body{margin:0;font-size:13px;line-height:1.55}.dtv-modal .dtv-button{align-self:flex-end;min-width:88px}
`;
var LAUNCHER_STORAGE_KEY = `${PLUGIN_ID}:launcher-position:v1`;
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
  const response = await fetch(`${API_V1}/active${query}`);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    const message = typeof data?.error === "string" ? data.error : data?.error?.message;
    throw new Error(message ?? `HTTP ${response.status}`);
  }
  return data;
}
async function sessionConfigurationRequest(path, body2) {
  const response = await fetch(`${API_V1}${path}`, {
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
async function rpAlertRequest(sessionId, { method = "GET", id } = {}) {
  const params = new URLSearchParams({ sessionId });
  if (id !== void 0) params.set("id", String(id));
  const mutating = method !== "GET" && method !== "HEAD";
  const response = await fetch(`${API_V1}/rp-alert?${params}`, {
    method,
    headers: mutating ? { "Content-Type": "application/json" } : void 0,
    body: mutating ? "{}" : void 0
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data;
}
async function rpPolicyRequest(method = "GET", body2) {
  const response = await fetch(`${API_V1}/rp-policy`, {
    method,
    headers: method === "GET" ? void 0 : { "Content-Type": "application/json" },
    body: body2 === void 0 ? void 0 : JSON.stringify(body2)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data;
}
async function uiSettingsRequest(method = "GET", body2) {
  const response = await fetch(`${API_V1}/ui-settings`, {
    method,
    headers: method === "GET" ? void 0 : { "Content-Type": "application/json" },
    body: body2 === void 0 ? void 0 : JSON.stringify(body2)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data.settings;
}
function PanelHeader({ title, titleKey, close }) {
  const titleText = titleKey ? uiMessage(titleKey) : title;
  const closeLabel = uiMessage("panel.close", { title: unwrapText(titleText) });
  return h13(
    "div",
    { className: "dtv-header" },
    h13("div", { className: "dtv-title" }, titleText),
    h13("button", { className: "dtv-close", type: "button", title: closeLabel, "aria-label": closeLabel, onClick: close }, "\u2715")
  );
}
function Field6({ label, children }) {
  return h13("label", { className: "dtv-field" }, h13("span", { className: "dtv-label" }, label), children);
}
function SettingsPanel({
  settings,
  status,
  busy,
  close,
  update,
  reset,
  policyDraft,
  policyBusy,
  policyLoaded,
  onPolicyDraft,
  savePolicy,
  resetPolicy
}) {
  const percent = Math.round(settings.scale * 100);
  return h13(
    "div",
    { className: "dtv-panel" },
    h13(
      "div",
      { className: "dtv-header" },
      h13("div", { className: "dtv-title" }, translate("settings.title")),
      h13("button", { className: "dtv-close", type: "button", title: translate("settings.close"), "aria-label": translate("settings.close"), onClick: close }, "\u2715")
    ),
    h13(
      "div",
      { className: "dtv-body" },
      h13(Field6, { label: translate("settings.language") }, h13(
        "select",
        {
          className: "dtv-select",
          value: settings.locale,
          disabled: busy,
          onChange: (event) => update({ ...settings, locale: event.target.value })
        },
        ...UI_LOCALES.map((locale) => h13("option", { key: locale.id, value: locale.id }, rawText(locale.nativeName)))
      )),
      h13(Field6, { label: translate("settings.scale") }, h13("select", {
        className: "dtv-select",
        value: settings.scale,
        disabled: busy,
        onChange: (event) => update({ ...settings, scale: Number(event.target.value) })
      }, ...UI_SCALE_OPTIONS.map((scale) => h13("option", { key: scale, value: scale }, `${Math.round(scale * 100)}%`)))),
      h13("div", { className: "dtv-setting-value" }, translate("settings.currentScale", { scale: percent })),
      h13("p", { className: "dtv-note" }, translate("settings.scale.help")),
      h13(
        "label",
        { className: "dtv-check" },
        h13("input", {
          type: "checkbox",
          checked: settings.rpFollowCharacter !== false,
          disabled: busy,
          onChange: (event) => update({ ...settings, rpFollowCharacter: event.target.checked })
        }),
        h13("span", null, translate("settings.rpFollow"))
      ),
      h13("p", { className: "dtv-note" }, translate("settings.rpFollow.help")),
      h13(Field6, { label: translate("settings.rpPolicy") }, h13("textarea", {
        className: "dtv-textarea dtv-policy",
        value: policyDraft,
        placeholder: translate("settings.rpPolicy.placeholder"),
        disabled: busy || policyBusy || policyLoaded !== true,
        onChange: (event) => onPolicyDraft(event.target.value)
      })),
      h13("p", { className: "dtv-note" }, translate("settings.rpPolicy.help")),
      h13(
        "div",
        { className: "dtv-actions" },
        h13("button", {
          className: "dtv-button dtv-primary",
          type: "button",
          disabled: busy || policyBusy || policyLoaded !== true,
          onClick: savePolicy
        }, translate("settings.rpPolicy.save")),
        h13("button", {
          className: "dtv-button",
          type: "button",
          disabled: busy || policyBusy || policyLoaded !== true,
          onClick: resetPolicy
        }, translate("settings.rpPolicy.reset"))
      ),
      h13("div", { className: "dtv-status", "data-error": status.error || void 0, role: "status" }, rawText(status.text)),
      h13(
        "div",
        { className: "dtv-actions" },
        h13("button", { className: "dtv-button", type: "button", disabled: busy, onClick: reset }, translate("settings.reset"))
      )
    )
  );
}
var LOGIC_KEYS = Object.freeze({
  and_any: "world.logic.andAny",
  and_all: "world.logic.andAll",
  not_any: "world.logic.notAny",
  not_all: "world.logic.notAll"
});
function RpHighRiskDialog({ onDismiss }) {
  return h13(
    "div",
    {
      className: "dtv-modal-backdrop",
      role: "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "dtv-rp-block-body"
    },
    h13(
      "div",
      { className: "dtv-modal" },
      h13("p", { id: "dtv-rp-block-body", className: "dtv-modal-body" }, translate("rp.block.body")),
      h13("button", { className: "dtv-button dtv-primary", type: "button", onClick: onDismiss }, translate("rp.block.dismiss"))
    )
  );
}
function TavernShell({ useSessions, useWorkspaces, createCleanSession, playClient, playSlots }) {
  const [menuOpen, setMenuOpen] = (0, import_react13.useState)(false);
  const [surface, setSurface] = (0, import_react13.useState)(null);
  const [anchor, setAnchor] = (0, import_react13.useState)(initialLauncherAnchor);
  const [chromeMode, setChromeMode] = (0, import_react13.useState)("native");
  const [chromeError, setChromeError] = (0, import_react13.useState)("");
  const [activeSnapshot, setActiveSnapshot] = (0, import_react13.useState)(null);
  const [statusError, setStatusError] = (0, import_react13.useState)("");
  const [uiSettings, setUiSettings] = (0, import_react13.useState)(getClientUiSettings);
  const [settingsStatus, setSettingsStatus] = (0, import_react13.useState)({ text: translate("settings.saved"), error: false });
  const [settingsBusy, setSettingsBusy] = (0, import_react13.useState)(false);
  const [rpPolicyDraft, setRpPolicyDraft] = (0, import_react13.useState)("");
  const [rpPolicyLoaded, setRpPolicyLoaded] = (0, import_react13.useState)(false);
  const [rpPolicyBusy, setRpPolicyBusy] = (0, import_react13.useState)(false);
  const [rpAlert, setRpAlert] = (0, import_react13.useState)(null);
  const drag = (0, import_react13.useRef)(null);
  const suppressClick = (0, import_react13.useRef)(false);
  const chromeModeRef = (0, import_react13.useRef)("native");
  const chromeController = (0, import_react13.useRef)(null);
  const statusGeneration = (0, import_react13.useRef)(0);
  const rpAlertRef = (0, import_react13.useRef)(null);
  const dismissedRpAlerts = (0, import_react13.useRef)(/* @__PURE__ */ new Set());
  const sessionId = useSessions((state) => state.current);
  const sessionBlank = useSessions((state) => state.current === void 0 || state.current === null ? true : state.byId?.[state.current]?.blank === true);
  const workspaceId = useWorkspaces((state) => workspaceTargetId(state, sessionId));
  const close = () => setSurface(null);
  if (rpAlert === null || dismissedRpAlerts.current.has(rpAlert.id)) rpAlertRef.current = null;
  else rpAlertRef.current = rpAlert;
  (0, import_react13.useEffect)(() => {
    let active = true;
    let channel = null;
    try {
      if (typeof BroadcastChannel === "function") channel = new BroadcastChannel(`${PLUGIN_ID}:chrome`);
    } catch {
    }
    const commitChrome = (mode) => {
      chromeModeRef.current = mode;
      setChromeMode(mode);
      playSlots.setMode(mode);
      if (mode !== "play") setSurface((current2) => current2 === "regex" ? null : current2);
    };
    const refreshChrome = async () => {
      try {
        const saved = await playClient.getChrome();
        if (!active) return;
        commitChrome(saved.mode);
        setChromeError("");
      } catch (reason) {
        if (!active) return;
        setChromeError(reason instanceof Error ? reason.message : String(reason));
      }
    };
    const controller2 = createChromeClickController({
      getMode: () => chromeModeRef.current,
      persistMode: (mode) => playClient.putChrome(mode),
      openMenu: () => setMenuOpen((value) => !value),
      closeMenu: () => setMenuOpen(false),
      setMode: (mode) => {
        commitChrome(mode);
        try {
          channel?.postMessage({ mode });
        } catch {
        }
      },
      setError: (reason) => setChromeError(reason instanceof Error ? reason.message : reason == null ? "" : String(reason))
    });
    chromeController.current = controller2;
    const onFocus = () => refreshChrome();
    const onChromeMessage = (event) => {
      if (event.data?.mode === "native" || event.data?.mode === "play") commitChrome(event.data.mode);
    };
    if (channel !== null) channel.addEventListener("message", onChromeMessage);
    window.addEventListener("focus", onFocus);
    refreshChrome();
    return () => {
      active = false;
      controller2.dispose();
      if (chromeController.current === controller2) chromeController.current = null;
      window.removeEventListener("focus", onFocus);
      channel?.removeEventListener("message", onChromeMessage);
      channel?.close();
    };
  }, [playClient, playSlots]);
  (0, import_react13.useEffect)(() => {
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
  (0, import_react13.useEffect)(() => {
    if (surface !== "settings") return void 0;
    let active = true;
    setRpPolicyLoaded(false);
    rpPolicyRequest().then((next) => {
      if (!active) return;
      setRpPolicyDraft(typeof next.section === "string" ? next.section : "");
      setRpPolicyLoaded(true);
    }).catch((reason) => {
      if (!active) return;
      setSettingsStatus({ text: translate("settings.loadError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    });
    return () => {
      active = false;
    };
  }, [surface]);
  const persistRpPolicy = async () => {
    setRpPolicyBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = await rpPolicyRequest("PUT", { section: rpPolicyDraft });
      setRpPolicyDraft(saved.section);
      setRpPolicyLoaded(true);
      setSettingsStatus({ text: translate("settings.rpPolicy.saved"), error: false });
    } catch (reason) {
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setRpPolicyBusy(false);
    }
  };
  const resetRpPolicy = async () => {
    setRpPolicyBusy(true);
    setSettingsStatus({ text: translate("settings.saving"), error: false });
    try {
      const saved = await rpPolicyRequest("DELETE");
      setRpPolicyDraft(saved.section);
      setRpPolicyLoaded(true);
      setSettingsStatus({ text: translate("settings.rpPolicy.saved"), error: false });
    } catch (reason) {
      setSettingsStatus({ text: translate("settings.saveError", { message: reason instanceof Error ? reason.message : String(reason) }), error: true });
    } finally {
      setRpPolicyBusy(false);
    }
  };
  const refreshStatus = (0, import_react13.useCallback)(async () => {
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
  (0, import_react13.useEffect)(() => {
    statusGeneration.current += 1;
    setActiveSnapshot(null);
    setStatusError("");
    refreshStatus();
    return () => {
      statusGeneration.current += 1;
    };
  }, [refreshStatus, sessionId]);
  (0, import_react13.useEffect)(() => {
    const onRefresh = () => refreshStatus();
    window.addEventListener(CLIENT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(CLIENT_REFRESH_EVENT, onRefresh);
  }, [refreshStatus]);
  (0, import_react13.useEffect)(() => {
    const onResize = () => setAnchor((current2) => {
      const next = clampLauncherAnchor(current2, viewport(), uiSettings.scale);
      persistLauncherAnchor(next);
      return next;
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [uiSettings.scale]);
  (0, import_react13.useEffect)(() => {
    setAnchor((current2) => {
      const next = clampLauncherAnchor(current2, viewport(), uiSettings.scale);
      persistLauncherAnchor(next);
      return next;
    });
  }, [uiSettings.scale]);
  (0, import_react13.useEffect)(() => {
    if (typeof sessionId !== "string" || sessionId === "") {
      dismissedRpAlerts.current = /* @__PURE__ */ new Set();
      rpAlertRef.current = null;
      setRpAlert(null);
      return void 0;
    }
    let active = true;
    const poll = async () => {
      try {
        const data = await rpAlertRequest(sessionId);
        if (!active || data?.alert == null) return;
        if (dismissedRpAlerts.current.has(data.alert.id)) return;
        if (rpAlertRef.current?.id === data.alert.id) return;
        setRpAlert(data.alert);
      } catch {
      }
    };
    poll();
    const timer = window.setInterval(poll, 800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);
  const dismissRpAlert = async () => {
    const alert = rpAlertRef.current ?? rpAlert;
    if (alert?.id != null) dismissedRpAlerts.current.add(alert.id);
    rpAlertRef.current = null;
    setRpAlert(null);
    if (typeof sessionId !== "string" || sessionId === "" || alert?.id == null) return;
    try {
      await rpAlertRequest(sessionId, { method: "DELETE", id: alert.id });
    } catch {
    }
  };
  (0, import_react13.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (rpAlert !== null) dismissRpAlert();
      else if (menuOpen) setMenuOpen(false);
      else if (surface !== null) setSurface(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, rpAlert, surface]);
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
  const consumeSuppressedClick = () => {
    if (!suppressClick.current) return false;
    suppressClick.current = false;
    return true;
  };
  const clickLauncher = () => chromeController.current?.click({
    suppressed: consumeSuppressedClick()
  });
  const contextSwitchLauncher = (event) => {
    event.preventDefault();
    chromeController.current?.switchMode({ suppressed: consumeSuppressedClick() });
  };
  const switchChrome = () => chromeController.current?.switchMode();
  const open = (id) => {
    setMenuOpen(false);
    setSurface(id);
    window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT));
  };
  let panel = null;
  if (surface === "preset") {
    panel = h13("div", { className: "dtv-panel" }, h13(PresetSidebar, {
      closePanel: close,
      openPanel: () => {
      },
      sessionId,
      sessionBlank,
      autoOpen: false
    }));
  } else if (surface === "character") {
    panel = h13(CharacterPanel, { sessionId, sessionBlank, close });
  } else if (surface === "regex" && chromeMode === "play") {
    panel = h13(RegexPanel, { client: playClient, activeSnapshot, close });
  } else if (surface === "world-info") {
    panel = h13(WorldBookPanel, { sessionId, close });
  } else if (surface === "user") {
    panel = h13(UserPanel, { sessionId, sessionBlank, close });
  } else if (surface === "session-template") {
    panel = h13(SessionTemplatePanel, { sessionId, workspaceId, createCleanSession, close });
  } else if (surface === "settings") {
    panel = h13(SettingsPanel, {
      settings: uiSettings,
      status: settingsStatus,
      busy: settingsBusy,
      close,
      update: persistSettings,
      reset: resetSettings,
      policyDraft: rpPolicyDraft,
      policyBusy: rpPolicyBusy,
      policyLoaded: rpPolicyLoaded,
      onPolicyDraft: setRpPolicyDraft,
      savePolicy: persistRpPolicy,
      resetPolicy: resetRpPolicy
    });
  }
  const placement = launcherPlacement(anchor, viewport(), menuOpen, uiSettings.scale);
  const statuses = launcherResourceStatuses(activeSnapshot);
  const chromeSwitchLabel = chromeMode === "play" ? uiMessage("chrome.switchToNative") : uiMessage("chrome.switchToPlay");
  const chromeStatusLabel = chromeMode === "play" ? uiMessage("chrome.currentPlay") : uiMessage("chrome.currentNative");
  return h13(
    "div",
    { className: "dtv-layer", lang: uiSettings.locale, "data-chrome": chromeMode, "data-surface-open": surface !== null, style: { "--dtv-ui-scale": uiSettings.scale } },
    panel,
    rpAlert === null ? null : h13(RpHighRiskDialog, { onDismiss: dismissRpAlert }),
    h13(
      "div",
      {
        className: "dtv-launcher",
        "data-open": menuOpen,
        "data-side": placement.side,
        "data-vertical": placement.vertical,
        style: { left: placement.left / uiSettings.scale, top: placement.top / uiSettings.scale }
      },
      h13("div", { className: "dtv-ball-row" }, h13("button", {
        className: "dtv-ball",
        type: "button",
        title: uiMessage("nav.launcher"),
        "aria-label": uiMessage("nav.launcher"),
        "aria-expanded": menuOpen,
        onPointerDown: startDrag,
        onPointerMove: moveDrag,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onClick: clickLauncher,
        onContextMenu: contextSwitchLauncher
      }, "DT")),
      h13(
        "div",
        { className: "dtv-menu", role: "menu" },
        h13("div", { className: "dtv-menu-title", "aria-live": "polite" }, chromeError === "" && statusError === "" ? uiMessage("nav.menuTitle", { session: sessionId || translate("nav.session.none") }) : uiMessage("nav.syncFailed", { message: chromeError || statusError })),
        h13(
          "button",
          {
            className: "dtv-menu-item",
            type: "button",
            role: "menuitem",
            title: chromeSwitchLabel,
            "aria-label": chromeSwitchLabel,
            "data-show-binding": false,
            onClick: switchChrome
          },
          h13("span", { "aria-hidden": "true" }, "\u2194"),
          h13(
            "span",
            { className: "dtv-item-copy" },
            h13("span", { className: "dtv-item-label" }, chromeSwitchLabel),
            h13("span", { className: "dtv-item-status" }, chromeStatusLabel)
          ),
          h13("span", { className: "dtv-item-planned" }, chromeMode === "play" ? "ST" : "DSH")
        ),
        ...TAVERN_MENU_ITEMS.filter((item) => !item.playOnly || chromeMode === "play").map((item) => {
          const status = statuses[item.id] ?? { bound: false, count: 0, titleKey: item.emptyTitleKey };
          const itemLabel = unwrapText(uiMessage(item.labelKey));
          const statusTitle = status.bound ? status.title : unwrapText(uiMessage(status.titleKey ?? item.emptyTitleKey));
          const stateLabel = item.binding === false ? "" : unwrapText(uiMessage(status.bound ? "common.bound" : "common.unbound"));
          const titleText = stateLabel ? uiMessage("nav.itemTitleBound", { label: itemLabel, title: statusTitle, state: stateLabel }) : uiMessage("nav.itemTitle", { label: itemLabel, title: statusTitle });
          const ariaText = stateLabel ? uiMessage("nav.itemAriaBound", { label: itemLabel, title: statusTitle, state: stateLabel }) : uiMessage("nav.itemAria", { label: itemLabel, title: statusTitle });
          return h13(
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
            item.binding === false ? h13("span", { "aria-hidden": "true" }) : h13("span", { className: "dtv-binding-dot", "aria-hidden": "true" }),
            h13(
              "span",
              { className: "dtv-item-copy" },
              h13("span", { className: "dtv-item-label" }, uiMessage(item.labelKey)),
              h13("span", { className: "dtv-item-status" }, status.bound ? rawText(status.title) : uiMessage(status.titleKey ?? item.emptyTitleKey))
            ),
            status.count > 1 ? h13("span", { className: "dtv-item-count", "aria-label": uiMessage("nav.bookCount", { count: status.count }) }, uiMessage("nav.bookCount", { count: status.count })) : item.available ? null : h13("span", { className: "dtv-item-planned" }, uiMessage("common.planned"))
          );
        })
      )
    )
  );
}
function installStyles6() {
  if (document.querySelector(`style[data-plugin-css="${PLUGIN_ID}-shell"]`) !== null) return;
  const style = document.createElement("style");
  style.dataset.pluginCss = `${PLUGIN_ID}-shell`;
  style.textContent = css11;
  document.head.append(style);
}
var name = PLUGIN_ID;
var inject = ["slots", "layout", "sessions", "workspaces"];
function apply(ctx) {
  installPresetStyles();
  installCharacterStyles();
  installWorldBookStyles();
  installUserStyles();
  installTavernTraceStyles();
  installStyles6();
  registerTavernTraceView(ctx);
  const playClient = createLivePlayClient();
  const playSlots = installPlaySlotOccupancy(ctx, playClient);
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: `${PLUGIN_ID}-launcher`,
    order: 80,
    inject: () => ({
      playClient,
      playSlots,
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
        refresh: () => window.dispatchEvent(new Event(CLIENT_REFRESH_EVENT))
      })
    })
  }, TavernShell));
}

		return module.exports;
	}
});
