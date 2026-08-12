import IORedis from "ioredis";

const LOGIN_THROTTLE_PREFIX = "login-throttle:";

export interface LoginThrottleStore {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  del(key: string): Promise<number>;
}

/** A Redis-backed counter so login limits apply to every application replica. */
export class RedisLoginThrottle {
  private client: LoginThrottleStore | undefined;

  constructor(
    private readonly redisUrl = process.env.REDIS_URL,
    private readonly createClient: (url: string) => LoginThrottleStore = (url) =>
      new IORedis(url, {
        connectTimeout: 2_000,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      }),
  ) {}

  async take(key: string, limit: number, windowMs: number): Promise<boolean> {
    const redisKey = `${LOGIN_THROTTLE_PREFIX}${key}`;
    const count = await this.getClient().incr(redisKey);
    if (count === 1) await this.getClient().pexpire(redisKey, windowMs);
    return count <= limit;
  }

  async reset(key: string): Promise<void> {
    await this.getClient().del(`${LOGIN_THROTTLE_PREFIX}${key}`);
  }

  private getClient(): LoginThrottleStore {
    if (!this.redisUrl) throw new Error("REDIS_URL is required for login throttling");
    this.client ??= this.createClient(this.redisUrl);
    return this.client;
  }
}
