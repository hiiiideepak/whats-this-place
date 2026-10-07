export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}
