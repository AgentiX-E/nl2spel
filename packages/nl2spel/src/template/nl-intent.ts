/**
 * NLIntent — 自然语言意图分类体系。
 *
 * 15 种意图类型覆盖所有 SpEL 常见使用场景。
 */
export enum NLIntent {
  /** 数值比较: "amount > 100", "年龄大于18" */
  COMPARISON = 'COMPARISON',

  /** 权限检查: "hasRole('admin')", "用户是VIP" */
  PERMISSION_CHECK = 'PERMISSION_CHECK',

  /** 空值检查: "== null", "!= null", "不为空" */
  NULL_CHECK = 'NULL_CHECK',

  /** 逻辑组合: "a and b", "金额大于100且已确认" */
  LOGICAL = 'LOGICAL',

  /** 字符串匹配: "contains('keyword')", "以ORD开头" */
  STRING_MATCH = 'STRING_MATCH',

  /** 集合操作: "list.contains('x')", "items.isEmpty()" */
  COLLECTION = 'COLLECTION',

  /** 范围检查: "between {1, 10}", "年龄在18到60之间" */
  RANGE = 'RANGE',

  /** 选择(筛选): ".?[condition]", "所有满足条件的" */
  SELECTION = 'SELECTION',

  /** 投影: ".![field]", "每个项目的名称" */
  PROJECTION = 'PROJECTION',

  /** 类型检查: "instanceof", "是否是Admin类型" */
  TYPE_CHECK = 'TYPE_CHECK',

  /** Boolean 属性: "isVIP", "是否已支付" */
  BOOLEAN = 'BOOLEAN',

  /** 日期比较: "after/before", "在某日期之后" */
  DATE = 'DATE',

  /** Elvis 默认值: "a ?: default", "或默认值" */
  ELVIS = 'ELVIS',

  /** 赋值: "a = value", "设置字段为" */
  ASSIGNMENT = 'ASSIGNMENT',

  /** 算术运算: "amount * price", "总价 = 单价×数量" */
  ARITHMETIC = 'ARITHMETIC',
}
