type Node = { kind: 'number'; value: number } | { kind: 'symbol'; name: string } | { kind: 'unary'; op: string; child: Node } | { kind: 'binary'; op: string; left: Node; right: Node } | { kind: 'call'; name: string; args: Node[] };
export interface MathReply { text: string; value?: number; supported: boolean; capabilityMissing?: boolean; }
class CapabilityError extends Error {}
const MAX_NUMBERS = 256;
const functions = new Set(['sqrt', 'cbrt', 'abs', 'exp', 'ln', 'log', 'log10', 'log2', 'sin', 'cos', 'tan', 'sind', 'cosd', 'tand', 'asin', 'acos', 'atan', 'round', 'floor', 'ceil', 'min', 'max', 'sum', 'avg', 'mean', 'median', 'gcd', 'lcm', 'factorial', 'ncr', 'npr', 'pow', 'deg', 'rad']);
const finite = (value: number) => { if (!Number.isFinite(value)) throw new Error('The result is undefined or outside the finite range of this offline calculator.'); return value; };
const numberFormat = new Intl.NumberFormat('en', { maximumSignificantDigits: 12 });
export function formatNumber(value: number): string {
  if (Object.is(value, -0)) value = 0;
  return numberFormat.format(value);
}
function sum(values: number[]) {
  let result = 0, correction = 0;
  for (const value of values) { const adjusted = value - correction; const next = result + adjusted; correction = (next - result) - adjusted; result = next; }
  return finite(result);
}
function factorial(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error('Factorials require a whole number from 0 to 170.');
  let result = 1; for (let index = 2; index <= value; index++) result *= index;
  return finite(result);
}
function gcd(a: number, b: number) {
  if (![a, b].every(Number.isSafeInteger)) throw new Error('GCD and LCM need safe whole numbers.');
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const next = a % b; a = b; b = next; }
  return a;
}
function call(name: string, args: number[]): number {
  const [a, b] = args;
  const variable = ['min', 'max', 'sum', 'avg', 'mean', 'median'].includes(name);
  const expected = ['gcd', 'lcm', 'ncr', 'npr', 'pow'].includes(name) ? 2 : 1;
  if (!args.length || args.length > MAX_NUMBERS || (!variable && args.length !== expected && !(name === 'log' && args.length === 2))) throw new Error(`Check the arguments for ${name}().`);
  const degrees = a * Math.PI / 180;
  let result: number;
  switch (name) {
    case 'sqrt': result = Math.sqrt(a); break;
    case 'cbrt': result = Math.cbrt(a); break;
    case 'abs': result = Math.abs(a); break;
    case 'exp': result = Math.exp(a); break;
    case 'ln': result = Math.log(a); break;
    case 'log': if (args.length === 2 && (b <= 0 || b === 1)) throw new Error('A logarithm base must be positive and not equal to 1.'); result = args.length === 2 ? Math.log(a) / Math.log(b) : Math.log10(a); break;
    case 'log10': result = Math.log10(a); break;
    case 'log2': result = Math.log2(a); break;
    case 'sin': result = Math.sin(a); break;
    case 'cos': result = Math.cos(a); break;
    case 'sind': result = Math.sin(degrees); break;
    case 'cosd': result = Math.cos(degrees); break;
    case 'tan': case 'tand': { const angle = name === 'tan' ? a : degrees; if (Math.abs(Math.cos(angle)) < 1e-12) throw new Error('Tangent is undefined at that angle.'); result = Math.tan(angle); break; }
    case 'asin': result = Math.asin(a); break;
    case 'acos': result = Math.acos(a); break;
    case 'atan': result = Math.atan(a); break;
    case 'round': result = Math.round(a); break;
    case 'floor': result = Math.floor(a); break;
    case 'ceil': result = Math.ceil(a); break;
    case 'min': result = Math.min(...args); break;
    case 'max': result = Math.max(...args); break;
    case 'sum': result = sum(args); break;
    case 'avg': case 'mean': result = sum(args) / args.length; break;
    case 'median': { const sorted = [...args].sort((x, y) => x - y); const mid = Math.floor(sorted.length / 2); result = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; break; }
    case 'gcd': result = gcd(a, b); break;
    case 'lcm': { const divisor = gcd(a, b); result = divisor === 0 ? 0 : Math.abs(a / divisor * b); break; }
    case 'factorial': result = factorial(a); break;
    case 'pow': if (a === 0 && b === 0) throw new Error('0^0 needs a mathematical convention; Paimon will not assume one here.'); result = a ** b; break;
    case 'deg': result = a * 180 / Math.PI; break;
    case 'rad': result = degrees; break;
    case 'ncr': case 'npr': {
      if (![a, b].every(Number.isSafeInteger) || a < 0 || b < 0 || b > a || a > 10000 || b > 256) throw new Error('Use whole numbers with 0 ≤ r ≤ n ≤ 10,000 and r ≤ 256.');
      result = 1;
      const count = name === 'ncr' ? Math.min(b, a - b) : b;
      for (let index = 1; index <= count; index++) result *= name === 'ncr' ? (a - count + index) / index : a - index + 1;
      break;
    }
    default: throw new CapabilityError(`The offline calculator does not support ${name}().`);
  }
  return finite(result);
}
function normalizeExpression(value: string) {
  return value.toLowerCase().replace(/×|\bmultiplied by\b|\btimes\b/g, '*').replace(/÷|\bdivided by\b/g, '/').replace(/−/g, '-').replace(/π/g, 'pi')
    .replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\bto the power of\b/g, '^').replace(/\*\*/g, '^')
    .replace(/√\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)').replace(/√/g, 'sqrt')
    .replace(/%\s*of\b/g, '/100*').replace(/\bpercent\s+of\b/g, '/100*').replace(/\bmod(?:ulo)?\b/g, '%').trim();
}
class Parser {
  private tokens: string[] = [];
  private index = 0;
  constructor(expression: string) {
    if (expression.length > 600) throw new Error('Please keep an offline calculation under 600 characters.');
    const pattern = /\s*(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|[a-z][a-z0-9]*|[()+\-*/^%,!])/gy;
    let offset = 0;
    while (offset < expression.length) {
      if (!expression.slice(offset).trim()) break;
      pattern.lastIndex = offset;
      const match = pattern.exec(expression);
      if (!match) throw new Error('Use numeric expressions, supported functions, or an equation in x or y.');
      this.tokens.push(match[1]); offset = pattern.lastIndex;
      if (this.tokens.length > 256) throw new Error('This calculation is too large for the lightweight offline tools.');
    }
  }
  private peek() { return this.tokens[this.index]; }
  private take() { return this.tokens[this.index++]; }
  parse(): Node {
    const node = this.expression(0, 0);
    if (this.peek()) throw new Error('Check the operators and parentheses in that expression.');
    return node;
  }
  private expression(binding: number, depth: number): Node {
    if (depth > 32) throw new Error('That expression is nested too deeply for the offline tools.');
    let left: Node;
    const token = this.take();
    if (!token) throw new Error('The expression is incomplete.');
    if (token === '+' || token === '-') left = { kind: 'unary', op: token, child: this.expression(30, depth + 1) };
    else if (token === '(') { left = this.expression(0, depth + 1); if (this.take() !== ')') throw new Error('A closing parenthesis is missing.'); }
    else if (/^(?:\d|\.)/.test(token)) left = { kind: 'number', value: finite(Number(token)) };
    else if (/^[a-z][a-z0-9]*$/.test(token)) {
      if (functions.has(token) && this.peek() === '(') {
        this.take(); const args: Node[] = [];
        if (this.peek() !== ')') do { args.push(this.expression(0, depth + 1)); if (this.peek() !== ',') break; this.take(); } while (args.length <= MAX_NUMBERS);
        if (this.take() !== ')') throw new Error('Check the function parentheses and arguments.');
        left = { kind: 'call', name: token, args };
      } else left = { kind: 'symbol', name: token };
    } else throw new Error('Check the beginning of the expression.');
    while (this.peek()) {
      const next = this.peek();
      if ((next === '!' || (next === '%' && !/^(?:\d|\.|[a-z]|\()/.test(this.tokens[this.index + 1] ?? ''))) && 50 >= binding) {
        this.take(); left = { kind: 'unary', op: next, child: left }; continue;
      }
      const implicit = next === '(' || /^[a-z][a-z0-9]*$/.test(next);
      const op = implicit ? '*' : next;
      const precedence = op === '+' || op === '-' ? 10 : ['*', '/', '%'].includes(op) ? 20 : op === '^' ? 40 : -1;
      if (precedence < binding) break;
      if (!implicit) this.take();
      left = { kind: 'binary', op, left, right: this.expression(op === '^' ? precedence : precedence + 1, depth + 1) };
    }
    return left;
  }
}
function evaluate(node: Node, variables: Record<string, number> = {}, budget = { left: 60000 }): number {
  if (--budget.left < 0) throw new Error('That calculation exceeds the offline work limit.');
  switch (node.kind) {
    case 'number': return node.value;
    case 'symbol': { const value = ({ pi: Math.PI, e: Math.E, tau: 2 * Math.PI, ...variables })[node.name]; if (value === undefined) throw new CapabilityError(`Unknown variable or function: ${node.name}.`); return finite(value); }
    case 'call': return call(node.name, node.args.map((arg) => evaluate(arg, variables, budget)));
    case 'unary': { const value = evaluate(node.child, variables, budget); return node.op === '-' ? -value : node.op === '!' ? factorial(value) : node.op === '%' ? value / 100 : value; }
    case 'binary': {
      const a = evaluate(node.left, variables, budget), b = evaluate(node.right, variables, budget);
      if ((node.op === '/' || node.op === '%') && b === 0) throw new Error('Division or remainder by zero is undefined.');
      if (node.op === '^') return call('pow', [a, b]);
      return finite(node.op === '+' ? a + b : node.op === '-' ? a - b : node.op === '*' ? a * b : node.op === '/' ? a / b : a % b);
    }
  }
}
function hasVariable(node: Node, name: string): boolean {
  return node.kind === 'symbol' ? node.name === name : node.kind === 'unary' ? hasVariable(node.child, name) : node.kind === 'binary' ? hasVariable(node.left, name) || hasVariable(node.right, name) : node.kind === 'call' && node.args.some((arg) => hasVariable(arg, name));
}
function evaluationSteps(node: Node, variables: Record<string, number>): string[] {
  const steps: string[] = [];
  const walk = (part: Node) => {
    if (steps.length >= 6 || part.kind === 'number' || part.kind === 'symbol') return;
    if (part.kind === 'binary') {
      walk(part.left); walk(part.right);
      if (steps.length < 6) steps.push(`${formatNumber(evaluate(part.left, variables))} ${part.op} ${formatNumber(evaluate(part.right, variables))} = ${formatNumber(evaluate(part, variables))}`);
    } else if (part.kind === 'unary') { walk(part.child); if (steps.length < 6 && part.op !== '+') steps.push(`${part.op === '-' ? '-' : ''}${formatNumber(evaluate(part.child, variables))}${part.op === '-' ? '' : part.op} = ${formatNumber(evaluate(part, variables))}`); }
    else { part.args.forEach(walk); if (steps.length < 6) steps.push(`${part.name}(${part.args.map((arg) => formatNumber(evaluate(arg, variables))).join(', ')}) = ${formatNumber(evaluate(part, variables))}`); }
  };
  walk(node); return steps;
}
type Polynomial = number[];
function trim(poly: Polynomial) { while (poly.length > 1 && poly.at(-1) === 0) poly.pop(); return poly; }
function polynomial(node: Node, variable = 'x'): Polynomial {
  if (node.kind === 'number') return [node.value];
  if (node.kind === 'symbol') return node.name === variable ? [0, 1] : [evaluate(node)];
  if (node.kind === 'unary') { const p = polynomial(node.child, variable); if (node.op === '+') return p; if (node.op === '-') return p.map((v) => -v); if (node.op === '%') return p.map((v) => v / 100); if (p.length === 1) return [factorial(p[0])]; }
  if (node.kind === 'call') return [evaluate(node)];
  if (node.kind !== 'binary') throw new CapabilityError('This symbolic tool supports polynomials only.');
  const a = polynomial(node.left, variable), b = polynomial(node.right, variable);
  if (node.op === '+' || node.op === '-') return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => finite((a[i] ?? 0) + (node.op === '+' ? 1 : -1) * (b[i] ?? 0))));
  if (node.op === '/' && b.length === 1 && b[0] !== 0) return a.map((value) => finite(value / b[0]));
  const multiply = (first: Polynomial, second: Polynomial) => {
    if (first.length + second.length - 2 > 8) throw new CapabilityError('The offline symbolic tools support polynomial degree up to 8.');
    const result = Array(first.length + second.length - 1).fill(0) as number[];
    first.forEach((value, i) => second.forEach((other, j) => { result[i + j] = finite(result[i + j] + value * other); }));
    return trim(result);
  };
  if (node.op === '*') return multiply(a, b);
  if (node.op === '^' && b.length === 1 && Number.isInteger(b[0]) && b[0] >= 0 && b[0] <= 8) {
    if (a.length === 1 && a[0] === 0 && b[0] === 0) throw new Error('0^0 needs a mathematical convention.');
    let result = [1]; for (let i = 0; i < b[0]; i++) result = multiply(result, a); return result;
  }
  throw new CapabilityError('This symbolic tool supports polynomial arithmetic, not variable denominators or arbitrary functions.');
}
function showPolynomial(poly: Polynomial) {
  const pieces = poly.map((coefficient, degree) => {
    if (!coefficient) return '';
    const variable = degree ? `x${degree > 1 ? `^${degree}` : ''}` : '';
    const absolute = Math.abs(coefficient);
    return `${coefficient < 0 ? '-' : '+'}${absolute === 1 && degree ? '' : formatNumber(absolute)}${variable}`;
  }).filter(Boolean).reverse();
  return pieces.join(' ').replace(/^\+/, '') || '0';
}
function solveEquation(expression: string): MathReply {
  const sides = expression.split('=');
  if (sides.length !== 2) throw new Error('Use one equals sign, for example 2x + 3 = 7.');
  const left = new Parser(normalizeExpression(sides[0])).parse(), right = new Parser(normalizeExpression(sides[1])).parse();
  const p = polynomial({ kind: 'binary', op: '-', left, right });
  if (p.length > 3) throw new CapabilityError('Offline equation solving supports linear and quadratic equations in x.');
  if (p.length === 1) return { text: p[0] === 0 ? hasVariable(left, 'x') || hasVariable(right, 'x') ? 'Both sides are equal. With no remaining constraint on x, every real x satisfies this equation.' : 'Yes—both sides of that numeric equality are equal.' : 'No solution: the two sides reduce to unequal constants.', supported: true };
  if (p.length === 2) { const value = finite(-p[0] / p[1]); return { text: `x = ${formatNumber(value)}\nAfter combining terms: ${formatNumber(p[1])}x + (${formatNumber(p[0])}) = 0.\nIsolate x: x = ${formatNumber(-p[0])} / ${formatNumber(p[1])}.`, value, supported: true }; }
  const [c, b, a] = p;
  const discriminant = finite(b * b - 4 * a * c);
  if (discriminant < 0) return { text: `x = ${formatNumber(-b / (2 * a))} ± ${formatNumber(Math.sqrt(-discriminant) / (2 * Math.abs(a)))}i\nThese are complex roots from the quadratic formula.`, supported: true };
  if (discriminant === 0) { const value = finite(-b / (2 * a)); return { text: `x = ${formatNumber(value)} (a repeated root).`, value, supported: true }; }
  const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
  const roots = [finite(q / a), finite(c / q)].sort((x, y) => x - y);
  return { text: `x = ${formatNumber(roots[0])} or ${formatNumber(roots[1])}\nPaimon used the quadratic formula.`, supported: true };
}
function solveSystem(expression: string): MathReply {
  const equations = expression.split(/;|\s+and\s+/);
  if (equations.length !== 2) throw new Error('Give two linear equations separated by a semicolon, such as x+y=5; x-y=1.');
  type Coefficients = [number, number, number];
  const coefficients = (node: Node): Coefficients => {
    if (node.kind === 'number') return [node.value, 0, 0];
    if (node.kind === 'symbol') return node.name === 'x' ? [0, 1, 0] : node.name === 'y' ? [0, 0, 1] : [evaluate(node), 0, 0];
    if (node.kind === 'unary' && ['+', '-', '%'].includes(node.op)) return coefficients(node.child).map((value) => finite(value * (node.op === '-' ? -1 : node.op === '%' ? .01 : 1))) as Coefficients;
    if (node.kind === 'call') return [evaluate(node), 0, 0];
    if (node.kind !== 'binary') throw new CapabilityError('The two-variable solver supports linear equations only.');
    const a = coefficients(node.left), b = coefficients(node.right);
    if (node.op === '+' || node.op === '-') return a.map((value, index) => finite(value + (node.op === '+' ? 1 : -1) * b[index])) as Coefficients;
    const aConstant = a[1] === 0 && a[2] === 0, bConstant = b[1] === 0 && b[2] === 0;
    if (node.op === '*' && (aConstant || bConstant)) return (aConstant ? b.map((value) => finite(value * a[0])) : a.map((value) => finite(value * b[0]))) as Coefficients;
    if (node.op === '/' && bConstant && b[0] !== 0) return a.map((value) => finite(value / b[0])) as Coefficients;
    if (aConstant && bConstant) return [evaluate(node), 0, 0];
    if (node.op === '^' && bConstant && b[0] === 1) return a;
    throw new CapabilityError('The two-variable solver supports linear equations only.');
  };
  const rows = equations.map((equation) => {
    const parts = equation.split('=');
    if (parts.length !== 2) throw new Error('Each equation needs one equals sign.');
    return coefficients({ kind: 'binary', op: '-', left: new Parser(normalizeExpression(parts[0])).parse(), right: new Parser(normalizeExpression(parts[1])).parse() });
  });
  const [[c, a, b], [f, d, e]] = rows;
  const determinant = finite(a * e - b * d);
  if (determinant === 0) return { text: 'This system has no unique solution: it may be inconsistent or have infinitely many solutions. Paimon won’t pick arbitrary values for x and y.', supported: true };
  if (Math.abs(determinant) < 1e-12 * Math.max(Math.abs(a * e), Math.abs(b * d))) throw new Error('These equations are nearly dependent; a higher-precision solver is needed for a reliable result.');
  return { text: `x = ${formatNumber(finite((-c * e + b * f) / determinant))}\ny = ${formatNumber(finite((-a * f + c * d) / determinant))}\nPaimon solved the two linear equations together.`, supported: true };
}
function numberList(value: string): number[] {
  const items = value.replace(/[\[\]]/g, '').trim().split(/[,\s]+/).filter(Boolean);
  if (!items.length || items.length > MAX_NUMBERS || items.some((item) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(item))) throw new Error('Give Paimon 1–256 finite numbers, separated by commas or spaces.');
  return items.map((item) => finite(Number(item)));
}
function analyze(values: number[]): MathReply {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sum(values), average = total / values.length, mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const squares = sum(values.map((value) => finite((value - average) ** 2)));
  const counts = new Map<number, number>(); values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const frequency = Math.max(...counts.values());
  const modes = frequency > 1 ? [...counts].filter(([, count]) => count === frequency).map(([value]) => formatNumber(value)).slice(0, 8).join(', ') : 'none (all values occur once)';
  return { text: `Paimon's number notebook:\nCount: ${values.length}\nSum: ${formatNumber(total)}\nMean: ${formatNumber(average)}\nMedian: ${formatNumber(median)}\nMinimum / maximum: ${formatNumber(sorted[0])} / ${formatNumber(sorted.at(-1)!)}\nRange: ${formatNumber(sorted.at(-1)! - sorted[0])}\nMode: ${modes}\nPopulation variance: ${formatNumber(squares / values.length)}\nPopulation standard deviation: ${formatNumber(Math.sqrt(squares / values.length))}\nSample standard deviation: ${values.length > 1 ? formatNumber(Math.sqrt(squares / (values.length - 1))) : 'requires at least two values'}\nThese describe the numbers you supplied, not a prediction.`, value: average, supported: true };
}
function regression(input: string): MathReply {
  const lists = input.split(';');
  if (lists.length !== 2) throw new Error('Use paired lists: regression: 1,2,3; 2,4,6. The first list is x, the second is y.');
  const x = numberList(lists[0]), y = numberList(lists[1]);
  if (x.length !== y.length || x.length < 2) throw new Error('Paired lists must have the same length and at least two values.');
  const mx = sum(x) / x.length, my = sum(y) / y.length;
  const xx = sum(x.map((value) => finite((value - mx) ** 2)));
  const yy = sum(y.map((value) => finite((value - my) ** 2)));
  const xy = sum(x.map((value, index) => finite((value - mx) * (y[index] - my))));
  if (xx === 0) throw new Error('Regression needs variation in x; all supplied x values are equal.');
  const slope = finite(xy / xx), intercept = finite(my - slope * mx);
  const correlation = yy > 0 ? Math.max(-1, Math.min(1, finite(xy / Math.sqrt(xx) / Math.sqrt(yy)))) : undefined;
  return { text: `Paimon’s paired-data summary (${x.length} pairs):\ny = ${formatNumber(slope)}x ${intercept < 0 ? '-' : '+'} ${formatNumber(Math.abs(intercept))}\nPearson correlation: ${correlation === undefined ? 'undefined because y is constant' : formatNumber(correlation)}\nR²: ${correlation === undefined ? 'undefined for constant y' : formatNumber(correlation ** 2)}\nThis is a least-squares descriptive fit. Correlation does not establish causation or guarantee predictions.`, supported: true };
}
const units: Record<string, [string, number]> = {
  mm: ['length', .001], cm: ['length', .01], m: ['length', 1], meter: ['length', 1], meters: ['length', 1], km: ['length', 1000], inches: ['length', .0254], inch: ['length', .0254], in: ['length', .0254], feet: ['length', .3048], foot: ['length', .3048], ft: ['length', .3048], miles: ['length', 1609.344], mile: ['length', 1609.344], mi: ['length', 1609.344],
  mg: ['mass', .000001], g: ['mass', .001], grams: ['mass', .001], kg: ['mass', 1], pounds: ['mass', .45359237], lb: ['mass', .45359237], lbs: ['mass', .45359237], oz: ['mass', .028349523125],
  ms: ['time', .001], seconds: ['time', 1], second: ['time', 1], s: ['time', 1], minutes: ['time', 60], minute: ['time', 60], min: ['time', 60], hours: ['time', 3600], hour: ['time', 3600], h: ['time', 3600], days: ['time', 86400], day: ['time', 86400],
};
/** No eval/Function, no executable user text, and strict token/depth/work limits. */
export function solveMath(question: string, previous?: number): MathReply | null {
  if (question.length > 600) return { text: 'Please keep an offline calculation under 600 characters.', supported: false };
  const original = question.trim();
  let query = original.toLowerCase().replace(/[?]+$/, '').replace(/^(?:please\s+)?(?:calculate|compute|evaluate|solve|what(?:'s| is)|how much is)\s*:?\s*/i, '').trim();
  const followup = /^(?:and\s+)?(?:multiply (?:that|it|the result) by|times|divide (?:that|it|the result) by|plus|minus|add|subtract)\s+(.+)$/i.exec(query);
  if (followup) {
    if (previous === undefined) return { text: 'Which number should Paimon use first? Give a calculation, then say “times 2” or “plus 5.”', supported: true };
    const op = /divide/i.test(followup[0]) ? '/' : /minus|subtract/i.test(followup[0]) ? '-' : /plus|add/i.test(followup[0]) ? '+' : '*';
    query = `ans ${op} (${followup[1]})`;
  }
  const statistics = /^(?:analy[sz]e|summari[sz]e|statistics|stats|mean|average|median|mode|variance|range|sum|standard deviation)(?:\s+(?:these numbers|this data|of))?(?:\s*:\s*|\s+)(.+)$/i.exec(query);
  const paired = /^(?:regression|correlation|linear fit)\s*:?\s*(.+)$/i.exec(query);
  const calculus = /^(differentiate|derivative(?:\s+of)?|integrate|integral(?:\s+of)?)\s+(.+)$/i.exec(query);
  const conversion = /^(?:convert\s+)?([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z]+)\s+(?:to|in)\s+([a-z]+)$/i.exec(query);
  const looksLikeMath = Boolean(statistics || paired || calculus || conversion || followup || /^(?:[-+\d.(π√]|(?:pi|e|tau|ans)\b|[a-z][a-z0-9]*\s*\()/i.test(query) || (/=/.test(query) && /^[\dxy\s.+\-*/^()=;]+$/i.test(query)));
  if (!looksLikeMath) return null;
  try {
    if (statistics) return analyze(numberList(statistics[1]));
    if (paired) return regression(paired[1]);
    if (conversion) {
      const temperature: Record<string, string> = { c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' };
      const source = temperature[conversion[2]], target = temperature[conversion[3]];
      if (source && target) {
        const input = Number(conversion[1]);
        const celsius = source === 'c' ? input : source === 'f' ? (input - 32) * 5 / 9 : input - 273.15;
        if (celsius < -273.15) throw new Error('That temperature is below absolute zero.');
        const value = finite(target === 'c' ? celsius : target === 'f' ? celsius * 9 / 5 + 32 : celsius + 273.15);
        return { text: `${conversion[1]} ${conversion[2]} = ${formatNumber(value)} ${conversion[3]}.`, value, supported: true };
      }
      const from = units[conversion[2]], to = units[conversion[3]];
      if (!from || !to || from[0] !== to[0]) throw new Error('Use compatible length, mass, or time units; currency rates are not available offline.');
      const value = finite(Number(conversion[1]) * from[1] / to[1]);
      return { text: `${conversion[1]} ${conversion[2]} = ${formatNumber(value)} ${conversion[3]}.`, value, supported: true };
    }
    if (calculus) {
      const bounds = /^(.*?)\s+from\s+(.+?)\s+to\s+(.+)$/i.exec(calculus[2]);
      const p = polynomial(new Parser(normalizeExpression(bounds ? bounds[1] : calculus[2])).parse());
      const derivative = /^differentiate|^derivative/.test(calculus[1]);
      if (bounds && !derivative) {
        const start = evaluate(new Parser(normalizeExpression(bounds[2])).parse());
        const end = evaluate(new Parser(normalizeExpression(bounds[3])).parse());
        const value = sum(p.map((coefficient, degree) => finite(coefficient / (degree + 1) * (end ** (degree + 1) - start ** (degree + 1)))));
        return { text: `Definite integral = ${formatNumber(value)}\nPaimon evaluated the polynomial antiderivative at ${formatNumber(end)} and subtracted its value at ${formatNumber(start)}.`, value, supported: true };
      }
      const result = derivative ? p.slice(1).map((value, index) => finite(value * (index + 1))) : [0, ...p.map((value, index) => finite(value / (index + 1)))];
      return { text: `${derivative ? 'Derivative' : 'Indefinite integral'}: ${showPolynomial(result)}${derivative ? '' : ' + C'}\nPaimon used the polynomial power rule.`, supported: true };
    }
    if (query.includes('=')) return query.includes(';') || /\s+and\s+/.test(query) ? solveSystem(query) : solveEquation(query);
    const expression = normalizeExpression(query);
    const node = new Parser(expression).parse();
    const variables: Record<string, number> = previous === undefined ? {} : { ans: previous };
    const value = finite(evaluate(node, variables));
    const steps = evaluationSteps(node, variables);
    const approximate = !Number.isSafeInteger(value) && Number.isInteger(value);
    return { text: `Paimon worked it out: ${expression} = ${approximate ? 'approximately ' : ''}${formatNumber(value)}.${steps.length > 1 ? `\nSteps:\n${steps.join('\n')}` : ''}${/\b(?:sin|cos|tan)\(/.test(expression) ? '\nAngles are in radians; use sind/cosd/tand for degrees.' : ''}\nDecimal results are rounded to 12 significant digits.`, value, supported: true };
  } catch (error) {
    return { text: `Paimon cannot safely solve that with the offline tools: ${error instanceof Error ? error.message : 'Please check the expression.'}\nTry “(12 + 8) * 3”, “solve 2x + 3 = 7”, or “analyze: 4, 8, 12”. Advanced proofs and arbitrary symbolic math need a more capable math system.`, supported: false, capabilityMissing: error instanceof CapabilityError };
  }
}
