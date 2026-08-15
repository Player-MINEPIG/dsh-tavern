import { compilePresetForDsh, projectPresetCallConfig } from './profile-compiler.js'

export class PresetRuntime {
  constructor(store) {
    this.store = store
  }

  compiledSelected(context = {}) {
    const preset = this.store.selected()
    return preset === null ? '' : compilePresetForDsh(preset, context)
  }

  selectedSystemPromptMode() {
    return this.store.selected()?.systemPromptMode === 'replace' ? 'replace' : 'append'
  }

  selectedCallConfig() {
    const preset = this.store.selected()
    return preset === null ? {} : projectPresetCallConfig(preset)
  }

  activeView() {
    return {
      selected: this.store.selectedSummary(),
      callConfig: this.selectedCallConfig(),
    }
  }
}
