class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  startTimer(label: string): () => number {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
      return duration;
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    const values = this.metrics.get(label)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  getMetrics(label: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count,
      avg: sum / count,
      min: sorted[0]!,
      max: sorted[count - 1]!,
      p95: sorted[Math.floor(count * 0.95)]!,
    };
  }

  getAllMetrics(): Record<string, ReturnType<PerformanceMonitor['getMetrics']>> {
    const result: Record<string, any> = {};
    for (const [label] of this.metrics) {
      result[label] = this.getMetrics(label);
    }
    return result;
  }

  clear(): void {
    this.metrics.clear();
  }
}

export const monitor = new PerformanceMonitor();

// Performance measurement decorator
export function measure<T extends (...args: any[]) => any>(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> | void {
  const method = descriptor.value!;

  descriptor.value = ((...args: any[]) => {
    const endTimer = monitor.startTimer(`${target.constructor.name}.${propertyName}`);
    
    try {
      const result = method.apply(target, args);
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          endTimer();
        });
      }
      
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      throw error;
    }
  }) as T;

  return descriptor;
}