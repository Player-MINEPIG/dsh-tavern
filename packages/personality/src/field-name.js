// Assembler localizes bare CC field names as roleplay-character fields. Use a
// display label separate from the stable field ID retained for attribution.
const fieldLabels = {
  name: '名称 / Personality name',
  system_prompt: '行为指引 / Behavior guidance',
  description: '描述 / Personality description',
  personality: '性格 / Personality traits',
  scenario: '背景 / Background',
  mes_example: '对话示例 / Dialogue examples',
  first_mes: '开场参考 / Opening reference',
  post_history_instructions: '补充指引 / Additional guidance',
  'evolution/after': '自我认识 / Self-understanding',
  'evolution/behavior': '行为变化 / Behavioral change',
  'evolution/boundary': '适用边界 / Scope',
  mood: '当前心情 / Current mood',
}

export function personalityFieldName(field) {
  const alternate = /^alternate_greetings\/(\d+)$/.exec(field)
  if (alternate) {
    const number = Number(alternate[1]) + 1
    return `人格卡 · 备选开场 ${number} / Alternate opening ${number}`
  }
  return `人格卡 · ${Object.hasOwn(fieldLabels, field) ? fieldLabels[field] : field}`
}
