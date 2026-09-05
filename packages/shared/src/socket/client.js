/**
 * Client-side Socket emulator.
 * Provides .on, .off, .emit, .disconnect matching Socket.io client API
 * using local simulation events without network requests.
 */

import { simEvents } from '../api/store';

export class MockSocket {
  constructor() {
    this.listeners = {};
    this.domListeners = {};
  }

  on(event, fn) {
    const ev = String(event);
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);

    simEvents.on(ev, fn);

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const domHandler = (e) => {
        try {
          fn(e.detail);
        } catch {}
      };
      this.domListeners[`${ev}_${this.listeners[ev].length}`] = domHandler;
      window.addEventListener(`momo_sim:${ev}`, domHandler);
    }
    return this;
  }

  off(event, fn) {
    const ev = String(event);
    if (this.listeners[ev]) {
      this.listeners[ev] = this.listeners[ev].filter((l) => l !== fn);
    }
    simEvents.off(ev, fn);
    return this;
  }

  emit(event, ...args) {
    simEvents.emit(event, ...args);
    return this;
  }

  disconnect() {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      Object.entries(this.domListeners).forEach(([key, handler]) => {
        const eventName = key.substring(0, key.lastIndexOf('_'));
        window.removeEventListener(`momo_sim:${eventName}`, handler);
      });
      this.domListeners = {};
    }
    this.listeners = {};
  }
}

/**
 * Create a client-side simulated socket for end-user apps.
 */
export function createUserSocket(_token, _sessionId, _wsUrl) {
  return new MockSocket();
}

/**
 * Create a client-side simulated socket for the admin portal.
 */
export function createAdminSocket(_token, _wsUrl) {
  return new MockSocket();
}
