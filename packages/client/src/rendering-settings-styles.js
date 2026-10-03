export const renderingSettingsStyles = `
.dtv-rendering-settings{min-width:0;display:flex;flex-direction:column;gap:12px}
.dtv-rendering-settings .dtv-script-info{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);padding:4px;font:inherit;cursor:pointer;flex:none}.dtv-rendering-settings .dtv-script-info:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#2677d9);border-radius:4px}
.dtv-rendering-settings h3,.dtv-rendering-settings h4,.dtv-rendering-settings p{margin:0}
.dtv-rendering-settings h3{font-size:14px}.dtv-rendering-settings h4{font-size:12px}
.dtv-rendering-settings .dtv-script-group{display:flex;flex-direction:column;gap:8px;min-width:0}
.dtv-rendering-settings .dtv-script-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;overflow-wrap:anywhere}
.dtv-rendering-settings .dtv-entry>summary{padding:10px;gap:8px;min-width:0}
.dtv-rendering-settings .dtv-entry>summary::after{content:'▸';flex:none;color:var(--dsw-alias-label-tertiary)}
.dtv-rendering-settings .dtv-entry[open]>summary::after{content:'▾'}
.dtv-rendering-settings .dtv-entry-name{flex:1;white-space:normal;overflow-wrap:anywhere}
.dtv-rendering-settings .dtv-entry-state{max-width:42%;text-align:right;white-space:normal;overflow-wrap:anywhere}
.dtv-rendering-settings input[type=checkbox]{flex:none;margin:0;accent-color:var(--dsw-alias-state-business-primary,#2677d9)}
.dtv-rendering-settings .dtv-entry-body{padding:10px;min-width:0;gap:10px}
.dtv-rendering-settings .dtv-script-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.dtv-rendering-settings .dtv-script-actions button{max-width:100%;white-space:normal}
.dtv-rendering-settings .dtv-script-source{width:100%;box-sizing:border-box;height:240px;min-height:160px;max-height:320px;resize:vertical;overflow:auto;white-space:pre;font:11px/1.6 ui-monospace,SFMono-Regular,monospace;padding:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.dtv-rendering-settings .dtv-script-help{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}
.dtv-rendering-settings .dtv-script-help summary{cursor:pointer}.dtv-rendering-settings .dtv-script-help p{margin-top:8px}
.dtv-rendering-settings .dtv-script-control{display:flex;gap:8px;align-items:center;font-size:12px}
.dtv-rendering-settings .dtv-script-operations{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}
.dtv-rendering-settings .dtv-dependency-items{max-height:360px;overflow:auto;min-width:0;display:flex;flex-direction:column;gap:6px}
.dtv-rendering-settings .dtv-dependency-items>.dtv-entry{flex-shrink:0}
.dtv-rendering-settings .dtv-dependency-graph{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:10px}
`
