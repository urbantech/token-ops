/**
 * Prompt Recommendation Engine for TokenOps
 *
 * Rule-based prompt optimization that generates a revised prompt with
 * measurable token savings. Mirrors the optimization strategies from
 * core/src/backend/app/services/tool_schema_optimizer.py:
 *   - Remove redundant / filler phrases
 *   - Compress verbose context blocks
 *   - Deduplicate repeated instructions
 *   - Suggest template reuse for spec-type prompts
 *   - Flag batch patterns for script conversion
 *
 * Refs #15
 */

import { Classification } from '@/types/telemetry';
import type {
  PromptAnalysis,
  PromptRecommendation,
  PromptChange,
} from '@/types/prompt';
import { countTokens } from './prompt-analyzer';

// ---------------------------------------------------------------------------
// Filler / Redundancy Patterns (mirrors Python ToolSchemaOptimizer)
// ---------------------------------------------------------------------------

const FILLER_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /I\s+would\s+like\s+you\s+to\s+/gi, replacement: '' },
  { pattern: /Can\s+you\s+please\s+/gi, replacement: '' },
  { pattern: /Please\s+make\s+sure\s+to\s+/gi, replacement: '' },
  { pattern: /Please\s+ensure\s+that\s+/gi, replacement: '' },
  { pattern: /Please\s+note\s+that\s+/gi, replacement: '' },
  { pattern: /Please\s+remember\s+to\s+/gi, replacement: '' },
  { pattern: /It\s+is\s+(important|crucial|critical|essential)\s+that\s+/gi, replacement: '' },
  { pattern: /Make\s+sure\s+to\s+always\s+/gi, replacement: '' },
  { pattern: /You\s+should\s+always\s+/gi, replacement: '' },
  { pattern: /Don't\s+forget\s+to\s+/gi, replacement: '' },
  { pattern: /Remember\s+to\s+always\s+/gi, replacement: '' },
  { pattern: /As\s+mentioned\s+(earlier|before|above|previously),?\s*/gi, replacement: '' },
  { pattern: /As\s+I\s+said\s+(earlier|before|above),?\s*/gi, replacement: '' },
  { pattern: /Keep\s+in\s+mind\s+that\s+/gi, replacement: '' },
  { pattern: /It\s+is\s+worth\s+noting\s+that\s+/gi, replacement: '' },
];

// Context compression: collapse large code/doc blocks
const CONTEXT_BLOCK_RE = /```[\s\S]*?```/g;
const LARGE_QUOTE_RE = /"([^"]{200,})"/g;

// ---------------------------------------------------------------------------
// Recommendation Engine
// ---------------------------------------------------------------------------

/**
 * Generate an optimized prompt with detailed change descriptions and
 * token savings metrics.
 *
 * The engine applies changes in priority order:
 *   1. Remove repeated instructions (highest savings)
 *   2. Strip filler phrases
 *   3. Compress context blocks
 *   4. Add template / batch recommendations
 *
 * Each change is tracked so the UI can show exactly what was modified.
 */
