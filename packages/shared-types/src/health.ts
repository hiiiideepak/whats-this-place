export type DependencyStatus = 'up' | 'down';

export interface DependencyCheck {
  status: DependencyStatus;
  latency_ms?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: 'around-api';
  checks: {
    postgres: DependencyCheck;
    redis: DependencyCheck;
  };
}
