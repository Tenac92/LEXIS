import session from 'express-session';
import type { RedisClientType } from 'redis';

const DEFAULT_TTL_SECONDS = 48 * 60 * 60;
const PREFIX = 'sess:';

function getTtlSeconds(sess: session.SessionData): number {
  const cookie: any = (sess as any)?.cookie;
  if (cookie?.expires) {
    const expiresAt = new Date(cookie.expires).getTime();
    const ttlMs = expiresAt - Date.now();
    if (ttlMs > 0) {
      return Math.max(1, Math.floor(ttlMs / 1000));
    }
  }

  if (typeof cookie?.maxAge === 'number' && cookie.maxAge > 0) {
    return Math.max(1, Math.floor(cookie.maxAge / 1000));
  }

  return DEFAULT_TTL_SECONDS;
}

export class RedisSessionStore extends session.Store {
  private readonly client: RedisClientType;
  private readonly prefix: string;

  constructor(client: RedisClientType, prefix: string = PREFIX) {
    super();
    this.client = client;
    this.prefix = prefix;
  }

  private key(sid: string): string {
    return `${this.prefix}${sid}`;
  }

  get(
    sid: string,
    callback: (err?: any, session?: session.SessionData | null) => void,
  ): void {
    this.client
      .get(this.key(sid))
      .then((raw) => {
        if (!raw) {
          callback(undefined, null);
          return;
        }
        try {
          callback(undefined, JSON.parse(raw) as session.SessionData);
        } catch (parseError) {
          callback(parseError);
        }
      })
      .catch((error) => callback(error));
  }

  set(
    sid: string,
    sess: session.SessionData,
    callback?: (err?: any) => void,
  ): void {
    const ttl = getTtlSeconds(sess);
    const serialized = JSON.stringify(sess);

    this.client
      .setEx(this.key(sid), ttl, serialized)
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    this.client
      .del(this.key(sid))
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  touch(
    sid: string,
    sess: session.SessionData,
    callback?: () => void,
  ): void {
    const ttl = getTtlSeconds(sess);
    this.client
      .expire(this.key(sid), ttl)
      .then(() => callback?.())
      .catch(() => callback?.());
  }

  clear(callback?: (err?: any) => void): void {
    this.client
      .keys(`${this.prefix}*`)
      .then((keys) => {
        if (!keys.length) {
          callback?.();
          return;
        }
        return this.client.del(keys).then(() => callback?.());
      })
      .catch((error) => callback?.(error));
  }

  length(callback: (err?: any, length?: number) => void): void {
    this.client
      .keys(`${this.prefix}*`)
      .then((keys) => callback(undefined, keys.length))
      .catch((error) => callback(error));
  }
}

