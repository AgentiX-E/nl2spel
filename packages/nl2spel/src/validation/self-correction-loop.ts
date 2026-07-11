import type { LLMProvider, LLMPrompt, LLMResponse } from '../provider/llm-provider.js';
import { ValidationPipeline, type ValidationResult } from './validation-pipeline.js';
import { AutoFixer } from './auto-fixer.js';
import type { ContextSchema } from '../SpelEvaluator.js';

export interface SelfCorrectionResult {
  /** Final expression */
  expression: string;

  /** Whether validation passed */
  valid: boolean;

  /** Original LLM output */
  originalOutput: string;

  /** Number of correction attempts */
  correctionAttempts: number;

  /** Log of each correction round */
  corrections: CorrectionLog[];

  /** Total latency (ms) */
  totalLatencyMs: number;
}

export interface CorrectionLog {
  attempt: number;
  expression: string;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  autoFixed: boolean;
  autoFixChanges: string[];
}

export interface SelfCorrectionConfig {
  /** Maximum correction attempts (default 3) */
  maxAttempts?: number;
  /** Minimum confidence threshold (default 0.7) */
  minConfidence?: number;
  /** Whether AutoFix is enabled (default true) */
  enableAutoFix?: boolean;
}

export class SelfCorrectionLoop {
  private readonly pipeline: ValidationPipeline;
  private readonly autoFixer: AutoFixer;
  private readonly config: SelfCorrectionConfig;

  constructor(
    config: SelfCorrectionConfig = {},
    pipeline?: ValidationPipeline,
    autoFixer?: AutoFixer,
  ) {
    this.config = {
      maxAttempts: config.maxAttempts ?? 3,
      minConfidence: config.minConfidence ?? 0.7,
      enableAutoFix: config.enableAutoFix ?? true,
    };
    this.pipeline = pipeline ?? new ValidationPipeline();
    this.autoFixer = autoFixer ?? new AutoFixer();
  }

  /**
   * Execute the self-correction loop
   */
  public async correct(
    expression: string,
    contextSchema: ContextSchema,
    generateFn: (prompt: LLMPrompt) => Promise<LLMResponse>,
    originalPrompt: LLMPrompt,
  ): Promise<SelfCorrectionResult> {
    const startTime = Date.now();
    const corrections: CorrectionLog[] = [];
    let currentExpression = expression;
    let valid = false;

    // Attempt 0: directly validate original output
    const initialResult = await this.pipeline.validate(currentExpression, contextSchema);

    if (initialResult.valid) {
      return {
        expression: currentExpression,
        valid: true,
        originalOutput: expression,
        correctionAttempts: 0,
        corrections,
        totalLatencyMs: Date.now() - startTime,
      };
    }

    // Attempt 0.5: try AutoFix
    if (this.config.enableAutoFix && initialResult.errors.length > 0) {
      const autoFixResult = this.autoFixer.fix(currentExpression);
      if (autoFixResult.wasFixed) {
        currentExpression = autoFixResult.expression;

        corrections.push({
          attempt: 0,
          expression: currentExpression,
          valid: false,
          errorCount: initialResult.errors.length,
          warningCount: initialResult.warnings.length,
          autoFixed: true,
          autoFixChanges: autoFixResult.changes,
        });

        // Validate AutoFix result
        const afterFix = await this.pipeline.validate(currentExpression, contextSchema);

        if (afterFix.valid) {
          return {
            expression: currentExpression,
            valid: true,
            originalOutput: expression,
            correctionAttempts: 1,
            corrections,
            totalLatencyMs: Date.now() - startTime,
          };
        }

        // AutoFix not sufficient, continue to LLM correction
        corrections.push({
          attempt: 0,
          expression: currentExpression,
          valid: afterFix.valid,
          errorCount: afterFix.errors.length,
          warningCount: afterFix.warnings.length,
          autoFixed: false,
          autoFixChanges: [],
        });
      }
    }

    // Attempts 1..N: LLM regeneration
    for (let attempt = 1; attempt <= this.config.maxAttempts!; attempt++) {
      const lastValidation = await this.pipeline.validate(currentExpression, contextSchema);

      // Build correction prompt
      const errorDescriptions = lastValidation.errors
        .map(e => `- [${e.code}] ${e.message}`)
        .join('\n');

      const correctionPrompt: LLMPrompt = {
        ...originalPrompt,
        user: [
          originalPrompt.user,
          '',
          '---',
          'The previous generated expression was INVALID. Please fix it:',
          `Expression: ${currentExpression}`,
          `Errors:\n${errorDescriptions}`,
          '---',
          'Generate ONLY the corrected SpEL expression, nothing else.',
        ].join('\n'),
      };

      try {
        const response = await generateFn(correctionPrompt);
        currentExpression = response.text.trim();

        // Apply AutoFix again
        if (this.config.enableAutoFix) {
          const afResult = this.autoFixer.fix(currentExpression);
          if (afResult.wasFixed) {
            currentExpression = afResult.expression;
          }
        }

        const currentValidation = await this.pipeline.validate(currentExpression, contextSchema);

        corrections.push({
          attempt,
          expression: currentExpression,
          valid: currentValidation.valid,
          errorCount: currentValidation.errors.length,
          warningCount: currentValidation.warnings.length,
          autoFixed: false,
          autoFixChanges: [],
        });

        if (currentValidation.valid) {
          valid = true;
          break;
        }
      } catch (err) {
        corrections.push({
          attempt,
          expression: currentExpression,
          valid: false,
          errorCount: 1,
          warningCount: 0,
          autoFixed: false,
          autoFixChanges: [],
        });
      }
    }

    return {
      expression: currentExpression,
      valid,
      originalOutput: expression,
      correctionAttempts: corrections.filter(c => c.attempt > 0).length,
      corrections,
      totalLatencyMs: Date.now() - startTime,
    };
  }
}
