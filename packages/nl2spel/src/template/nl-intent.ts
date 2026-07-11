/**
 * NLIntent — Natural language intent classification system.
 *
 * 15 intent types covering all common SpEL usage scenarios.
 */
export enum NLIntent {
  /** Numeric comparison: "amount > 100", "年龄大于18" */
  COMPARISON = 'COMPARISON',

  /** Permission check: "hasRole('admin')", "用户是VIP" */
  PERMISSION_CHECK = 'PERMISSION_CHECK',

  /** Null check: "== null", "!= null", "不为空" */
  NULL_CHECK = 'NULL_CHECK',

  /** Logical combination: "a and b", "金额大于100且已确认" */
  LOGICAL = 'LOGICAL',

  /** String matching: "contains('keyword')", "以ORD开头" */
  STRING_MATCH = 'STRING_MATCH',

  /** Collection operations: "list.contains('x')", "items.isEmpty()" */
  COLLECTION = 'COLLECTION',

  /** Range check: "between {1, 10}", "年龄在18到60之间" */
  RANGE = 'RANGE',

  /** Selection (filter): ".?[condition]", "all matching conditions" */
  SELECTION = 'SELECTION',

  /** Projection: ".![field]", "each item's name" */
  PROJECTION = 'PROJECTION',

  /** Type check: "instanceof", "是否是Admin类型" */
  TYPE_CHECK = 'TYPE_CHECK',

  /** Boolean property: "isVIP", "是否已支付" */
  BOOLEAN = 'BOOLEAN',

  /** Date comparison: "after/before", "after a certain date" */
  DATE = 'DATE',

  /** Elvis default: "a ?: default", "or default value" */
  ELVIS = 'ELVIS',

  /** Assignment: "a = value", "set field to" */
  ASSIGNMENT = 'ASSIGNMENT',

  /** Arithmetic: "amount * price", "total = unit price × quantity" */
  ARITHMETIC = 'ARITHMETIC',
}
