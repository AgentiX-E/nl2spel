import type { LLMProvider } from './llm-provider.js';

/**
 * ProviderRegistry —— 管理已注册的 LLMProvider 实例。
 *
 * 职责:
 * 1. 注册/注销 Provider
 * 2. 按优先级排序 (离线优先 > 低延迟 > 高准确率)
 * 3. 按 name 查找 Provider（用于强制指定）
 */
export class ProviderRegistry {
  private _providers: LLMProvider[] = [];

  /** 注册 Provider */
  public register(provider: LLMProvider): void {
    if (this._providers.some(p => p.name === provider.name)) {
      throw new Error(`Provider '${provider.name}' already registered`);
    }
    this._providers.push(provider);
  }

  /** 注销 Provider */
  public unregister(name: string): void {
    this._providers = this._providers.filter(p => p.name !== name);
  }

  /** 按名称获取 Provider */
  public get(name: string): LLMProvider | undefined {
    return this._providers.find(p => p.name === name);
  }

  /**
   * 按优先级获取可用 Provider 列表。
   * 排序规则: offline > low cost > low latency > high accuracy
   */
  public async getPrioritized(): Promise<LLMProvider[]> {
    const available: LLMProvider[] = [];
    for (const p of this._providers) {
      if (await p.isAvailable()) {
        available.push(p);
      }
    }
    return available.sort((a, b) => {
      // 1. 离线优先
      if (a.capabilities.offlineAvailable !== b.capabilities.offlineAvailable) {
        return a.capabilities.offlineAvailable ? -1 : 1;
      }
      // 2. 便宜优先
      const costA = a.capabilities.estimatedCostPerRequest ?? Infinity;
      const costB = b.capabilities.estimatedCostPerRequest ?? Infinity;
      if (costA !== costB) return costA - costB;
      // 3. 低延迟优先
      return a.capabilities.estimatedLatencyMs - b.capabilities.estimatedLatencyMs;
    });
  }

  /** 列出所有已注册 Provider */
  public list(): LLMProvider[] {
    return [...this._providers];
  }

  /** 已注册 Provider 数量 */
  public get count(): number {
    return this._providers.length;
  }
}
