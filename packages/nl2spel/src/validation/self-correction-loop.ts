import type { LLMProvider, LLMPrompt, LLMResponse } from '../provider/llm-provider.js';
import { ValidationPipeline, type ValidationResult } from './validation-pipeline.js';
import { AutoFixer } from './auto-fixer.js';
import type { ContextSchema } from '../SpelEvaluator.js';

export interface SelfCorrectionResult {
  /** 最终表达式 */
  expression: string;

  /** 是否验证通过 */
  valid: boolean;

  /** 原始 LLM 输出 */
  originalOutput: string;

  /** 修正次数 */
  correctionAttempts: number;

  /** 每轮修正的日志 */
  corrections: CorrectionLog[];

  /** 总耗时 (ms) */
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
  /** 最大修正次数 (默认 3) */
  maxAttempts?: number;
  /** 最小置信度阈值 (默认 0.7) */
  minConfidence?: number;
  /** 是否启用 AutoFix (默认 true) */
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
   * 执行自纠正循环
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

    // Attempt 0: 直接验证原始输出
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

    // Attempt 0.5: 尝试 AutoFix
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

        // 验证 AutoFix 结果
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

        // AutoFix 不够，继续 LLM 纠正
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

    // Attempts 1..N: LLM 重新生成
    for (let attempt = 1; attempt <= this.config.maxAttempts!; attempt++) {
      const lastValidation = await this.pipeline.validate(currentExpression, contextSchema);

      if (lastValidation.valid) {
        valid = true;
        break;
      }

      // 构造纠正 Prompt
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

        // 再次 AutoFix
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
