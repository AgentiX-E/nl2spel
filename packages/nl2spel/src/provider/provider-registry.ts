import type { LLMProvider } from './llm-provider.js';

/**
 * ProviderRegistry — manages registered LLMProvider instances.
 *
 * Responsibilities:
 * 1. Register/unregister Providers
 * 2. Sort by priority (offline first > low latency > high accuracy)
 * 3. Look up Providers by name (for forced selection)
 */
export class ProviderRegistry {
  private _providers: LLMProvider[] = [];

  /** Register a Provider */
  public register(provider: LLMProvider): void {
    if (this._providers.some(p => p.name === provider.name)) {
      throw new Error(`Provider '${provider.name}' already registered`);
    }
    this._providers.push(provider);
  }

  /** Unregister a Provider */
  public unregister(name: string): void {
    this._providers = this._providers.filter(p => p.name !== name);
  }

  /** Get a Provider by name */
  public get(name: string): LLMProvider | undefined {
    return this._providers.find(p => p.name === name);
  }

  /**
   * Get available Providers sorted by priority.
   * Sort rule: offline > low cost > low latency > high accuracy
   */
  public async getPrioritized(): Promise<LLMProvider[]> {
    const available: LLMProvider[] = [];
    for (const p of this._providers) {
      if (await p.isAvailable()) {
        available.push(p);
      }
    }
    return available.sort((a, b) => {
      // 1. Offline first
      const aOffline = a.capabilities.offlineAvailable;
      const bOffline = b.capabilities.offlineAvailable;
      if (aOffline && !bOffline) return -1;
      if (!aOffline && bOffline) return 1;
      // 2. Cheaper first
      const costA = a.capabilities.estimatedCostPerRequest ?? Infinity;
      const costB = b.capabilities.estimatedCostPerRequest ?? Infinity;
      if (costA < costB) return -1;
      if (costB < costA) return 1;
      // 3. Lower latency first
      return a.capabilities.estimatedLatencyMs - b.capabilities.estimatedLatencyMs;
    });
  }

  /** List all registered Providers */
  public list(): LLMProvider[] {
    return [...this._providers];
  }

  /** Number of registered Providers */
  public get count(): number {
    return this._providers.length;
  }
}
