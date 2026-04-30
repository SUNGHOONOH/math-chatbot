'use client';

export function createClientId(prefix: string): string {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);

  if (randomUUID) {
    return `${prefix}-${randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}
