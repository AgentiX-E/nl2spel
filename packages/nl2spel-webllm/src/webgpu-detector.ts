/**
 * WebGPU detector — detects whether the browser supports WebGPU.
 */
export interface WebGPUDetectionResult {
  /** Whether WebGPU is available */
  available: boolean;
  /** GPU adapter info (if available) */
  adapterInfo?: {
    vendor: string;
    architecture: string;
    description: string;
    device: string;
  };
  /** Error message (if not available) */
  error?: string;
}

export async function detectWebGPU(): Promise<WebGPUDetectionResult> {
  // Check if navigator.gpu exists
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return {
      available: false,
      error: 'WebGPU is not supported: navigator.gpu is not available',
    };
  }

  try {
    const adapter = await (navigator as any).gpu?.requestAdapter();
    if (!adapter) {
      return {
        available: false,
        error: 'WebGPU adapter not found: no compatible GPU',
      };
    }

    const adapterInfo = (await adapter.requestAdapterInfo?.()) as any;

    return {
      available: true,
      adapterInfo: adapterInfo
        ? {
            vendor: adapterInfo.vendor ?? 'unknown',
            architecture: adapterInfo.architecture ?? 'unknown',
            description: adapterInfo.description ?? 'unknown',
            device: adapterInfo.device ?? 'unknown',
          }
        : undefined,
    };
  } catch (err) {
    return {
      available: false,
      error: `WebGPU detection failed: ${(err as Error).message}`,
    };
  }
}
