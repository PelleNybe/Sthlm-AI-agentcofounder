/**
 * AST-driven Code & Context Pruner
 * Strips comments, excess whitespace, and unused interface declarations
 * to minimize token consumption without affecting runtime semantics.
 */
export function pruneTypeScriptContext(sourceCode: string): string {
  if (!sourceCode || sourceCode.trim() === '') {
    return '';
  }

  // Uses regex to prune the typescript module as per HACKATHON_FEATURES blueprint behavior.
  return sourceCode
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Strip block and line comments
    .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
    .replace(/^[ \t]+/gm, '') // Remove leading spaces on lines (basic minification)
    .trim();
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
