# Architecture

How a natural-language rule becomes a SpEL expression, what each stage
guarantees, and where the extension points are.

## Pipeline

```
natural language
      │
      ▼
┌──────────────────┐
│ Clause splitting │  a sentence that joins conditions is split on its
│                  │  top-level logical connectors, honouring quotes and
│                  │  bracket depth
└────────┬─────────┘
         │  one clause per condition
         ▼
┌──────────────────┐
│ Layer 0          │  63 bilingual patterns, each a regex plus a template.
│ Pattern matching │  Sub-millisecond. No network, no model.
└────────┬─────────┘
         │  no match
         ▼
┌──────────────────┐
│ Layer 1          │  15 intents, each mapping to one or more templates.
│ Semantic templates│  Also offline.
└────────┬─────────┘
         │  no match
         ▼
┌──────────────────┐
│ Layer 2          │  LLM providers: DeepSeek, OpenAI-compatible endpoints,
│ LLM generation   │  or a browser-local model via Layer 3 (WebLLM + GBNF).
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Validation       │  parse → type → semantic → context, then a final
│                  │  "the expression must parse" gate.
└────────┬─────────┘
         │
         ▼
   SpEL expression
```

`NL2SpelEngine` is the entry point. `NL2SpelEngine#generate` with
`{ offlineOnly: true }` stops after Layer 1 and never touches the network.

## The property that matters most: never answer with a partial rule

The comparison patterns are not anchored at the end of their input, because a
sentence may carry trailing matter a pattern should ignore. That makes them match
a *prefix*, and matching a whole sentence with one of them answers only the first
condition of a compound rule:

```
金额大于1000且订单已确认   ->  #amount > 1000      # the 且 half is gone
```

The result parses, so validation has nothing to complain about, and the caller
receives a materially weaker rule than the one they asked for. A wrong answer that
looks right is worse than an error, so the pipeline is built to make this
impossible:

- A compound sentence is **decomposed**, and each clause is converted
  independently. The operands are joined with `and`/`or` and every operand is
  parenthesised, so the meaning does not depend on the reader knowing that SpEL
  binds `and` tighter than `or`.
- A pattern tagged `logic` is the exception: it expresses a conjunction or
  disjunction as a single SpEL expression (`a and b` → `(a) and (b)`), so it does
  represent the whole sentence and is preferred over decomposition.
- If any clause cannot be converted, the whole-sentence match is **not** used as a
  fallback — that match is the truncation being prevented. The request fails with
  `UnconvertibleClauseError`, which names the clauses it could not convert.
- A trailing connector (`金额大于1000且`) leaves an empty clause, which is
  likewise refused rather than dropped.

The decomposer is conservative about what counts as a connector. `和` is not one —
it is a range separator in `价格在10和20之间` — and an English `and` directly
between two numerals belongs to `between 100 and 500`, not to a conjunction.
Connectors inside string literals (`'A and B'`) or brackets (`(a and b) or c`) are
not split points.

## Entry points and what each guarantees

| Entry point | Behaviour on a compound sentence |
|---|---|
| `NL2SpelEngine#generate` | Decomposes; refuses rather than truncating. |
| `StrategyRouter#generate` | Same. |
| `StrategyRouter#decomposeClauses` | Decomposes, or returns `null` when there is no top-level connector. |
| `PatternMatcher#match` | **Single-pattern primitive.** Converts one clause; it does not decompose. Prefer the engine or router for natural-language input. |
| `splitClauses` / `decompose` | The decomposer itself, exported for callers assembling their own pipeline. |

## Field resolution

A natural-language field word has to become the identifier the caller's context
actually uses, and the library cannot know that name. The resolver keeps a
dictionary of common words (`金额` → `amount`, `备注` → `remark`, …) and:

- an **ASCII** word is already an identifier and is emitted unchanged;
- a **dictionary** word is emitted as its English identifier;
- an **unknown** word is emitted verbatim — which is legal Spring, since
  `Character.isLetter` accepts any Unicode letter — and reported in
  `PatternMatchResult.unmappedFields`.

`PatternMatcherOptions.fieldPolicy` chooses what happens instead of emitting an
unknown word verbatim:

| Policy | Unknown word | Use when |
|---|---|---|
| `passthrough` (default) | emitted verbatim and reported | your schema names fields in Chinese, or you will check them yourself |
| `strict` | raises `UnmappedFieldError` | you would rather fail than emit a name nothing resolves |

Only a field word the matcher *captured* is held to the policy. When a pattern has
no `field` capture group the matcher infers the field from the whole sentence,
which is a guess at a word nobody named, and rejecting those would refuse ordinary
phrasings.

## Validation

`ValidationPipeline#validate(expression, contextSchema?)` runs four stages and
then a gate. A stage rejects by producing an **error**; warnings never change
`valid`.

| Stage | Rejects |
|---|---|
| parse | empty input; unbalanced brackets; a JavaScript operator SpEL does not have (`===`, `!==`, `&&`, `\|\|`); anything the configured evaluator cannot parse |
| type | *(advisory only today)* |
| semantic | *(advisory only today)* |
| context | a reference absent from a supplied `contextSchema`; a field absent from `contextSchema.root`; an undeclared bean |
| parse gate | an expression that is manifestly incomplete, such as one ending in an operator |

The context stage needs a schema: without one, a typo such as `#unknownRef` and a
legitimate runtime variable such as `#currentUser` are indistinguishable, and
rejecting unknown names would reject valid SpEL. Supply a `contextSchema` —
`NL2SpelEngine#extractContextSchema` builds one from a real object — to get hard
failures on unresolved references.

A dotted-free reference is accepted when it names a declared variable, function,
root object, **or a field of the root**. The last case exists because the built-in
patterns emit `#amount` rather than `#root.amount`.

Bracket balance is computed on the expression with string-literal contents masked,
so a delimiter inside a literal is not counted: `#re matches '\d+('` is valid and
is not reported. Literal boundaries come from a quote-state scan, which is exact
for SpEL — a quote character is always a literal delimiter — and does not require
the engine to be able to lex the expression at all. That matters because the parse
gate asks the lexer for the final token to spot a trailing operator, and an engine
build that cannot lex a field name in Chinese would otherwise turn a capability
gap into a "truncated" verdict. When the lexer fails, the only conclusion drawn is
that an unterminated string literal makes the expression incomplete; whether the
expression is *valid* for that engine is the parse stage's business, where the
caller supplies the evaluator.

## Extension points

| Goal | How |
|---|---|
| Add a rule pattern | `engine.registerPattern(pattern)` — see `PatternDefinition`; a pattern's `examples` are checked against it by the contract suite |
| Add an LLM provider | `engine.registerProvider(provider)` — implement `LLMProvider` |
| Enable parse-level validation | `engine.setSpelEvaluator(evaluator)` — `SpelEvaluatorAdapter` wraps `@agentix-e/spel-ts` |
| Supply schema context | `options.contextSchema`, or `options.context` with a plain object |
| Choose the field policy | `new PatternMatcher(patterns, { fieldPolicy })` |
| Cap LLM use | `options.offlineOnly`, or `config.patternMinConfidence` / `templateMinConfidence` |

## Testing

Two suites guard the generation layer, and they answer different questions:

- `builtin-patterns.contract.test.ts` asserts every pattern reproduces its own
  declared `examples` **in isolation**. This is the specification.
- `nl-to-spel-corpus.test.ts` asserts the expression a caller actually receives
  for a corpus of rules, **end to end**, where pattern priorities and clause
  decomposition decide the outcome.

Both are needed. A pattern can satisfy its isolated contract and still never be
reached, because a higher-priority pattern claims the input first.
