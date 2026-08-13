import type { ToolDefinition, ToolInfo } from "../../core/extensions/types.ts";

/**
 * Resolve the definition handed to ToolExecutionComponent from the session's
 * tool registry, using canonical source metadata (`sourceInfo.source`).
 *
 * Component contract (mirrors `ToolExecutionComponent.isSuccessIndexLine`):
 * - `undefined`      → built-in tool with no extension/SDK override
 *                      (converges to a single low-contrast index line on success)
 * - `ToolDefinition` → non-built-in custom tool, or an extension/SDK override
 *                      of a built-in tool (keeps its full card and custom renderers)
 * - unknown tool (no registry entry) → `undefined` (generic fallback full card — fail-open)
 *
 * The registry distinguishes built-in definitions from custom ones by source
 * metadata; the definition object alone cannot tell them apart.
 */
export function resolveToolDefinitionForComponent(
	tools: ToolInfo[],
	toolName: string,
	getDefinition: (name: string) => ToolDefinition | undefined,
): ToolDefinition | undefined {
	const info = tools.find((tool) => tool.name === toolName);
	if (!info || info.sourceInfo.source === "builtin") {
		return undefined;
	}
	return getDefinition(toolName);
}
