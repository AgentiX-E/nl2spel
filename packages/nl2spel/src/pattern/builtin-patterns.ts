import type { PatternDefinition } from './pattern-definition.js';

/**
 * Built-in pattern library — covers ≥80% Easy scenarios, ≥35 PatternDefinitions.
 *
 * Core design:
 * 1. All patterns use named capture groups `(?<field>…)` or `(?<value>…)` to extract parameters
 * 2. Separate Chinese/English patterns (don't mix keywords, avoids cross-language false matches)
 * 3. High-specificity patterns have higher priority ("not empty" > "not")
 * 4. Sorted by priority descending
 */
export const BUILTIN_PATTERNS: PatternDefinition[] = [
  // ================================================================
  // P93+: Pure English numeric comparison (covers "amount > 500" etc.)
  // ================================================================

  {
    id: 'EN-CMP-GT',
    match: /^(?<field>\w+)\s*>\s*(?<value>\d+(?:\.\d+)?)/,
    spelTemplate: '#{field} > {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 93,
    tags: ['comparison', 'gt', 'english'],
    examples: [{ nl: 'amount > 500', spel: '#amount > 500' }],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'EN-CMP-LT',
    match: /^(?<field>\w+)\s*(?:less\s+than|lower\s+than|<)\s*(?<value>\d+(?:\.\d+)?)/i,
    spelTemplate: '#{field} < {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 94,
    tags: ['comparison', 'lt', 'english'],
    examples: [
      { nl: 'amount less than 100', spel: '#amount < 100' },
      { nl: 'price lower than 50', spel: '#price < 50' },
    ],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'EN-CMP-GE',
    match: /^(?<field>\w+)\s*>=\s*(?<value>\d+(?:\.\d+)?)/,
    spelTemplate: '#{field} >= {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 93,
    tags: ['comparison', 'ge', 'english'],
    examples: [{ nl: 'amount >= 50', spel: '#amount >= 50' }],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'EN-CMP-LE',
    match: /^(?<field>\w+)\s*<=\s*(?<value>\d+(?:\.\d+)?)/,
    spelTemplate: '#{field} <= {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 93,
    tags: ['comparison', 'le', 'english'],
    examples: [{ nl: 'amount <= 200', spel: '#amount <= 200' }],
    difficulty: 'easy',
    confidence: 0.98,
  },

  // ================================================================
  // Group 1: Null / Empty — pri 97-96 (highest specificity)
  // ================================================================

  {
    id: 'CN-NULL-NOT',
    match: /^(?<field>\S+?)\s*(?:不为空|不是空的|有值|存在|不为null)$/,
    spelTemplate: '#{field} != null',
    slots: {},
    priority: 98,
    tags: ['null', 'isNotNull'],
    examples: [{ nl: '备注不为空', spel: '#备注 != null' }],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'CN-NULL-IS',
    match: /^(?<field>\S+?)\s*(?:为空|是空的|不存在|无值|为null)$/,
    spelTemplate: '#{field} == null',
    slots: {},
    priority: 97,
    tags: ['null', 'isNull'],
    examples: [{ nl: '备注为空', spel: '#备注 == null' }],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'EN-NULL-IS',
    match: /^(?<field>\w+)\s+is\s+(?:null|empty)$/i,
    spelTemplate: '#{field} == null',
    slots: {},
    priority: 96,
    tags: ['null', 'isNull', 'english'],
    examples: [{ nl: 'remark is null', spel: '#remark == null' }],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'EN-NULL-NOT',
    match: /^(?<field>\w+)\s+is\s+not\s+(?:null|empty)$/i,
    spelTemplate: '#{field} != null',
    slots: {},
    priority: 96,
    tags: ['null', 'isNotNull', 'english'],
    examples: [{ nl: 'remark is not null', spel: '#remark != null' }],
    difficulty: 'easy',
    confidence: 0.98,
  },

  // ================================================================
  // Group 2: Chinese numeric comparison — pri 92
  // ================================================================

  {
    id: 'CN-CMP-GE',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:金额|值)?\s*(?:不小于|不低于|大于等于|>=)\s*(?<value>\d+(?:\.\d+)?)/,
    spelTemplate: '#{field} >= {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 93,
    tags: ['comparison', 'ge', 'chinese'],
    examples: [{ nl: '金额不小于100', spel: '#金额 >= 100' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-CMP-LE',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:金额|值)?\s*(?:不大于|不超过|小于等于|<=)\s*(?<value>\d+(?:\.\d+)?)/,
    spelTemplate: '#{field} <= {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 93,
    tags: ['comparison', 'le', 'chinese'],
    examples: [{ nl: '金额不超过500', spel: '#金额 <= 500' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-CMP-GT',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:金额|值|数量|价格)?\s*(?:大于|超过|高于)\s*(?<value>\d+(?:\.\d+)?)/,
    spelTemplate: '#{field} > {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 92,
    tags: ['comparison', 'gt', 'chinese'],
    examples: [{ nl: '订单金额大于1000', spel: '#订单金额 > 1000' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-CMP-LT',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:金额|值|数量|价格)?\s*(?:小于|低于|不到)\s*(?<value>\d+(?:\.\d+)?)/,
    spelTemplate: '#{field} < {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 92,
    tags: ['comparison', 'lt', 'chinese'],
    examples: [{ nl: '订单金额小于500', spel: '#订单金额 < 500' }],
    difficulty: 'easy',
    confidence: 0.95,
  },

  // ================================================================
  // Group 3: String/status equality — pri 91
  // ================================================================

  {
    id: 'CN-EQ-STATUS',
    match: /^(?<field>[^\s，,、]+?)\s*(?:状态|类型)?\s*(?:等于|是|为)\s*(?<value>[^\s，,、]+)$/,
    spelTemplate: "#{field} == '{value}'",
    slots: { value: { key: 'value', type: 'string' } },
    priority: 85,
    tags: ['comparison', 'eq', 'string'],
    examples: [{ nl: '订单状态是已发货', spel: "#订单状态 == '已发货'" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-EQ-STRING',
    match: /\b(?<field>\w+)\s+(?:equals?|==)\s+(?<value>[a-zA-Z_]\w*)/i,
    spelTemplate: "#{field} == '{value}'",
    slots: { value: { key: 'value', type: 'string' } },
    priority: 91,
    tags: ['comparison', 'eq', 'string', 'english'],
    examples: [{ nl: 'status equals completed', spel: "#status == 'completed'" }],
    difficulty: 'easy',
    confidence: 0.95,
  },

  // CN: "order status is not cancelled" — must be before NOT pattern
  {
    id: 'CN-NE-STATUS',
    match: /^(?<field>[^\s，,、]+?)\s*(?:状态|类型)?\s*(?:不等于|!=|不是)\s*(?<value>[^\s，,、]+)$/,
    spelTemplate: "#{field} != '{value}'",
    slots: { value: { key: 'value', type: 'string' } },
    priority: 91,
    tags: ['comparison', 'ne', 'string'],
    examples: [{ nl: '订单状态不是已取消', spel: "#订单状态 != '已取消'" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-NE-STRING',
    match: /\b(?<field>\w+)\s*!=\s*(?<value>[a-zA-Z_]\w*)/i,
    spelTemplate: "#{field} != '{value}'",
    slots: { value: { key: 'value', type: 'string' } },
    priority: 91,
    tags: ['comparison', 'ne', 'string', 'english'],
    examples: [{ nl: 'status != cancelled', spel: "#status != 'cancelled'" }],
    difficulty: 'easy',
    confidence: 0.95,
  },

  // CN/EN: count equality
  {
    id: 'CN-EQ-COUNT',
    match: /^(?<field>[^\s，,、]+?)\s*(?:数量|个数|计数)?\s*(?:等于|==)\s*(?<value>\d+)/,
    spelTemplate: '#{field} == {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 91,
    tags: ['comparison', 'eq', 'number'],
    examples: [{ nl: '数量等于5', spel: '#数量 == 5' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-EQ-NUMBER',
    match: /\b(?<field>\w+)\s+(?:equals?|==)\s+(?<value>\d+)/i,
    spelTemplate: '#{field} == {value}',
    slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
    priority: 91,
    tags: ['comparison', 'eq', 'number', 'english'],
    examples: [{ nl: 'count equals 10', spel: '#count == 10' }],
    difficulty: 'easy',
    confidence: 0.95,
  },

  // ================================================================
  // Group 4: Permission checks — pri 88
  // ================================================================

  {
    id: 'CN-PERM-ROLE',
    match: /^(?<field>[^\s，,、]+?)\s*(?:是|拥有|有)\s*(?<role>[^\s，,、]+?)(?:角色|权限)?$/,
    spelTemplate: "hasRole('{role}')",
    slots: { role: { key: 'role', type: 'string' } },
    priority: 86,
    tags: ['permission', 'hasRole'],
    examples: [{ nl: '用户是管理员', spel: "hasRole('管理员')" }],
    difficulty: 'easy',
    confidence: 0.9,
  },
  {
    id: 'EN-PERM-ROLE',
    match: /\buser\s+(?:has|is)\s+(?<role>[a-zA-Z_]+)\s*(?:role)?$/i,
    spelTemplate: "hasRole('{role}')",
    slots: { role: { key: 'role', type: 'string' } },
    priority: 88,
    tags: ['permission', 'hasRole', 'english'],
    examples: [{ nl: 'user has admin role', spel: "hasRole('admin')" }],
    difficulty: 'easy',
    confidence: 0.9,
  },
  {
    id: 'CN-PERM-PERM',
    match: /^(?<field>[^\s，,、]+)\s*(?:可以|能够|允许|may|can)\s+(?<permission>.+)$/i,
    spelTemplate: "hasPermission('{permission}')",
    slots: { permission: { key: 'permission', type: 'string' } },
    priority: 88,
    tags: ['permission', 'hasPermission'],
    examples: [{ nl: '用户可以删除订单', spel: "hasPermission('删除订单')" }],
    difficulty: 'easy',
    confidence: 0.9,
  },
  {
    id: 'EN-PERM-PERM',
    match: /\buser\s+(?:can|may|is\s+allowed\s+to)\s+(?<permission>\w+)/i,
    spelTemplate: "hasPermission('{permission}')",
    slots: { permission: { key: 'permission', type: 'string' } },
    priority: 88,
    tags: ['permission', 'hasPermission', 'english'],
    examples: [{ nl: 'user can delete', spel: "hasPermission('delete')" }],
    difficulty: 'easy',
    confidence: 0.9,
  },

  // ================================================================
  // Group 5: Collection operations — pri 85-89
  // ================================================================

  {
    id: 'CN-COLL-EMPTY',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:列表|数组|集合)?\s*(?:为空|是空的|没有|无)\s*(?:元素|数据|项)?$/,
    spelTemplate: '#{field}.isEmpty()',
    slots: {},
    priority: 89,
    tags: ['collection', 'isEmpty'],
    examples: [{ nl: '订单列表为空', spel: '#订单列表.isEmpty()' }],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'EN-COLL-EMPTY',
    match: /^(?<field>\w+)\s+is\s+empty$/i,
    spelTemplate: '#{field}.isEmpty()',
    slots: {},
    priority: 88,
    tags: ['collection', 'isEmpty', 'english'],
    examples: [{ nl: 'items is empty', spel: '#items.isEmpty()' }],
    difficulty: 'easy',
    confidence: 0.98,
  },
  {
    id: 'CN-COLL-NOTEMPTY',
    match: /^(?<field>[^\s，,、]+?)\s*(?:列表|数组|集合)?\s*(?:不为空|有)\s*(?:元素|数据|项)?$/,
    spelTemplate: '!#{field}.isEmpty()',
    slots: {},
    priority: 89,
    tags: ['collection', 'isNotEmpty'],
    examples: [{ nl: '订单列表有数据', spel: '!#订单列表.isEmpty()' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-COLL-NOTEMPTY',
    match: /^(?<field>\w+)\s+(?:has\s+items|is\s+not\s+empty)$/i,
    spelTemplate: '!#{field}.isEmpty()',
    slots: {},
    priority: 86,
    tags: ['collection', 'isNotEmpty', 'english'],
    examples: [{ nl: 'items is not empty', spel: '!#items.isEmpty()' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-COLL-CONTAINS',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:列表|数组|集合)?\s*(?:中\s*)?(?:包含|含有|有)\s*(?<element>[^\s，,、]+)/,
    spelTemplate: "#{field}.contains('{element}')",
    slots: { element: { key: 'element', type: 'string' } },
    priority: 87,
    tags: ['collection', 'contains'],
    examples: [{ nl: '标签列表中包含VIP', spel: "#标签列表.contains('VIP')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-COLL-CONTAINS',
    match: /\b(?<field>\w+)\s+(?:contains?|includes?)\s+(?<element>\S+)/i,
    spelTemplate: "#{field}.contains('{element}')",
    slots: { element: { key: 'element', type: 'string' } },
    priority: 86,
    tags: ['collection', 'contains', 'english'],
    examples: [{ nl: 'tags contains premium', spel: "#tags.contains('premium')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-COLL-SIZE',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:列表|数组|集合)?\s*(?:数量|个数|大小|长度)\s*(?<op>大于|>|超过|小于|<|等于|==)\s*(?<value>\d+)/,
    spelTemplate: '#{field}.size() {op} {value}',
    slots: {
      value: { key: 'value', type: 'number', transform: 'toNumber' },
      op: { key: 'op', type: 'literal' },
    },
    priority: 85,
    tags: ['collection', 'size'],
    examples: [{ nl: '订单列表数量大于10', spel: '#订单列表.size() > 10' }],
    difficulty: 'medium',
    confidence: 0.85,
  },
  {
    id: 'EN-COLL-SIZE',
    match: /\b(?<field>\w+)\s+(?:size|length|count)\s*(?<op>>|<|>=|<=|==)\s*(?<value>\d+)/i,
    spelTemplate: '#{field}.size() {op} {value}',
    slots: {
      value: { key: 'value', type: 'number', transform: 'toNumber' },
      op: { key: 'op', type: 'literal' },
    },
    priority: 84,
    tags: ['collection', 'size', 'english'],
    examples: [{ nl: 'items size > 5', spel: '#items.size() > 5' }],
    difficulty: 'medium',
    confidence: 0.9,
  },

  // ================================================================
  // Group 6: String operations — pri 82-85
  // ================================================================

  {
    id: 'CN-STR-CONTAINS',
    match:
      /^(?<field>[^\s，,、]+?)(?:备注|名称|描述|标签|标题)?\s*(?:包含|含有|包括)\s*(?<substr>[^\s，,、]+)/,
    spelTemplate: "#{field}.contains('{substr}')",
    slots: { substr: { key: 'substr', type: 'string' } },
    priority: 85,
    tags: ['string', 'contains'],
    examples: [{ nl: '订单备注包含加急', spel: "#订单备注.contains('加急')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-STR-CONTAINS',
    match: /\b(?<field>\w+)\s+(?:contains?|includes?)\s+(?<substr>\S+)/i,
    spelTemplate: "#{field}.contains('{substr}')",
    slots: { substr: { key: 'substr', type: 'string' } },
    priority: 84,
    tags: ['string', 'contains', 'english'],
    examples: [{ nl: 'name contains test', spel: "#name.contains('test')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-STR-STARTS',
    match: /^(?<field>[^\s，,、]+?)\s*以\s*(?<prefix>[^\s，,、]+)\s*(?:开头|开始)/,
    spelTemplate: "#{field}.startsWith('{prefix}')",
    slots: { prefix: { key: 'prefix', type: 'string' } },
    priority: 85,
    tags: ['string', 'startsWith'],
    examples: [{ nl: '订单号以ORD开头', spel: "#订单号.startsWith('ORD')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-STR-STARTS',
    match: /\b(?<field>\w+)\s+(?:startsWith|starts\s+with)\s+(?<prefix>\S+)/i,
    spelTemplate: "#{field}.startsWith('{prefix}')",
    slots: { prefix: { key: 'prefix', type: 'string' } },
    priority: 84,
    tags: ['string', 'startsWith', 'english'],
    examples: [{ nl: 'id starts with ORD', spel: "#id.startsWith('ORD')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-STR-ENDS',
    match: /^(?<field>[^\s，,、]+?)\s*以\s*(?<suffix>[^\s，,、]+)\s*(?:结尾|结束)/,
    spelTemplate: "#{field}.endsWith('{suffix}')",
    slots: { suffix: { key: 'suffix', type: 'string' } },
    priority: 85,
    tags: ['string', 'endsWith'],
    examples: [{ nl: '文件名以.pdf结尾', spel: "#文件名.endsWith('.pdf')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-STR-ENDS',
    match: /\b(?<field>\w+)\s+(?:endsWith|ends\s+with)\s+(?<suffix>\S+)/i,
    spelTemplate: "#{field}.endsWith('{suffix}')",
    slots: { suffix: { key: 'suffix', type: 'string' } },
    priority: 84,
    tags: ['string', 'endsWith', 'english'],
    examples: [{ nl: 'name endsWith .pdf', spel: "#name.endsWith('.pdf')" }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-STR-MATCHES',
    match: /^(?<field>[^\s，,、]+?)\s*(?:匹配|符合)\s*(?<pattern>[^\s，,、]+)/,
    spelTemplate: "#{field} matches '{pattern}'",
    slots: { pattern: { key: 'pattern', type: 'string' } },
    priority: 82,
    tags: ['string', 'matches'],
    examples: [{ nl: '手机号匹配正则', spel: "#手机号 matches '正则'" }],
    difficulty: 'medium',
    confidence: 0.9,
  },
  {
    id: 'EN-STR-MATCHES',
    match: /\b(?<field>\w+)\s+matches\s+(?<pattern>\S+)/i,
    spelTemplate: "#{field} matches '{pattern}'",
    slots: { pattern: { key: 'pattern', type: 'string' } },
    priority: 81,
    tags: ['string', 'matches', 'english'],
    examples: [{ nl: 'id matches REGEX', spel: "#id matches 'REGEX'" }],
    difficulty: 'medium',
    confidence: 0.9,
  },

  // ================================================================
  // Group 7: Range — pri 82
  // ================================================================

  {
    id: 'CN-RANGE-BETWEEN',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:在|介于)\s*(?<min>\d+)\s*(?:和|到|~)\s*(?<max>\d+)\s*(?:之间|范围)?/,
    spelTemplate: '#{field} between {{{min}, {max}}}',
    slots: {
      min: { key: 'min', type: 'number', transform: 'toNumber' },
      max: { key: 'max', type: 'number', transform: 'toNumber' },
    },
    priority: 82,
    tags: ['range', 'between'],
    examples: [{ nl: '年龄在18到60之间', spel: '#年龄 between {18, 60}' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-RANGE-BETWEEN',
    match: /\b(?<field>\w+)\s+between\s+(?<min>\d+)\s+and\s+(?<max>\d+)/i,
    spelTemplate: '#{field} between {{{min}, {max}}}',
    slots: {
      min: { key: 'min', type: 'number', transform: 'toNumber' },
      max: { key: 'max', type: 'number', transform: 'toNumber' },
    },
    priority: 82,
    tags: ['range', 'between', 'english'],
    examples: [{ nl: 'amount between 100 and 500', spel: '#amount between {100, 500}' }],
    difficulty: 'easy',
    confidence: 0.95,
  },

  // ================================================================
  // Group 8: Elvis — pri 78
  // ================================================================

  {
    id: 'CN-ELVIS',
    match: /^(?<field>[^\s，,、]+?)\s*(?:或者|或\s+|默认|否则)\s*(?<default>[^\s，,、]+)/,
    spelTemplate: "#{field} ?: '{default}'",
    slots: { default: { key: 'default', type: 'string' } },
    priority: 78,
    tags: ['elvis'],
    examples: [{ nl: '用户名或者匿名用户', spel: "#用户名 ?: '匿名用户'" }],
    difficulty: 'medium',
    confidence: 0.85,
  },
  {
    id: 'EN-ELVIS',
    match: /\b(?<field>\w+)\s+(?:or\s+default|default\s+to)\s+(?<default>\S+)/i,
    spelTemplate: "#{field} ?: '{default}'",
    slots: { default: { key: 'default', type: 'string' } },
    priority: 77,
    tags: ['elvis', 'english'],
    examples: [{ nl: 'name or default Guest', spel: "#name ?: 'Guest'" }],
    difficulty: 'medium',
    confidence: 0.85,
  },

  // ================================================================
  // Group 9: Date — pri 75
  // ================================================================

  {
    id: 'CN-DATE-AFTER',
    match: /^(?<field>[^\s，,、]+?)\s*在\s*(?<date>[^\s，,、]+?)\s*之后/,
    spelTemplate: "#{field} > T(java.time.LocalDate).parse('{date}')",
    slots: { date: { key: 'date', type: 'string' } },
    priority: 75,
    tags: ['date', 'after'],
    examples: [
      {
        nl: '创建日期在2024-01-01之后',
        spel: "#创建日期 > T(java.time.LocalDate).parse('2024-01-01')",
      },
    ],
    difficulty: 'easy',
    confidence: 0.9,
  },
  {
    id: 'CN-DATE-BEFORE',
    match: /^(?<field>[^\s，,、]+?)\s*在\s*(?<date>[^\s，,、]+?)\s*之前/,
    spelTemplate: "#{field} < T(java.time.LocalDate).parse('{date}')",
    slots: { date: { key: 'date', type: 'string' } },
    priority: 75,
    tags: ['date', 'before'],
    examples: [
      {
        nl: '过期日期在2025-12-31之前',
        spel: "#过期日期 < T(java.time.LocalDate).parse('2025-12-31')",
      },
    ],
    difficulty: 'easy',
    confidence: 0.9,
  },
  {
    id: 'EN-DATE-AFTER',
    match: /\b(?<field>\w+)\s+after\s+(?<date>\S+)/i,
    spelTemplate: "#{field} > T(java.time.LocalDate).parse('{date}')",
    slots: { date: { key: 'date', type: 'string' } },
    priority: 75,
    tags: ['date', 'after', 'english'],
    examples: [
      { nl: 'date after 2024-06-01', spel: "#date > T(java.time.LocalDate).parse('2024-06-01')" },
    ],
    difficulty: 'easy',
    confidence: 0.9,
  },
  {
    id: 'EN-DATE-BEFORE',
    match: /\b(?<field>\w+)\s+before\s+(?<date>\S+)/i,
    spelTemplate: "#{field} < T(java.time.LocalDate).parse('{date}')",
    slots: { date: { key: 'date', type: 'string' } },
    priority: 75,
    tags: ['date', 'before', 'english'],
    examples: [
      { nl: 'date before 2025-01-01', spel: "#date < T(java.time.LocalDate).parse('2025-01-01')" },
    ],
    difficulty: 'easy',
    confidence: 0.9,
  },

  // ================================================================
  // Group 10: Type check — pri 73
  // ================================================================

  {
    id: 'CN-TYPE-INSTANCEOF',
    match:
      /^(?<field>[^\s，,、]+?)\s*(?:是否是|是否为|是|instanceof)\s*(?<type>[^\s，,、]+?)\s*(?:类型|类型|type|class)?$/i,
    spelTemplate: '#{field} instanceof T({type})',
    slots: { type: { key: 'type', type: 'variable' } },
    priority: 74,
    tags: ['type', 'instanceof'],
    examples: [{ nl: '账号是否是Admin类型', spel: '#账号 instanceof T(Admin)' }],
    difficulty: 'medium',
    confidence: 0.85,
  },
  {
    id: 'EN-TYPE-INSTANCEOF',
    match: /\b(?<field>\w+)\s+(?:is|instanceof)\s+(?<type>\w+)/i,
    spelTemplate: '#{field} instanceof T({type})',
    slots: { type: { key: 'type', type: 'variable' } },
    priority: 72,
    tags: ['type', 'instanceof', 'english'],
    examples: [{ nl: 'account is Admin', spel: '#account instanceof T(Admin)' }],
    difficulty: 'medium',
    confidence: 0.9,
  },

  // ================================================================
  // Group 11: Boolean — pri 70-74
  // ================================================================

  {
    id: 'CN-BOOL-TRUE',
    match: /^(?<field>[^\s，,、]+?)\s*(?:是|为|等于|==)\s*(?:true|真|是|yes)$/i,
    spelTemplate: '#{field} == true',
    slots: {},
    priority: 74,
    tags: ['boolean', 'isTrue'],
    examples: [{ nl: '用户是VIP', spel: '#用户 == true' }],
    difficulty: 'easy',
    confidence: 0.92,
  },
  {
    id: 'CN-BOOL-FALSE',
    match: /^(?<field>[^\s，,、]+?)\s*(?:不是|非|为|是|等于|==)\s*(?:false|假|否|no)$/i,
    spelTemplate: '#{field} == false',
    slots: {},
    priority: 73,
    tags: ['boolean', 'isFalse'],
    examples: [{ nl: '用户不是VIP', spel: '#用户 == false' }],
    difficulty: 'easy',
    confidence: 0.92,
  },
  {
    id: 'EN-BOOL-TRUE',
    match: /^(?<field>\w+)\s+(?:is\s+)?true$/i,
    spelTemplate: '#{field} == true',
    slots: {},
    priority: 75,
    tags: ['boolean', 'isTrue', 'english'],
    examples: [{ nl: 'isVIP is true', spel: '#isVIP == true' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'EN-BOOL-FALSE',
    match: /^(?<field>\w+)\s+(?:is\s+)?false$/i,
    spelTemplate: '#{field} == false',
    slots: {},
    priority: 75,
    tags: ['boolean', 'isFalse', 'english'],
    examples: [{ nl: 'flag is false', spel: '#flag == false' }],
    difficulty: 'easy',
    confidence: 0.95,
  },
  {
    id: 'CN-BOOL-FIELD',
    match: /^(?:是否|is\s+)(?<field>[^\s，,、]+?)(?:\?|吗|呢)?$/i,
    spelTemplate: '#{field}',
    slots: {},
    priority: 70,
    tags: ['boolean', 'field'],
    examples: [{ nl: '是否已支付', spel: '#已支付' }],
    difficulty: 'easy',
    confidence: 0.8,
  },

  // ================================================================
  // Group 12: Logical combination — pri 63-65
  // ================================================================

  {
    id: 'CN-LOGIC-AND',
    match: /(?<left>.+?)\s*(?:且|并且|而且|同时|&&)\s*(?<right>.+)/,
    spelTemplate: '({left}) and ({right})',
    slots: {
      left: { key: 'left', type: 'variable' },
      right: { key: 'right', type: 'variable' },
    },
    priority: 65,
    tags: ['logic', 'and'],
    examples: [{ nl: '金额大于1000且订单已确认', spel: '(金额大于1000) and (订单已确认)' }],
    difficulty: 'medium',
    confidence: 0.75,
  },
  {
    id: 'CN-LOGIC-OR',
    match: /(?<left>.+?)\s*(?:或|或者|\|\|)\s*(?<right>.+)/,
    spelTemplate: '({left}) or ({right})',
    slots: {
      left: { key: 'left', type: 'variable' },
      right: { key: 'right', type: 'variable' },
    },
    priority: 65,
    tags: ['logic', 'or'],
    examples: [{ nl: '金额大于1000或已发货', spel: '(金额大于1000) or (已发货)' }],
    difficulty: 'medium',
    confidence: 0.75,
  },
  {
    id: 'EN-LOGIC-AND',
    match: /\b(?<left>.+?)\s+\band\b\s+(?<right>.+)/i,
    spelTemplate: '({left}) and ({right})',
    slots: {
      left: { key: 'left', type: 'variable' },
      right: { key: 'right', type: 'variable' },
    },
    priority: 64,
    tags: ['logic', 'and', 'english'],
    examples: [
      { nl: 'amount > 100 and status == done', spel: '(amount > 100) and (status == done)' },
    ],
    difficulty: 'medium',
    confidence: 0.75,
  },
  {
    id: 'EN-LOGIC-OR',
    match: /\b(?<left>.+?)\s+\bor\b\s+(?<right>.+)/i,
    spelTemplate: '({left}) or ({right})',
    slots: {
      left: { key: 'left', type: 'variable' },
      right: { key: 'right', type: 'variable' },
    },
    priority: 64,
    tags: ['logic', 'or', 'english'],
    examples: [{ nl: 'VIP or amount > 1000', spel: '(VIP) or (amount > 1000)' }],
    difficulty: 'medium',
    confidence: 0.75,
  },

  // ================================================================
  // Group 13: Logical NOT — pri 61-62
  // ================================================================

  {
    id: 'CN-LOGIC-NOT',
    match: /^不是\s+(?<expr>.+)/,
    spelTemplate: '!({expr})',
    slots: { expr: { key: 'expr', type: 'variable' } },
    priority: 62,
    tags: ['logic', 'not'],
    examples: [{ nl: '不是有效', spel: '!(有效)' }],
    difficulty: 'easy',
    confidence: 0.85,
  },
  {
    id: 'EN-LOGIC-NOT',
    match: /^not\s+(?<expr>.+)/i,
    spelTemplate: '!({expr})',
    slots: { expr: { key: 'expr', type: 'variable' } },
    priority: 61,
    tags: ['logic', 'not', 'english'],
    examples: [{ nl: 'not cancelled', spel: '!(cancelled)' }],
    difficulty: 'easy',
    confidence: 0.85,
  },

  // ================================================================
  // Group 14: Projection & selection — pri 55-60
  // ================================================================

  {
    id: 'CN-SELECT-FIRST',
    match:
      /^(?<root>[^\s，,、]+?)\s*中\s*第一[个位]\s*(?<field>[^\s，,、]+?)\s*(?:大于|>|超过|<|小于|等于|==)\s*(?<value>[^\s，,、]+)/,
    spelTemplate: '#{root}.items.^[#{this}.{field} > {value}]',
    slots: {
      root: { key: 'root', type: 'variable' },
      field: { key: 'field', type: 'variable' },
      value: { key: 'value', type: 'literal' },
    },
    priority: 60,
    tags: ['selection', 'first'],
    examples: [{ nl: '订单中第一个金额大于1000的', spel: '#订单.items.^[#this.金额 > 1000]' }],
    difficulty: 'medium',
    confidence: 0.8,
  },
  {
    id: 'CN-SELECT-ALL',
    match:
      /^(?<root>[^\s，,、]+?)\s*中\s*所有\s*(?<field>[^\s，,、]+?)\s*(?:大于|>|超过|<|小于|等于|==|包含|满足)\s*(?<value>[^\s，,、]+)/,
    spelTemplate: '#{root}.items.?[#{this}.{field} > {value}]',
    slots: {
      root: { key: 'root', type: 'variable' },
      field: { key: 'field', type: 'variable' },
      value: { key: 'value', type: 'literal' },
    },
    priority: 60,
    tags: ['selection', 'all'],
    examples: [{ nl: '订单中所有金额大于1000的', spel: '#订单.items.?[#this.金额 > 1000]' }],
    difficulty: 'medium',
    confidence: 0.8,
  },
  {
    id: 'CN-PROJ',
    match:
      /^(?<root>[^\s，,、]+?)\s*中\s*每[个一]\s*(?:的)?(?<field>[^\s，,、]+?)\s*(?:值|金额|名称|价格|name|amount|price)?/,
    spelTemplate: '#{root}.items.![#{this}.{field}]',
    slots: {
      root: { key: 'root', type: 'variable' },
      field: { key: 'field', type: 'variable' },
    },
    priority: 55,
    tags: ['projection'],
    examples: [{ nl: '订单中每个商品的价格', spel: '#订单.items.![#this.商品]' }],
    difficulty: 'medium',
    confidence: 0.75,
  },
  {
    id: 'EN-SELECT-ALL',
    match: /all\s+(?<root>\w+)\s+with\s+(?<field>\w+)\s*>\s*(?<value>\d+)/i,
    spelTemplate: '#{root}.items.?[#{this}.{field} > {value}]',
    slots: {
      root: { key: 'root', type: 'variable' },
      field: { key: 'field', type: 'variable' },
      value: { key: 'value', type: 'number', transform: 'toNumber' },
    },
    priority: 50,
    tags: ['selection', 'all', 'english'],
    examples: [{ nl: 'all items with price > 100', spel: '#items.items.?[#this.price > 100]' }],
    difficulty: 'medium',
    confidence: 0.8,
  },
];

// Sort by priority descending
BUILTIN_PATTERNS.sort((a, b) => b.priority - a.priority);
