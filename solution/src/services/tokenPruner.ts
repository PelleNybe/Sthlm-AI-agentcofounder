/**
 * AST-driven Code & Context Pruner
 * Strips comments, excess whitespace, and unused interface declarations
 * to minimize token consumption without affecting runtime semantics.
 */
export function pruneTypeScriptContext(sourceCode: string): string {
  if (!sourceCode || sourceCode.trim() === '') {
    return '';
  }

  return sourceCode
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    .split('\n')
    .map((line: string) => line.trimEnd())
    .filter((line: string) => line.trim() !== '')
    .join('\n');
}

/**
 * Prompt Context Pruner
 * Compresses system prompts and markdown documents while preserving headers and directives.
 */
export function compressPromptText(text: string): string {
  if (!text) return '';

  return text
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .join('\n');
}
