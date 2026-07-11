#!/usr/bin/env node
/**
 * Quick performance benchmark for NL2SpEL core.
 * Used by CI workflow to verify SLO targets.
 */
import { PatternMatcher } from './dist/pattern/pattern-matcher.js';
import { BUILTIN_PATTERNS } from './dist/pattern/builtin-patterns.js';
import { IntentClassifier } from './dist/template/intent-classifier.js';

console.log('Pattern Matching Benchmarks:');
console.log('');

const m = new PatternMatcher(BUILTIN_PATTERNS);
const inputs = ['订单金额大于1000', 'amount > 500', '备注为空', '用户是VIP'];

// Warm up
for (const input of inputs) m.match(input);

const start = Date.now();
for (let i = 0; i < 1000; i++) {
  for (const input of inputs) {
    m.match(input);
  }
}
const elapsed = Date.now() - start;
const avgMs = (elapsed / 4000).toFixed(3);
console.log(`4000 pattern matches: ${elapsed}ms`);
console.log(`Average: ${avgMs}ms per match`);
console.log(`SLO target: <= 1ms — ${Number(avgMs) <= 1 ? 'PASS' : 'FAIL'}`);

// Intent classification
const c = new IntentClassifier();
for (const input of inputs) c.classify(input);

const intStart = Date.now();
for (let i = 0; i < 500; i++) {
  for (const input of inputs) {
    c.classify(input);
  }
}
const intElapsed = Date.now() - intStart;
const intAvgMs = (intElapsed / 2000).toFixed(3);

console.log('');
console.log('Intent Classification Benchmarks:');
console.log(`2000 classifications: ${intElapsed}ms`);
console.log(`Average: ${intAvgMs}ms per classification`);
console.log(`SLO target: <= 5ms — ${Number(intAvgMs) <= 5 ? 'PASS' : 'FAIL'}`);