export function generateRecommendation(
  prompt: string,
  analysis: PromptAnalysis
): PromptRecommendation {
  const changes: PromptChange[] = [];
  let revised = prompt;
  const originalTokens = countTokens(prompt);

  // -------------------------------------------------------------------------
  // 1. Deduplicate repeated instructions
  // -------------------------------------------------------------------------
  if (analysis.repeatedInstructions.length > 0) {
    for (const repeated of analysis.repeatedInstructions) {
      // Keep first occurrence, remove subsequent ones
      const escapedText = escapeRegex(repeated.text);
      const re = new RegExp(escapedText, 'gi');
      let matchIndex = 0;
      revised = revised.replace(re, (match) => {
        matchIndex++;
        return matchIndex === 1 ? match : '';
      });

      if (repeated.wastedTokens > 0) {
        changes.push({
          type: 'deduplicate',
          description: `Removed ${repeated.count - 1} duplicate occurrence(s) of "${truncate(repeated.text, 60)}"`,
          tokensSaved: repeated.wastedTokens,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Remove filler phrases
  // -------------------------------------------------------------------------
  let fillerTokensSaved = 0;
  for (const { pattern, replacement } of FILLER_REPLACEMENTS) {
    const matches = revised.match(pattern);
    if (matches) {
      for (const match of matches) {
        fillerTokensSaved += countTokens(match) - countTokens(replacement);
      }
      revised = revised.replace(pattern, replacement);
    }
  }

  if (fillerTokensSaved > 0) {
    changes.push({
      type: 'remove_redundancy',
      description: 'Removed filler phrases and polite padding',
      tokensSaved: fillerTokensSaved,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Compress large context blocks
  // -------------------------------------------------------------------------
  const codeBlocks = revised.match(CONTEXT_BLOCK_RE) || [];
  let contextTokensSaved = 0;

  for (const block of codeBlocks) {
    const blockTokens = countTokens(block);
    if (blockTokens > 200) {
      // For very large code blocks, add a compression hint
      const lines = block.split('\n');
      const language = lines[0]?.replace('```', '').trim() || '';
      const compressed = `\`\`\`${language}\n// [${lines.length - 2} lines of ${language || 'code'} — consider extracting to a file reference]\n\`\`\``;
      const saving = blockTokens - countTokens(compressed);
      if (saving > 10) {
        revised = revised.replace(block, compressed);
        contextTokensSaved += saving;
      }
    }
  }

  // Compress large quoted strings
  const largeQuotes = revised.match(LARGE_QUOTE_RE) || [];
  for (const quote of largeQuotes) {
    const quoteTokens = countTokens(quote);
    const summary = `"[${quoteTokens}-token quoted block — consider summarizing or referencing]"`;
    const saving = quoteTokens - countTokens(summary);
    if (saving > 10) {
      revised = revised.replace(quote, summary);
      contextTokensSaved += saving;
    }
  }

  if (contextTokensSaved > 0) {
    changes.push({
      type: 'compress_context',
      description: `Compressed ${codeBlocks.length + largeQuotes.length} large context block(s)`,
      tokensSaved: contextTokensSaved,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Classification-specific recommendations
  // -------------------------------------------------------------------------
  if (analysis.classification === Classification.UPDATING_SPECS) {
    changes.push({
      type: 'template_reuse',
      description:
        'This looks like a spec-update prompt. Consider creating a reusable template with placeholders for the variable parts.',
      tokensSaved: 0,
    });
  }

  if (analysis.classification === Classification.BATCH_COMMANDS) {
    changes.push({
      type: 'batch_conversion',
      description:
        'This prompt contains batch-style operations. Consider converting to a scripted pipeline to avoid repeated LLM calls.',
      tokensSaved: 0,
    });
  }

  // -------------------------------------------------------------------------
  // 5. Clean up whitespace artifacts from removals
  // -------------------------------------------------------------------------
  revised = revised
    .replace(/\n{3,}/g, '\n\n')
    .replace(/  +/g, ' ')
    .replace(/^\s+$/gm, '')
    .trim();

  // Shorten overly long single instructions (> 300 tokens per sentence)
  const sentences = revised.split(/(?<=[.!?])\s+/);
  let shortenSaved = 0;
  const shortened = sentences.map((sentence) => {
    const sentenceTokens = countTokens(sentence);
    if (sentenceTokens > 300) {
      // Truncate and add an ellipsis note
      const words = sentence.split(/\s+/);
      const half = Math.floor(words.length * 0.6);
      const cut = words.slice(0, half).join(' ') + '... [condensed — full detail in context]';
      shortenSaved += sentenceTokens - countTokens(cut);
      return cut;
    }
    return sentence;
  });

  if (shortenSaved > 0) {
    revised = shortened.join(' ');
    changes.push({
      type: 'shorten_instruction',
      description: 'Condensed overly long individual instructions',
      tokensSaved: shortenSaved,
    });
  }

  // -------------------------------------------------------------------------
  // Compute metrics
  // -------------------------------------------------------------------------
  const revisedTokens = countTokens(revised);
  const tokenReduction = Math.max(0, originalTokens - revisedTokens);
  const tokenReductionPercent =
    originalTokens > 0
      ? Math.round((tokenReduction / originalTokens) * 100)
      : 0;

  // Performance estimate: prompts with less waste tend to produce better
  // results. This is a heuristic — a real system would use RLHF data.
  const wasteRemoved = tokenReductionPercent;
  const baseQuality = 70; // assume average prompt starts at 70/100
  const performanceEstimate = Math.min(
    100,
    Math.round(baseQuality + wasteRemoved * 0.3)
  );

  return {
    revisedPrompt: revised,
    tokenReduction,
    tokenReductionPercent,
    performanceEstimate,
    changes,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}
