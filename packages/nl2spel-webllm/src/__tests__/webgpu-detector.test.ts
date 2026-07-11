import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectWebGPU } from '../webgpu-detector.js';

describe('detectWebGPU', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return available=false when navigator is undefined', async () => {
    const result = await detectWebGPU();
    // In Node.js without mock, navigator.gpu is undefined
    expect(result.available).toBe(false);
    expect(result.error).toContain('not available');
  });

  it('should handle adapter request failure', async () => {
    const mockRequestAdapter = vi.fn().mockResolvedValue(null);

    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: mockRequestAdapter },
    });

    const result = await detectWebGPU();

    expect(result.available).toBe(false);
    expect(result.error).toContain('adapter not found');
  });

  it('should return available=true with adapter info', async () => {
    const mockAdapterInfo = {
      vendor: 'NVIDIA',
      architecture: 'Ampere',
      description: 'RTX 4090',
      device: '0x2684',
    };

    const mockAdapter = {
      requestAdapterInfo: vi.fn().mockResolvedValue(mockAdapterInfo),
    };

    const mockRequestAdapter = vi.fn().mockResolvedValue(mockAdapter);

    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: mockRequestAdapter },
    });

    const result = await detectWebGPU();

    expect(result.available).toBe(true);
    expect(result.adapterInfo).toBeDefined();
    expect(result.adapterInfo!.vendor).toBe('NVIDIA');
    expect(result.adapterInfo!.architecture).toBe('Ampere');
  });

  it('should handle adapter without info method', async () => {
    const mockRequestAdapter = vi.fn().mockResolvedValue({});
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: mockRequestAdapter },
    });

    const result = await detectWebGPU();

    expect(result.available).toBe(true);
    expect(result.adapterInfo).toBeUndefined();
  });

  it('should catch and report requestAdapter errors', async () => {
    const mockRequestAdapter = vi.fn().mockRejectedValue(new Error('GPU crash'));
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: mockRequestAdapter },
    });

    const result = await detectWebGPU();

    expect(result.available).toBe(false);
    expect(result.error).toContain('GPU crash');
  });

  it('should use "unknown" fallback when adapter info fields are null', async () => {
    const mockAdapterInfo = { vendor: null, architecture: null, description: null, device: null };
    const mockAdapter = { requestAdapterInfo: vi.fn().mockResolvedValue(mockAdapterInfo) };
    vi.stubGlobal('navigator', {
      gpu: { requestAdapter: vi.fn().mockResolvedValue(mockAdapter) },
    });

    const result = await detectWebGPU();

    expect(result.available).toBe(true);
    expect(result.adapterInfo!.vendor).toBe('unknown');
    expect(result.adapterInfo!.architecture).toBe('unknown');
  });
});
