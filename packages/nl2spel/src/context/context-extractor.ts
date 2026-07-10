import type {
  ContextSchema,
  RootObjectSchema,
  FieldSchema,
  VariableSchema,
  BeanSchema,
  TypeSchema,
  FunctionSchema,
} from '../SpelEvaluator.js';

/**
 * ContextExtractor —— 从纯数据结构构建 ContextSchema。
 *
 * 与任何具体 SpEL 实现解耦，只接受：
 *   - rootObject: 任意对象（用于提取属性类型）
 *   - variables: Record<string, { type: string; value?: unknown }>
 *   - beans: string[]
 *   - types: string[]
 */
export class ContextExtractor {
  /**
   * 从纯数据结构提取 ContextSchema（不依赖 spel-ts）
   */
  public extract(context: {
    rootObject?: unknown;
    rootName?: string;
    variables?: Record<
      string,
      { type: string; value?: unknown; description?: string; nullable?: boolean }
    >;
    beans?: Array<{ name: string; type: string; description?: string; singleton?: boolean }>;
    types?: Array<{ name: string; className?: string; description?: string }>;
    functions?: Array<{
      name: string;
      returnType: string;
      params: Array<{ name: string; type: string }>;
      description?: string;
    }>;
  }): ContextSchema {
    const schema: ContextSchema = {
      root: this.extractRoot(context),
      variables: this.extractVariables(context),
      beans: this.extractBeans(context),
      types: this.extractTypes(context),
      functions: this.extractFunctions(context),
    };

    return schema;
  }

  /**
   * 提取根对象 Schema
   */
  private extractRoot(context: {
    rootObject?: unknown;
    rootName?: string;
  }): RootObjectSchema | null {
    const { rootObject, rootName } = context;
    if (rootObject === null || rootObject === undefined) return null;

    const name = rootName ?? 'root';
    const type =
      typeof rootObject === 'object'
        ? ((rootObject as any)?.constructor?.name ?? 'Object')
        : typeof rootObject;

    const fields = this.extractFields(rootObject as Record<string, unknown>);

    return { name, type, fields, methods: {} };
  }

  /**
   * 提取对象字段
   */
  private extractFields(obj: Record<string, unknown>): Record<string, FieldSchema> {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return {};
    }

    const fields: Record<string, FieldSchema> = {};

    for (const key of Object.keys(obj)) {
      try {
        const value = (obj as any)[key];
        const fieldType = this.inferSpelType(value);

        fields[key] = {
          type: fieldType,
          description: this.generateDescription(key, fieldType),
          isCollection: Array.isArray(value),
          elementType: Array.isArray(value) && value.length > 0 ? typeof value[0] : undefined,
          nullable: value === null,
          example: this.safeExample(value),
        };
      } catch {
        // 跳过无法访问的属性
      }
    }

    return fields;
  }

  /**
   * 推断 SpEL 类型
   */
  private inferSpelType(value: unknown): FieldSchema['type'] {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  /**
   * 生成字段描述
   */
  private generateDescription(key: string, type: string): string {
    return `Field '${key}' of type ${type}`;
  }

  /**
   * 安全获取示例值
   */
  private safeExample(value: unknown): unknown {
    if (value === null) return null;
    if (typeof value === 'object') return undefined;
    return value;
  }

  /**
   * 提取变量
   */
  private extractVariables(context: {
    variables?: Record<
      string,
      { type: string; value?: unknown; description?: string; nullable?: boolean }
    >;
  }): Record<string, VariableSchema> {
    const variables: Record<string, VariableSchema> = {};
    if (!context.variables) return variables;

    for (const [name, vdef] of Object.entries(context.variables)) {
      variables[name] = {
        type: vdef.type,
        description: vdef.description ?? `Variable '#${name}'`,
        nullable: vdef.nullable ?? false,
        value: vdef.value,
      };
    }
    return variables;
  }

  /**
   * 提取 Bean
   */
  private extractBeans(context: {
    beans?: Array<{ name: string; type: string; description?: string; singleton?: boolean }>;
  }): Record<string, BeanSchema> {
    const beans: Record<string, BeanSchema> = {};
    if (!context.beans) return beans;

    for (const bdef of context.beans) {
      beans[bdef.name] = {
        type: bdef.type,
        description: bdef.description,
        singleton: bdef.singleton,
      };
    }
    return beans;
  }

  /**
   * 提取类型
   */
  private extractTypes(context: {
    types?: Array<{ name: string; className?: string; description?: string }>;
  }): Record<string, TypeSchema> {
    const types: Record<string, TypeSchema> = {};
    if (!context.types) return types;

    for (const tdef of context.types) {
      types[tdef.name] = {
        className: tdef.className,
        description: tdef.description,
      };
    }
    return types;
  }

  /**
   * 提取函数
   */
  private extractFunctions(context: {
    functions?: Array<{
      name: string;
      returnType: string;
      params: Array<{ name: string; type: string }>;
      description?: string;
    }>;
  }): Record<string, FunctionSchema> {
    const functions: Record<string, FunctionSchema> = {};
    if (!context.functions) return functions;

    for (const fdef of context.functions) {
      functions[fdef.name] = {
        returnType: fdef.returnType,
        params: fdef.params,
        description: fdef.description,
      };
    }
    return functions;
  }
}
