import { expect, test } from '@playwright/test';
import { solveMath } from '../src/paimon/math';
import { containsCredential, memoryKey, normalizeNotebook, putFact, searchFacts } from '../src/paimon/memory';

test('offline calculations respect precedence, scientific functions, percentages and follow-ups', () => {
  const cases: Array<[string, number]> = [
    ['2 + 3 * 4', 14], ['(2+3)*4', 20], ['-2^2', -4], ['(-2)^2', 4], ['2^-2', .25], ['2^3^2', 512],
    ['2(3+4)', 14], ['2pi', 2 * Math.PI], ['sqrt(81)', 9], ['√81', 9], ['cbrt(-27)', -3], ['abs(-7)', 7],
    ['sind(30)', .5], ['cos(pi)', -1], ['tand(45)', 1], ['log(100)', 2], ['log(8,2)', 3], ['ln(e)', 1], ['log10(1000)', 3], ['log2(8)', 3],
    ['5!', 120], ['factorial(0)', 1], ['ncr(10,3)', 120], ['npr(5,2)', 20], ['gcd(18,24)', 6], ['lcm(6,8)', 24],
    ['avg(1,2,3)', 2], ['sum(1,2,3)', 6], ['median(4,1,3,2)', 2.5], ['min(9,2,5)', 2], ['max(9,2,5)', 9],
    ['20% of 150', 30], ['50% * 200', 100], ['17 mod 5', 2], ['0.1+0.2', .3], ['convert 2 km to m', 2000],
    ['convert 32 fahrenheit to celsius', 0], ['convert 0 celsius to kelvin', 273.15], ['120 minutes to hours', 2],
  ];
  for (const [question, expected] of cases) {
    const reply = solveMath(question);
    expect(reply, question).toMatchObject({ supported: true });
    expect(reply?.value, question).toBeCloseTo(expected, 9);
  }
  expect(solveMath('multiply that by 3', 7)?.value).toBe(21);
  expect(solveMath('and plus 5', 7)?.value).toBe(12);
  expect(solveMath('times 2')?.text).toContain('Which number');
  expect(solveMath('(12+8)*3')?.text).toContain('12 + 8 = 20');
  expect(solveMath('Hello Paimon')).toBeNull();
});

test('offline algebra, polynomial calculus and paired-data analysis give checked results', () => {
  expect(solveMath('solve 2x + 3 = 7')).toMatchObject({ supported: true, value: 2 });
  expect(solveMath('solve x^2 - 5x + 6 = 0')?.text).toContain('x = 2 or 3');
  expect(solveMath('solve x^2 + 1 = 0')?.text).toContain('0 ± 1i');
  expect(solveMath('solve x^2 - 4x + 4 = 0')).toMatchObject({ supported: true, value: 2 });
  expect(solveMath('solve x-x=0')?.text).toContain('every real x');
  expect(solveMath('2+2=4')?.text).toContain('numeric equality');
  expect(solveMath('solve x+y=5; x-y=1')?.text).toContain('x = 3\ny = 2');
  expect(solveMath('solve x+y=1; 2x+2y=3')?.text).toContain('no unique solution');
  expect(solveMath('differentiate x^3 + 2x')?.text).toContain('3x^2 +2');
  expect(solveMath('integrate 3x^2 + 2')?.text).toContain('x^3 +2x + C');
  expect(solveMath('integrate x^2 from 0 to 3')).toMatchObject({ supported: true, value: 9 });
  expect(solveMath('analyze: 1, 2, 3, 4')?.text).toContain('Mean: 2.5\nMedian: 2.5');
  expect(solveMath('analyze: 1, 2, 3, 4')?.text).toContain('Population variance: 1.25');
  expect(solveMath('regression: 1,2,3; 2,4,6')?.text).toContain('y = 2x + 0');
  expect(solveMath('correlation: 1,2,3; 6,4,2')?.text).toContain('Pearson correlation: -1');
  expect(solveMath('regression: 1,2,3; 4,4,4')?.text).toContain('undefined because y is constant');
});

test('math tools reject invalid domains, excessive work and executable syntax without guessing', () => {
  for (const input of ['1/0', '0^0', 'sqrt(-1)', 'tan(pi/2)', 'factorial(171)', 'lcm(0,1.5)', 'log(8,1)', '(', '2..3', '1e309', 'analyze: 1,NaN,2', 'regression: 1,1; 2,3', 'integrate sin(x)', 'solve x^3=8', 'solve x*y=2; x+y=3', 'window.alert(1)', '1; globalThis.pwned=1', '('.repeat(40)+'1'+')'.repeat(40)]) {
    const reply = solveMath(input);
    // Non-mathematical executable prose may be classified as an ordinary question.
    expect(reply === null || reply.supported === false, input).toBe(true);
  }
  expect(solveMath('1+'.repeat(400)+'1')).toMatchObject({ supported: false });
  expect(solveMath('integrate sin(x)')).toMatchObject({ capabilityMissing: true });
  expect(solveMath('1/0')).toMatchObject({ supported: false, capabilityMissing: false });
});

test('memory validation caps retention, deduplicates keys and searches labels with provenance', () => {
  const notebook = normalizeNotebook({ facts: Array.from({ length: 100 }, (_, index) => ({ key: `note ${index}`, label: `note ${index}`, value: `value ${index}`, updatedAt: index })), turns: Array.from({ length: 100 }, (_, index) => ({ id: String(index), question: 'q', answer: 'a', at: index })) });
  expect(notebook.facts).toHaveLength(80);
  expect(notebook.turns).toHaveLength(30);
  const one = putFact(notebook, 'favorite character', 'Ayaka');
  const updated = putFact(one, 'favorite character', 'Furina');
  expect(updated.facts.filter((fact) => fact.key === 'favorite character')).toHaveLength(1);
  expect(searchFacts(updated, 'what is my favorite character?')[0].value).toBe('Furina');
  expect(searchFacts(updated, 'search for Furina')[0].key).toBe('favorite character');
  expect(searchFacts(updated, 'a completely unrelated moon question')).toEqual([]);
  expect(memoryKey('Favorite—Character!')).toBe('favorite character');
});

test('credential detection excludes sensitive notes and conversations', () => {
  for (const value of ['my password is test-secret', 'API key: test-secret', 'Bearer test-token', 'xai-'+'z'.repeat(30), '-----BEGIN RSA PRIVATE KEY-----']) expect(containsCredential(value)).toBe(true);
  expect(containsCredential('my favorite character is Skirk')).toBe(false);
  const notebook = normalizeNotebook({ facts: [{ key: 'password', label: 'password', value: 'password is test-secret', updatedAt: 1 }], turns: [{ id: '1', question: 'API key: test-secret', answer: 'No.', at: 1 }] });
  expect(notebook.facts).toEqual([]);
  expect(notebook.turns).toEqual([]);
});
