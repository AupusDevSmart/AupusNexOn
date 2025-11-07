/**
 * Vitest Setup File
 *
 * Configuração global para testes com Vitest + React Testing Library
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Cleanup após cada teste
afterEach(() => {
  cleanup();
});

// Mock de requestAnimationFrame e cancelAnimationFrame
beforeAll(() => {
  global.requestAnimationFrame = (cb: FrameRequestCallback) => {
    return setTimeout(cb, 16) as unknown as number;
  };

  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };

  // Mock de ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock de MutationObserver
  global.MutationObserver = class MutationObserver {
    constructor(callback: MutationCallback) {}
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };

  // Mock de document.fullscreenElement
  Object.defineProperty(document, 'fullscreenElement', {
    writable: true,
    value: null,
  });
});
