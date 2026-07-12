import type { ContextSchema, FieldSchema } from '@agentix-e/spel-ts';

/**
 * SchemaFormatter — formats ContextSchema into readable text.
 *
 * Two formats:
 * 1. formatForLLM(): optimized for LLM prompts (compact, key info first)
 * 2. formatForHuman(): human-readable format (complete, indent-friendly)
 */
export class SchemaFormatter {
  /**
   * LLM-optimized format — compact, injected into the User part of the prompt
   */
  public formatForLLM(schema: ContextSchema): string {
    const lines: string[] = ['## Context Schema'];

    // Root Object
    if (schema.root) {
      lines.push('');
      lines.push(`Root Object (accessible as #${schema.root.name}):`);
      lines.push(`  Type: ${schema.root.type}`);
      lines.push(`  Fields:`);
      for (const [name, field] of Object.entries(schema.root.fields)) {
        lines.push(this.formatFieldForLLM(name, field, '    '));
      }
    }

    // Variables
    if (Object.keys(schema.variables).length > 0) {
      lines.push('');
      lines.push(`Variables:`);
      for (const [name, varDef] of Object.entries(schema.variables)) {
        lines.push(
          `  #${name}: ${varDef.type}` + (varDef.description ? ` (${varDef.description})` : ''),
        );
      }
    }

    // Beans
    if (Object.keys(schema.beans).length > 0) {
      lines.push('');
      lines.push(`Beans:`);
      for (const [name, beanDef] of Object.entries(schema.beans)) {
        lines.push(
          `  @${name}: ${beanDef.type}` + (beanDef.description ? ` (${beanDef.description})` : ''),
        );
      }
    }

    // Types
    if (Object.keys(schema.types).length > 0) {
      lines.push('');
      lines.push(`Types (accessible via T(typeName)):`);
      for (const [name, typeDef] of Object.entries(schema.types)) {
        lines.push(`  ${name}` + (typeDef.description ? `: ${typeDef.description}` : ''));
      }
    }

    // Functions
    if (Object.keys(schema.functions).length > 0) {
      lines.push('');
      lines.push(`Functions:`);
      for (const [name, funcDef] of Object.entries(schema.functions)) {
        const params = funcDef.params.map(p => `${p.name}: ${p.type}`).join(', ');
        lines.push(`  #${name}(${params}): ${funcDef.returnType}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Human-readable format
   */
  public formatForHuman(schema: ContextSchema): string {
    const lines: string[] = [
      '═══════════════════════════════════════',
      '  Context Schema (Human-Readable)',
      '═══════════════════════════════════════',
    ];

    if (schema.root) {
      lines.push('');
      lines.push(`┌─ Root: #${schema.root.name}`);
      lines.push(`│  Type: ${schema.root.type}`);
      lines.push(`│  Fields:`);
      const entries = Object.entries(schema.root.fields);
      for (let i = 0; i < entries.length; i++) {
        const [name, field] = entries[i]!;
        const prefix = i < entries.length - 1 ? '├─' : '└─';
        lines.push(
          `│   ${prefix} ${name} (${field.type})` +
            (field.description ? ` — ${field.description}` : '') +
            (field.nullable ? ' | nullable' : '') +
            (field.isCollection ? ` | collection<${field.elementType ?? 'unknown'}>` : ''),
        );
      }
      lines.push(`│  └─ (${entries.length} fields total)`);
    }

    return lines.join('\n');
  }

  private formatFieldForLLM(name: string, field: FieldSchema, indent: string): string {
    const parts = [`${indent}- ${name}: ${field.type}`];

    if (field.description) {
      parts.push(`(${field.description})`);
    }

    if (field.isCollection) {
      parts.push(`[array of ${field.elementType ?? 'unknown'}]`);
    }

    if (field.nullable) {
      parts.push(`[nullable]`);
    }

    if (field.example !== undefined) {
      parts.push(`(e.g. ${JSON.stringify(field.example)})`);
    }

    return parts.join(' ');
  }
}
