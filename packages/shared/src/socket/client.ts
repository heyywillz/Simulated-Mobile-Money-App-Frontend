/**
 * Client-side Socket emulator with typed events.
 * Provides .on, .off, .emit, .disconnect matching Socket.io client API
 * using local simulation events without network requests.
 */

import { simEvents } from '../api/store';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  AdminServerToClientEvents,
  AdminClientToServerEvents,
} from '../types';

export class MockSocket<Events extends Record<string, any>> {
  private listeners: Record<string, ((...args: any[]) => void)[]> = {};
  private domListeners: Record<string, (e: any) => void> = {};

  on<K extends keyof Events>(event: K, fn: Events[K]): this {
    const ev = event as string;
    if (!this.listeners[ev]) this.listeners[ev] = [];
    this.listeners[ev].push(fn);

    simEvents.on(ev, fn);

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const domHandler = (e: any) => {
        try {
          fn(e.detail);
        } catch {}
      };
      this.domListeners[`${ev}_${this.listeners[ev].length}`] = domHandler;
      window.addEventListener(`momo_sim:${ev}`, domHandler);
    }
    return this;
  }

  off<K extends keyof Events>(event: K, fn: Events[K]): this {
    const ev = event as string;
    if (this.listeners[ev]) {
      this.listeners[ev] = this.listeners[ev].filter((l) => l !== fn);
    }
    simEvents.off(ev, fn);
    return this;
  }

  emit(event: string, ...args: any[]): this {
    simEvents.emit(event, ...args);
    return this;
  }

  disconnect(): void {
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

export type TypedSocket = MockSocket<ServerToClientEvents>;
export type AdminSocket = MockSocket<AdminServerToClientEvents>;

/**
 * Create a client-side simulated socket for end-user apps.
 */
export function createUserSocket(
  _token: string,
  _sessionId: string,
  _wsUrl?: string
): TypedSocket {
  return new MockSocket<ServerToClientEvents>();
}

/**
 * Create a client-side simulated socket for the admin portal.
 */
export function createAdminSocket(
  _token: string,
  _wsUrl?: string
): AdminSocket {
  return new MockSocket<AdminServerToClientEvents>();
}
