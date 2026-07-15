import type {
  ContextSchema,
  RootObjectSchema,
  FieldSchema,
  VariableSchema,
  BeanSchema,
  TypeSchema,
  FunctionSchema,
} from '@agentix-e/spel-ts';

/**
 * ContextExtractor — builds a ContextSchema from plain data structures.
 *
 * Decoupled from any concrete SpEL implementation, accepts only:
 *   - rootObject: any object (for extracting property types)
 *   - variables: Record<string, { type: string; value?: unknown }>
 *   - beans: string[]
 *   - types: string[]
 */
export class ContextExtractor {
  /**
   * Extract ContextSchema from plain data structures (no spel-ts dependency)
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
   * Extract root object schema
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
   * Extract object fields
   */
  private extractFields(obj: Record<string, unknown>, depth = 0): Record<string, FieldSchema> {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return {};
    }

    // Prevent infinite recursion
    if (depth > 3) return {};

    const fields: Record<string, FieldSchema> = {};

    for (const key of Object.keys(obj)) {
      try {
        const value = (obj as Record<string, unknown>)[key];
        const fieldType = this.inferSpelType(value);
        const isArray = Array.isArray(value);
        const isObject =
          !isArray && typeof value === 'object' && value !== null && !(value instanceof Date);

        const field: FieldSchema = {
          type: fieldType,
          description: this.generateDescription(key, fieldType),
          isCollection: isArray,
          elementType:
            isArray && (value as unknown[]).length > 0 ? typeof (value as unknown[])[0] : undefined,
          nullable: value === null,
          example: this.safeExample(value),
        };

        // Recursively extract nested object fields
        if (isObject) {
          field.fields = this.extractFields(value as Record<string, unknown>, depth + 1);
        }

        fields[key] = field;
      } catch {
        // Skip inaccessible properties
      }
    }

    return fields;
  }

  /**
   * Infer SpEL type
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
   * Generate field description
   */
  private generateDescription(key: string, type: string): string {
    return `Field '${key}' of type ${type}`;
  }

  /**
   * Safely get example value
   */
  private safeExample(value: unknown): unknown {
    if (value === null) return null;
    if (typeof value === 'object') return undefined;
    return value;
  }

  /**
   * Extract variables
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
   * Extract beans
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
   * Extract types
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
   * Extract functions
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
