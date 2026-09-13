# User Guide

What you can write, what you get back, and how to make the library strict about
the parts it cannot know.

## Quick start

```ts
import { NL2SpelEngine } from '@agentix-e/nl2spel';

const engine = new NL2SpelEngine();

// Offline: pattern and template layers only. No network, no API key.
const { expression } = await engine.generate('金额大于1000', { offlineOnly: true });
// '#amount > 1000'
```

Add an LLM provider only when you want the harder sentences handled:

```ts
engine.registerProvider(new OpenAICompatibleProvider({ /* … */ }));
const { expression } = await engine.generate('一个需要理解的复杂规则');
```

## Verified phrasings

Every row below is asserted by the test suite, so the table cannot drift from the
implementation. `{field}` is your schema's property name; the dictionary in
[Field names](#field-names) decides what a Chinese word becomes.

### Comparison

| You write | You get |
|---|---|
| `订单金额大于1000` | `#订单金额 > 1000` |
| `金额不小于100` | `#amount >= 100` |
| `订单金额小于500` | `#订单金额 < 500` |
| `金额不超过500` | `#amount <= 500` |
| `amount > 500` | `#amount > 500` |
| `amount less than 100` | `#amount < 100` |
| `price lower than 50` | `#price < 50` |

### Equality

| You write | You get |
|---|---|
| `数量等于5` | `#count == 5` |
| `订单状态是已发货` | `#订单状态 == '已发货'` |
| `订单状态不是已取消` | `#订单状态 != '已取消'` |

### Null and emptiness

| You write | You get |
|---|---|
| `备注为空` | `#remark == null` |
| `备注不为空` | `#remark != null` |
| `remark is null` | `#remark == null` |
| `remark is not null` | `#remark != null` |

### Range

| You write | You get |
|---|---|
| `年龄在18到60之间` | `#age between {18, 60}` |
| `amount between 100 and 500` | `#amount between {100, 500}` |

### Strings and collections

| You write | You get |
|---|---|
| `订单备注包含加急` | `#订单备注.contains('加急')` |
| `订单号以ORD开头` | `#订单号.startsWith('ORD')` |
| `文件名以.pdf结尾` | `#name.endsWith('.pdf')` |
| `手机号匹配正则` | `#手机号 matches '正则'` |
| `标签列表中包含VIP` | `#标签列表.contains('VIP')` |
| `订单列表为空` | `#订单列表.isEmpty()` |
| `订单列表有数据` | `!#订单列表.isEmpty()` |
| `订单列表数量大于10` | `#订单列表.size() > 10` |

### Logic, permissions and types

| You write | You get |
|---|---|
| `amount > 100 and status == done` | `(amount > 100) and (status == done)` |
| `VIP or amount > 1000` | `(VIP) or (amount > 1000)` |
| `用户是管理员` | `hasRole('管理员')` |
| `是否已支付` | `#已支付` |
| `创建日期在2024-01-01之后` | `#创建日期 > T(java.time.LocalDate).parse('2024-01-01')` |
| `账号是否是Admin类型` | `#账号 instanceof T(Admin)` |
| `用户名或者匿名用户` | `#name ?: '匿名用户'` |

## Compound rules

A sentence that joins conditions is converted condition by condition, and the
result is refused if any condition cannot be converted — a rule is never answered
with only its first clause.

| You write | You get |
|---|---|
| `金额大于1000且金额小于5000` | `(#amount > 1000) and (#amount < 5000)` |
| `金额大于1000且金额小于5000且状态等于已发货` | `(#amount > 1000) and (#amount < 5000) and (#status == '已发货')` |
| `年龄大于18或年龄小于60` | `(#age > 18) or (#age < 60)` |

Accepted connectors are `且`, `并且`, `同时`, `而且`, `或`, `或者`, `要么`, and the
English `and` / `or`. `和` is deliberately not one of them: it separates the bounds
of a range, as in `价格在10和20之间` and `between 100 and 500`.

When a clause has no conversion you get an error naming it:

```ts
await engine.generate('金额大于1000且订单已确认', { offlineOnly: true });
// UnconvertibleClauseError: Cannot decompose '金额大于1000且订单已确认':
//   no conversion for '订单已确认'. Refusing to emit a partial rule.
```

## Field names

Field resolution is the one place the library has to guess, because it cannot know
your schema. It keeps a dictionary of common words:

| Chinese | Emitted | | Chinese | Emitted |
|---|---|---|---|---|
| 备注 | `remark` | | 标题 | `title` |
| 说明 / 描述 | `description` | | 地址 | `address` |
| 金额 | `amount` | | 邮箱 | `email` |
| 数量 / 个数 | `count` | | 手机 / 电话 | `phone` |
| 状态 | `status` | | 日期 | `date` |
| 类型 | `type` | | 时间 | `time` |
| 名称 / 用户名 / 文件名 | `name` | | 年龄 | `age` |
| 权限 | `role` | | 价格 | `price` |
| 标签 | `tags` | | 列表 | `list` |
| 数组 | `items` | | 文件 | `file` |
| 过期 | `expiryDate` | | 创建 | `createdAt` |
| 有效 | `valid` | | 活跃 / 激活 | `active` |

A word that is **not** in the dictionary is emitted verbatim — `姓名不为空` becomes
`#姓名 != null`. That is legal Spring, since `Character.isLetter` accepts any
Unicode letter, and it is the right answer when your schema names fields in
Chinese. It is still a guess, so it is reported:

```ts
const result = new PatternMatcher(BUILTIN_PATTERNS).match('姓名不为空');
result.spel;            // '#姓名 != null'
result.unmappedFields;  // ['姓名']
```

If you would rather fail than guess, ask for `strict`:

```ts
const strict = new PatternMatcher(BUILTIN_PATTERNS, { fieldPolicy: 'strict' });
strict.match('姓名不为空');  // throws UnmappedFieldError: No field mapping for '姓名'…
```

| Policy | Unknown word | Use when |
|---|---|---|
| `passthrough` (default) | emitted verbatim, listed in `unmappedFields` | your schema names fields in Chinese, or you check the names yourself |
| `strict` | raises `UnmappedFieldError` | you would rather fail than emit a name nothing resolves |

## Getting hard failures on unresolved references

Field resolution guesses; the validation pipeline does not. Give it a schema and a
reference that is not in it becomes an error:

```ts
const engine = new NL2SpelEngine();
const contextSchema = engine.extractContextSchema({ rootObject: { amount: 0, status: '' } });

await engine.generate('金额大于1000', { contextSchema });   // resolves against the schema
```

A reference is accepted when it names a declared variable, function, root object,
or a field of the root. Without a schema there is no way to tell a typo from a
legitimate runtime variable such as `#currentUser`, so nothing is rejected — that
is a deliberate choice, not a gap.

## Known limitations

- **Chinese field names need a matching engine build.** Expressions such as
  `#姓名 != null` are legal Spring, but the `@agentix-e/spel-ts` release this
  package currently depends on rejects non-ASCII identifiers, so the expression
  will not evaluate until that dependency is updated.
- **A verb phrase with no pattern is refused.** `订单已确认` has no pattern, so a
  sentence containing it fails rather than silently dropping it. Phrase it as a
  comparison (`订单状态等于已确认`) or a boolean field (`订单已确认` as a schema
  property) until a pattern covers it.
- **Some patterns are shadowed on their own example.** `CN-BOOL-TRUE`,
  `CN-BOOL-FALSE` and `CN-LOGIC-NOT` satisfy their isolated contract, but a
  higher-priority pattern claims the input first for the phrasing each one
  documents, so the documented phrasing does not reach them:

  | Pattern | Its example | What actually matches | Still reachable via |
  |---|---|---|---|
  | `CN-BOOL-TRUE` | `用户是VIP` | `CN-PERM-ROLE` → `hasRole('VIP')` | `用户==VIP` |
  | `CN-BOOL-FALSE` | `用户不是VIP` | `CN-NE-STATUS` → `#用户 != 'VIP'` | `用户非VIP` |
  | `CN-LOGIC-NOT` | `不是有效` | `CN-COLL-CONTAINS` → `#不.contains('有效')` | `不是 a b` |

  Each is reachable through another surface form, so none is dead code — but the
  phrase each one advertises as its example gives a different answer. Fixing it
  means adjusting pattern priorities, which is recorded rather than done.
