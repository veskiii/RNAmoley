import type { Request, Response, NextFunction } from "express";

type PollingRateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
};

type Bucket = {
  startedAt: number;
  count: number;
};

export function createPollingRateLimiter(options: PollingRateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const windowMs = Math.max(100, options.windowMs);
    const maxRequests = Math.max(1, options.maxRequests);
    const now = Date.now();

    const key =
      options.keyGenerator?.(req) ??
      `${req.ip}|${req.params.id || "no-job"}|${req.params.modelNumber || "no-model"}|${req.path}`;

    const bucket = buckets.get(key);

    if (!bucket || now - bucket.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - bucket.startedAt)) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.status(429).send({
        error: "Too many status requests. Please retry later.",
      });
      return;
    }

    bucket.count += 1;

    if (buckets.size > 10000) {
      for (const [bucketKey, value] of buckets) {
        if (now - value.startedAt >= windowMs) {
          buckets.delete(bucketKey);
        }
      }
    }

    next();
  };
}
