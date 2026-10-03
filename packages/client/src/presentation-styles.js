import { conversationSettingsCss } from './conversation-settings-styles.js'

// Scoped to Tavern's editor controls; message CSS and DSH chrome are untouched.
// A long editor must scroll inside its viewport panel, without focus/scrollIntoView
// scrolling the Host overlay slot's zero-sized wrapper or its layout ancestor.
export const presentationCss = `
.dtv-conversation-settings{position:fixed}
.dtv-template-toggle{font-size:11px;line-height:1.45}
.dtv-bubble-editor{display:grid;gap:12px;font-size:12px;line-height:1.55}
.dtv-bubble-editor h3{margin:4px 0;font-size:15px}.dtv-bubble-editor p{margin:0;color:var(--dsw-alias-label-secondary,#637087)}
.dtv-bubble-editor>label:not(.dtv-check),.dtv-avatar-input>label{display:grid;gap:6px}
.dtv-bubble-editor input:not([type=checkbox]):not([type=range]):not([type=color]),.dtv-bubble-editor select,.dtv-bubble-editor textarea,.dtv-avatar-dialog select{box-sizing:border-box;width:100%;min-width:0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:8px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#253047);font:inherit}
.dtv-bubble-editor input[type=range]{display:block;width:100%;margin:6px 0;accent-color:var(--dsw-alias-state-business-primary,#2677d9)}
.dtv-bubble-editor input[type=color]{width:42px;height:30px;padding:2px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:6px;background:transparent}
.dtv-bubble-editor fieldset{min-width:0;margin:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:10px}.dtv-bubble-editor legend{padding:0 5px;font-weight:600}.dtv-bubble-editor summary{cursor:pointer;color:var(--dsw-alias-label-secondary,#637087)}
.dtv-bubble-editor button:where(:not(.dtv-play-turn-action)),.dtv-avatar-input button,.dtv-avatar-dialog button,.dtv-card-proposal button{padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:8px;font:inherit;font-size:12px;line-height:1.4;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#253047);cursor:pointer}
.dtv-bubble-editor button:where(:not(.dtv-play-turn-action)):disabled,.dtv-avatar-dialog button:disabled{opacity:.45;cursor:default}
.dtv-bubble-editor button:where(:not(.dtv-play-turn-action)):hover:not(:disabled),.dtv-avatar-dialog button:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary,#2677d9)}
.dtv-avatar-input{display:grid;gap:8px;font-size:12px}.dtv-avatar-input input[type=file]{min-width:0;max-width:100%;font:inherit}.dtv-avatar-input small{color:var(--dsw-alias-label-secondary,#637087)}
.dtv-avatar-dialog{font:13px/1.6 system-ui}.dtv-avatar-dialog h3,.dtv-avatar-dialog p{margin:0}.dtv-avatar-dialog::backdrop{background:transparent}
.dtv-style-toolbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dtv-style-toolbar button{padding:8px 4px}
.dtv-bubble-editor .dtv-primary{background:var(--dsw-alias-state-business-primary,#2677d9);color:var(--dsw-alias-button-primary-label,#fff);border-color:transparent}
.dtv-bubble-editor .dtv-check{display:flex;align-items:center;gap:6px;font-size:12px}
.dtv-size-control{display:grid;grid-template-columns:minmax(0,1fr) 72px auto;gap:10px;align-items:center}
.dtv-card-proposal{font:13px/1.5 system-ui;border-radius:8px}.dtv-card-proposal button+button{margin-left:8px}
${conversationSettingsCss}
`
