import type { LLMProvider } from './llm-provider.js';

/**
 * ProviderRegistry — manages registered LLMProvider instances.
 *
 * Provider ordering is user-controlled:
 * 1. Offline providers first (engine-enforced — offline capability is a binary fact)
 * 2. User-assigned priority (lower = preferred; default = registration order)
 * 3. Registration order (tiebreaker when priorities are equal)
 */
export class ProviderRegistry {
  private _providers: { provider: LLMProvider; priority: number; index: number }[] = [];
  private _nextIndex = 0;

  /**
   * Register a Provider.
   * @param provider LLMProvider instance
   * @param options.priority User-assigned priority (lower = preferred). Defaults to registration order.
   */
  public register(provider: LLMProvider, options?: { priority?: number }): void {
    if (this._providers.some((p) => p.provider.name === provider.name)) {
      throw new Error(`Provider '${provider.name}' already registered`);
    }
    this._providers.push({
      provider,
      priority: options?.priority ?? this._nextIndex,
      index: this._nextIndex,
    });
    this._nextIndex++;
  }

  /** Unregister a Provider */
  public unregister(name: string): void {
    this._providers = this._providers.filter((p) => p.provider.name !== name);
  }

  /** Get a Provider by name */
  public get(name: string): LLMProvider | undefined {
    return this._providers.find((p) => p.provider.name === name)?.provider;
  }

  /**
   * Get available Providers sorted by priority.
   * Sort rule: offline first → user priority (asc) → registration order (asc)
   */
  public async getPrioritized(): Promise<LLMProvider[]> {
    const available: { provider: LLMProvider; priority: number; index: number }[] = [];
    for (const entry of this._providers) {
      if (await entry.provider.isAvailable()) {
        available.push(entry);
      }
    }
    return available
      .sort((a, b) => {
        // 1. Offline first
        const aOffline = a.provider.capabilities.offlineAvailable;
        const bOffline = b.provider.capabilities.offlineAvailable;
        if (aOffline && !bOffline) return -1;
        if (!aOffline && bOffline) return 1;
        // 2. User priority (lower = preferred)
        if (a.priority !== b.priority) return a.priority - b.priority;
        // 3. Registration order
        return a.index - b.index;
      })
      .map((entry) => entry.provider);
  }

  /**
   * Explicitly reorder providers by name.
   * Providers not listed retain their position after the reordered ones.
   */
  public reorder(providerNames: string[]): void {
    const orderMap = new Map(providerNames.map((name, i) => [name, i]));
    const maxExisting = this._providers.reduce(
      (max, p) => Math.max(max, p.priority),
      providerNames.length - 1,
    );
    for (const entry of this._providers) {
      const explicitIndex = orderMap.get(entry.provider.name);
      entry.priority = explicitIndex ?? maxExisting + entry.index + 1;
    }
  }

  /** List all registered Providers */
  public list(): LLMProvider[] {
    return this._providers.map((p) => p.provider);
  }

  /** Number of registered Providers */
  public get count(): number {
    return this._providers.length;
  }
}
