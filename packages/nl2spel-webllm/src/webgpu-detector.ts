/**
 * WebGPU 检测器 — 检测浏览器是否支持 WebGPU。
 */
export interface WebGPUDetectionResult {
  /** WebGPU 是否可用 */
  available: boolean;
  /** GPU 适配器信息（如果可用） */
  adapterInfo?: {
    vendor: string;
    architecture: string;
    description: string;
    device: string;
  };
  /** 错误信息（如果不可用） */
  error?: string;
}

export async function detectWebGPU(): Promise<WebGPUDetectionResult> {
  // 检查 navigator.gpu 是否存在
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
