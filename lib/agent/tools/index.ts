import "server-only";

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { AgentTool } from "../types";

import { searchTools } from "./search";
import { companyTools } from "./company";
import { peopleTools } from "./people";
import { aiAnalysisTools } from "./ai-analysis";

/**
 * The full tool registry. Read/search tools (Phase 1) + AI-analysis tools
 * (Phase 2); write/action tools (Phase 3) are appended as they land.
 */
const REGISTRY: AgentTool[] = [...searchTools, ...companyTools, ...peopleTools, ...aiAnalysisTools];

export function getTools(): AgentTool[] {
  return REGISTRY;
}

export function getToolByName(name: string): AgentTool | undefined {
  return REGISTRY.find((t) => t.name === name);
}

/**
 * Build the Anthropic `tools` array from the registry. Each Zod schema is
 * converted to JSON Schema via `z.toJSONSchema` (Zod 4 native) and stripped of
 * the `$schema` meta-key, which the Messages API does not expect.
 */
export function buildAnthropicTools(): Anthropic.Tool[] {
  return REGISTRY.map((t) => {
    const jsonSchema = z.toJSONSchema(t.schema) as Record<string, unknown>;
    delete jsonSchema.$schema;
    return {
      name: t.name,
      description: t.description,
      input_schema: jsonSchema as Anthropic.Tool.InputSchema,
    };
  });
}
