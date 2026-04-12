
/**
 * Formula Engine for Intelligent DRE
 * Parses and evaluates formulas like "@Revenue - @Taxes" or "@OccupancyPct * 100"
 */

export interface FormulaContext {
  getValue: (accountName: string) => number;
}

export const evaluateFormula = (formula: string, context: FormulaContext): number => {
  if (!formula || !formula.trim()) return 0;

  try {
    // 1. Tokenize the formula
    // We look for patterns like @AccountName or @[Account with Spaces]
    let processedFormula = formula;

    // Replace account references with values from context
    // Pattern: @ followed by non-whitespace characters OR @ followed by [ ... ]
    const accountRegex = /@\[([^\]]+)\]|@([a-zA-Z0-9À-ÿ_.\u00C0-\u017F\s\-]+)/g;

    processedFormula = processedFormula.replace(accountRegex, (match, bracketed, plain) => {
      const name = (bracketed || plain || '').trim();
      const value = context.getValue(name);
      return value.toString();
    });

    // 2. Security: Ensure the processed formula only contains numbers, operators, and parentheses
    // This prevents arbitrary JS execution
    if (/[^0-9+\-*/().\s]/.test(processedFormula)) {
      console.warn(`Formula contains invalid characters: ${formula} -> ${processedFormula}`);
      return 0;
    }

    // 3. Evaluate the numeric expression
    // Note: Using Function constructor is safer than eval() if we've sanitized the string
    // but still requires caution. Since we sanitized for numeric/ops only, it's relatively safe.
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${processedFormula}`)();
    
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch (err) {
    console.error(`Error evaluating formula: ${formula}`, err);
    return 0;
  }
};
