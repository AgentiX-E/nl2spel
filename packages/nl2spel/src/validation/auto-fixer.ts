/**
 * AutoFixer — automatically fixes common SpEL syntax errors from LLM output.
 */
export class AutoFixer {
  public fix(expression: string): AutoFixResult {
    let fixed = expression;
    const changes: string[] = [];

    // Order matters: check specific patterns before generic replacements

    // 1. undefined/null checks (BEFORE === → ==)
    if (fixed.includes('=== undefined')) {
      fixed = fixed.replace(/=== undefined/g, '== null');
      changes.push('Replaced === undefined with == null');
    }
    if (fixed.includes('!== undefined')) {
      fixed = fixed.replace(/!== undefined/g, '!= null');
      changes.push('Replaced !== undefined with != null');
    }

    // 2. !== → != (BEFORE === → == to avoid double-processing)
    if (fixed.includes('!==')) {
      // `includes` check guarantees match is non-null
      const count = fixed.match(/!==/g)!.length;
      fixed = fixed.replace(/!==/g, '!=');
      changes.push(`Replaced ${count}x !== with !=`);
    }

    // 3. === → ==
    if (fixed.includes('===')) {
      const count = fixed.match(/===/g)!.length;
      fixed = fixed.replace(/===/g, '==');
      changes.push(`Replaced ${count}x === with ==`);
    }

    // 4. && → and
    if (fixed.includes('&&')) {
      const count = fixed.match(/&&/g)!.length;
      fixed = fixed.replace(/&&/g, 'and');
      changes.push(`Replaced ${count}x && with and`);
    }

    // 5. || → or
    if (fixed.includes('||')) {
      const count = fixed.match(/\|\|/g)!.length;
      fixed = fixed.replace(/\|\|/g, 'or');
      changes.push(`Replaced ${count}x || with or`);
    }

    // 6. Unmatched single quotes
    const singleQuoteCount = (fixed.match(/'/g) ?? []).length;
    if (singleQuoteCount % 2 !== 0) {
      // If last char is not already a quote, append one
      if (!fixed.endsWith("'")) {
        fixed = fixed + "'";
        changes.push('Added missing closing single quote');
      }
    }

    // 7. Unmatched double quotes
    const doubleQuoteCount = (fixed.match(/"/g) ?? []).length;
    if (doubleQuoteCount % 2 !== 0) {
      if (!fixed.endsWith('"')) {
        fixed = fixed + '"';
        changes.push('Added missing closing double quote');
      }
    }

    // 8. Unbalanced parentheses (all bracket types)
    const parenFix = this.fixAllBrackets(fixed);
    if (parenFix !== fixed) {
      changes.push('Fixed unbalanced brackets');
      fixed = parenFix;
    }

    // 9. > == → >=
    if (fixed.includes('> ==')) {
      fixed = fixed.replace(/> ==/g, '>=');
      changes.push('Replaced > == with >=');
    }
    if (fixed.includes('< ==')) {
      fixed = fixed.replace(/< ==/g, '<=');
      changes.push('Replaced < == with <=');
    }

    // 10. ? : → ?:
    if (fixed.includes('? :')) {
      fixed = fixed.replace(/\?\s*:\s*/g, ' ?: ');
      changes.push('Fixed Elvis operator spacing');
    }

    const wasFixed = changes.length > 0;
    return {
      wasFixed,
      expression: wasFixed ? fixed : expression,
      changes,
    };
  }

  private fixAllBrackets(expr: string): string {
    let result = expr;
    // Fix parentheses: ( )
    const openParen = (result.match(/\(/g) ?? []).length;
    const closeParen = (result.match(/\)/g) ?? []).length;
    if (openParen > closeParen) {
      result += ')'.repeat(openParen - closeParen);
    }

    // Fix square brackets: [ ]
    const openBracket = (result.match(/\[/g) ?? []).length;
    const closeBracket = (result.match(/\]/g) ?? []).length;
    if (openBracket > closeBracket) {
      result += ']'.repeat(openBracket - closeBracket);
    }

    // Fix curly braces: { }
    const openBrace = (result.match(/\{/g) ?? []).length;
    const closeBrace = (result.match(/\}/g) ?? []).length;
    if (openBrace > closeBrace) {
      result += '}'.repeat(openBrace - closeBrace);
    }

    return result;
  }
}

export interface AutoFixResult {
  expression: string;
  wasFixed: boolean;
  changes: string[];
}
