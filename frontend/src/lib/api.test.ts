import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveApiBase } from './api.ts';

type WindowLike = {
  location?: {
    origin?: string;
  };
};

function withWindow(windowValue: WindowLike | undefined, callback: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

  if (windowValue === undefined) {
    Reflect.deleteProperty(globalThis, 'window');
  } else {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: windowValue,
    });
  }

  try {
    callback();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'window', descriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
}

test('resolveApiBase falls back to localhost backend when window is unavailable', () => {
  withWindow(undefined, () => {
    assert.equal(resolveApiBase(), 'http://127.0.0.1:8000');
  });
});

test('resolveApiBase uses localhost backend while running on a frontend dev server', () => {
  withWindow({ location: { origin: 'http://127.0.0.1:5173' } }, () => {
    assert.equal(resolveApiBase(), 'http://127.0.0.1:8000');
  });
});

test('resolveApiBase uses the current origin for packaged or backend-served builds', () => {
  withWindow({ location: { origin: 'http://127.0.0.1:45678' } }, () => {
    assert.equal(resolveApiBase(), 'http://127.0.0.1:45678');
  });

  withWindow({ location: { origin: 'tauri://localhost' } }, () => {
    assert.equal(resolveApiBase(), 'tauri://localhost');
  });

  withWindow({ location: { origin: 'https://desktop.local' } }, () => {
    assert.equal(resolveApiBase(), 'https://desktop.local');
  });
});
