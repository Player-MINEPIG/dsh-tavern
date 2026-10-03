// Settings controls share Tavern's existing Host theme tokens, but never style
// native Host controls or the message/action previews inside the editor.
export const conversationSettingsCss = `
.dtv-conversation-settings{--dtv-settings-control-height:36px;--dtv-settings-control-radius:8px;--dtv-settings-control-padding:8px 10px;--dtv-settings-control-font-size:12px}
.dtv-conversation-settings :is(.dtv-button,.dtv-input,.dtv-select,.dtv-bubble-editor select,.dtv-bubble-editor input:not([type=checkbox]):not([type=range]):not([type=color]):not([type=file])){box-sizing:border-box;min-width:0;min-height:var(--dtv-settings-control-height);padding:var(--dtv-settings-control-padding);border-width:1px;border-style:solid;border-radius:var(--dtv-settings-control-radius);font-family:inherit;font-size:var(--dtv-settings-control-font-size);line-height:1.4}
.dtv-conversation-settings :is(.dtv-input,.dtv-select,.dtv-bubble-editor select,.dtv-bubble-editor input:not([type=checkbox]):not([type=range]):not([type=color]):not([type=file])){height:var(--dtv-settings-control-height);border-color:var(--dsw-alias-border-l2,#d8dee8);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#253047)}
.dtv-conversation-settings :is(.dtv-button,.dtv-input,.dtv-select,.dtv-bubble-editor select,.dtv-bubble-editor input,.dtv-bubble-editor textarea):focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#2677d9);outline-offset:2px}
.dtv-settings-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:none;padding-bottom:12px;border-bottom:1px solid var(--dsw-alias-border-l2,#d8dee8)}
.dtv-settings-tabs .dtv-button{width:100%;white-space:normal;overflow-wrap:anywhere}
.dtv-settings-tabs .dtv-button[aria-selected=true]{border-color:var(--dsw-alias-state-business-primary,#2677d9);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#2677d9) 10%,var(--dsw-alias-bg-base,#fff));color:var(--dsw-alias-state-business-primary,#2677d9);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary,#2677d9);font-weight:650}
`
