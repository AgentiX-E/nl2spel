# Security policy

## Reporting a vulnerability

Report security issues through GitHub's private vulnerability reporting:

**https://github.com/AgentiX-E/nl2spel/security/advisories/new**

That opens a draft advisory visible only to the maintainers, so a report can be discussed and
fixed before it becomes public. Please do not open a public issue for a suspected vulnerability.

Useful in a report: the affected package and version, the natural-language input or configuration
that reproduces it, and the impact you believe it has.

## What to expect

| stage | when |
|---|---|
| acknowledgement | within 3 working days |
| assessment, including whether the report is in scope | within 10 working days |
| fix and release | as soon as a patch is ready, with the advisory published alongside it |

You are credited in the published advisory unless you ask not to be.

## Supported versions

Fixes land on the newest published minor of each package. This repository publishes three:

| package | supported |
|---|---|
| `@agentix-e/nl2spel` 1.x | yes |
| `@agentix-e/nl2spel-openai` 1.x | yes |
| `@agentix-e/nl2spel-webllm` 1.x | yes |

Older minors are not maintained.

## Scope

**In scope.** The concerns that are specific to turning natural language into an expression and
handing it to a model provider:

- a credential — an API key, an authorization header, a base URL containing a secret — appearing
  in a thrown error, a log line, or a diagnostic the caller is expected to display;
- text under a third party's control reaching the prompt in a way that escapes its intended role,
  where the library's own framing is what failed rather than the caller's use of the model;
- a generated expression that reaches beyond what the library documents it can produce, in a way
  that makes the caller's own validation of that expression unsound.

**Out of scope.** The quality, safety or factual accuracy of what a model returns is not a
vulnerability of this library. Neither is the caller's decision to evaluate a generated expression
without validating it: the library ships `ValidationPipeline` for that purpose, and whether to use
it is the caller's call. A model provider being unavailable, rate-limiting a caller or repricing
its API is equally out of scope.

**Tracked, but not reported as a security issue.** An advisory in a `devDependency` that cannot
reach a published artifact. Those are covered by Dependabot and fixed on a schedule.

## What is already automated

- **Dependabot** alerts, with version updates every Monday and grouped minor and patch
  updates. Advisory-driven updates depend on the repository setting, which is not a file in
  this repository and therefore not something the text above can promise.
- **CodeQL** analysis on push, on pull requests and weekly, with the repository's ruleset refusing
  a merge while a medium-or-higher alert is open.
- The `master` branch cannot be force-pushed or deleted, and requires signed commits and one
  approving review.
