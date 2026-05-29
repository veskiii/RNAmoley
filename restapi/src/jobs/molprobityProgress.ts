import { EventEmitter } from "events";
import type { UUID } from "crypto";
import path from "path";
import { Queue, QueueEvents } from "bullmq";
import type { Analysis_results, Metadata, metrics, nucleotideResult } from "./types.js";
import { saveMetadata, saveResults, updateModelMetadata } from "./utils.js";

const queueName = "molprobity-oneline";
const redisConnection = {
  host: process.env.REDIS_HOST ?? "redis",
  port: Number(process.env.REDIS_PORT ?? 6379),
};

const molprobityQueue = new Queue<{ filename: string }>(queueName, {
  connection: redisConnection,
});

const molprobityQueueEvents = new QueueEvents(queueName, {
  connection: redisConnection,
});

const queueEventsReady = molprobityQueueEvents.waitUntilReady();
const pendingJobResolvers = new Map<
  string,
  {
    resolve: (value: metrics) => void;
    reject: (error: Error) => void;
  }
>();

molprobityQueueEvents.on("completed", ({ jobId, returnvalue }) => {
  if (!jobId) {
    return;
  }

  const pending = pendingJobResolvers.get(jobId);
  if (!pending) {
    return;
  }

  pendingJobResolvers.delete(jobId);

  try {
    const parsed = typeof returnvalue === "string" ? JSON.parse(returnvalue) as metrics : returnvalue as metrics;
    pending.resolve(parsed);
  } catch (error) {
    pending.reject(error instanceof Error ? error : new Error(String(error)));
  }
});

molprobityQueueEvents.on("failed", ({ jobId, failedReason }) => {
  if (!jobId) {
    return;
  }

  const pending = pendingJobResolvers.get(jobId);
  if (!pending) {
    return;
  }

  pendingJobResolvers.delete(jobId);
  pending.reject(new Error(failedReason ?? `MolProbity job ${jobId} failed`));
});

const activeSessions = new Map<string, SphereSession>();

type SphereTask = {
  filename: string;
  jobId: string;
};

type SphereUpdate = {
  filename: string;
  metrics?: metrics;
  error?: string;
};

export type SphereSessionSnapshot = {
  key: string;
  jobID: UUID;
  modelNumber: string;
  completed: number;
  total: number;
  failed: number;
  results: nucleotideResult[];
  pending: SphereUpdate[];
  done: boolean;
  failedSession: boolean;
};

export type SphereSession = {
  key: string;
  jobID: UUID;
  modelNumber: string;
  analyzeStructureEnteredAt?: number;
  startedAt: number;
  resultsSuffix: string;
  metadata: Metadata;
  modelMetrics: metrics;
  fragmentMetrics: metrics;
  initialByResidueNumber: Map<number, nucleotideResult>;
  sourceToResidueNumber: Map<string, number>;
  emitter: EventEmitter;
  tasks: SphereTask[];
  pendingUpdates: SphereUpdate[];
  completed: number;
  failed: number;
  total: number;
  batchSize: number;
  flushDelayMs: number;
  flushTimer?: NodeJS.Timeout;
  finished: boolean;
  failedSession: boolean;
  recordLog?: (message: string) => void;
};

export type StartSphereSessionParams = {
  jobID: UUID;
  modelNumber: string;
  files: string[];
  initialData: nucleotideResult[];
  modelMetrics: metrics;
  fragmentMetrics: metrics;
  resultsSuffix: string;
  metadata: Metadata;
  analyzeStructureStartedAt?: number;
  recordLog?: (message: string) => void;
};

function getSessionKey(jobID: UUID, modelNumber: string) {
  return `${jobID}:${modelNumber}`;
}

function buildResultMaps(initialData: nucleotideResult[]) {
  const initialByResidueNumber = new Map<number, nucleotideResult>();
  const sourceToResidueNumber = new Map<string, number>();

  for (const residue of initialData) {
    initialByResidueNumber.set(residue.residue_number, { ...residue });
    sourceToResidueNumber.set(`${residue.chainID}:${residue.original_index}`, residue.residue_number);
  }

  return { initialByResidueNumber, sourceToResidueNumber };
}

function parseSphereFilename(filename: string) {
  const baseName = path.basename(filename, path.extname(filename));
  const [chainID = "", residueNumberStr = ""] = baseName.split("_");
  const residueNumber = Number(residueNumberStr);

  if (!chainID || !Number.isFinite(residueNumber)) {
    return null;
  }

  return { chainID, residueNumber };
}

function getSortedResults(session: SphereSession) {
  return Array.from(session.initialByResidueNumber.values()).sort(
    (left, right) => left.residue_number - right.residue_number,
  );
}

function getOverallStatus(metadata: Metadata): Metadata["status"] {
  const statuses = Object.values(metadata.resultsStatus ?? {});
  if (statuses.length === 0) {
    return metadata.status;
  }

  if (statuses.some((status) => status.status === "starting" || status.status === "running")) {
    return "running";
  }

  if (statuses.every((status) => status.status === "failed")) {
    return "failed";
  }

  if (statuses.every((status) => status.status === "completed" || status.status === "failed")) {
    return statuses.some((status) => status.status === "completed") ? "completed" : "failed";
  }

  return "running";
}

async function emitSnapshot(session: SphereSession) {
  const snapshot = getSphereSessionSnapshot(session.key);
  if (!snapshot) {
    return;
  }

  session.emitter.emit("batch", snapshot);
  session.recordLog?.(
    `molprobity batch flush completed=${snapshot.completed}/${snapshot.total} failed=${snapshot.failed}`,
  );

  await saveResults(
    session.jobID,
    session.modelNumber,
    {
      data: snapshot.results,
      modelMetrics: session.modelMetrics,
      fragmentMetrics: session.fragmentMetrics,
    },
    session.resultsSuffix,
  );
}

async function flushPendingUpdates(session: SphereSession, forceFinal = false) {
  if (session.flushTimer) {
    clearTimeout(session.flushTimer);
    session.flushTimer = undefined;
  }

  if (session.pendingUpdates.length === 0 && !forceFinal) {
    return;
  }

  const updates = session.pendingUpdates.splice(0, session.pendingUpdates.length);
  if (updates.length > 0) {
    for (const update of updates) {
      const parsed = parseSphereFilename(update.filename);
      if (!parsed || !update.metrics) {
        continue;
      }

      const residueNumber = session.sourceToResidueNumber.get(`${parsed.chainID}:${parsed.residueNumber}`);
      if (residueNumber === undefined) {
        continue;
      }

      const existing = session.initialByResidueNumber.get(residueNumber);
      if (!existing) {
        continue;
      }

      session.initialByResidueNumber.set(residueNumber, {
        ...existing,
        metrics: update.metrics,
      });
    }
  }

  await emitSnapshot(session);

  if (forceFinal || session.completed >= session.total) {
    const finalSnapshot = getSphereSessionSnapshot(session.key);
    session.finished = true;
    session.emitter.emit("done", finalSnapshot);
    activeSessions.delete(session.key);

    // Log total session duration (end-to-end) if we have a start time
    try {
      const durationMs = Date.now() - (session.startedAt ?? Date.now());
      session.recordLog?.(`molprobity sphere session total_ms=${durationMs}`);

      // If we have an analyzeStructure entry time, log time since analyzeStructure was entered
      if (session.analyzeStructureEnteredAt) {
        const sinceAnalyzeMs = Date.now() - session.analyzeStructureEnteredAt;
        session.recordLog?.(`molprobity sphere since_analyzeStructure_ms=${sinceAnalyzeMs}`);
      }
    } catch (err) {
      // ignore logging errors
    }

    updateModelMetadata(
      session.metadata,
      session.modelNumber,
      session.failedSession ? "failed" : "completed",
      session.failedSession ? `${session.failed} sphere analyses failed` : undefined,
    );
    session.metadata.status = getOverallStatus(session.metadata);
    await saveMetadata(session.jobID, session.metadata);
  }
}

async function scheduleFlush(session: SphereSession) {
  if (session.flushTimer) {
    return;
  }

  session.flushTimer = setTimeout(() => {
    session.flushTimer = undefined;
    void flushPendingUpdates(session).catch((error) => {
      console.error(`[molprobity-progress] failed to flush session ${session.key}:`, error);
    });
  }, session.flushDelayMs);

  session.flushTimer.unref?.();
}

async function startBackgroundProcessing(session: SphereSession) {
  await queueEventsReady;

  const jobWaiters = session.tasks.map(async (task) => {
    try {
      const jobPromise = new Promise<metrics>((resolve, reject) => {
        pendingJobResolvers.set(task.jobId, { resolve, reject });
      });

      await molprobityQueue.add("oneline-analysis", { filename: task.filename }, { jobId: task.jobId });
      const parsedResult = await jobPromise;

      session.completed += 1;
      session.pendingUpdates.push({ filename: task.filename, metrics: parsedResult });
      if (session.pendingUpdates.length >= session.batchSize || session.completed >= session.total) {
        await flushPendingUpdates(session, session.completed >= session.total);
      } else {
        await scheduleFlush(session);
      }
    } catch (error) {
      session.completed += 1;
      session.failed += 1;
      session.failedSession = true;
      session.pendingUpdates.push({
        filename: task.filename,
        error: error instanceof Error ? error.message : String(error),
      });
      session.recordLog?.(`molprobity task failed filename=${task.filename} error=${error instanceof Error ? error.message : String(error)}`);
      if (session.pendingUpdates.length >= session.batchSize || session.completed >= session.total) {
        await flushPendingUpdates(session, session.completed >= session.total);
      } else {
        await scheduleFlush(session);
      }
    }
  });

  await Promise.allSettled(jobWaiters);
  await flushPendingUpdates(session, true);
}

export async function startMolprobitySphereSession(params: StartSphereSessionParams) {
  const key = getSessionKey(params.jobID, params.modelNumber);
  const existingSession = activeSessions.get(key);
  if (existingSession) {
    return existingSession;
  }

  const { initialByResidueNumber, sourceToResidueNumber } = buildResultMaps(params.initialData);
  const session: SphereSession = {
    key,
    jobID: params.jobID,
    modelNumber: params.modelNumber,
    analyzeStructureEnteredAt: params.analyzeStructureStartedAt,
    startedAt: Date.now(),
    resultsSuffix: params.resultsSuffix,
    metadata: params.metadata,
    modelMetrics: params.modelMetrics,
    fragmentMetrics: params.fragmentMetrics,
    initialByResidueNumber,
    sourceToResidueNumber,
    emitter: new EventEmitter(),
    tasks: params.files.map((filename) => ({
      filename: `/${params.jobID}/${params.modelNumber}_sphere/${filename}`,
      jobId: `${params.jobID}:${params.modelNumber}:${filename}`,
    })),
    pendingUpdates: [],
    completed: 0,
    failed: 0,
    total: params.files.length,
    batchSize: Number(process.env.SPHERE_BATCH_SIZE ?? 4),
    flushDelayMs: Number(process.env.MOLPROBITY_STREAM_FLUSH_MS ?? 150),
    finished: false,
    failedSession: false,
    recordLog: params.recordLog,
  };

  activeSessions.set(key, session);
  session.recordLog?.(`molprobity sphere session queued total=${session.total}`);
  void startBackgroundProcessing(session).catch((error) => {
    session.failedSession = true;
    session.recordLog?.(`molprobity sphere session error=${error instanceof Error ? error.message : String(error)}`);
    session.emitter.emit("error", error);
    activeSessions.delete(session.key);
  });

  return session;
}

export function getSphereSession(key: string) {
  return activeSessions.get(key);
}

export function getSphereSessionSnapshot(key: string): SphereSessionSnapshot | null {
  const session = activeSessions.get(key);
  if (!session) {
    return null;
  }

  return {
    key,
    jobID: session.jobID,
    modelNumber: session.modelNumber,
    completed: session.completed,
    total: session.total,
    failed: session.failed,
    results: getSortedResults(session),
    pending: [...session.pendingUpdates],
    done: session.finished,
    failedSession: session.failedSession,
  };
}

export function getSphereSessionKey(jobID: UUID, modelNumber: string) {
  return getSessionKey(jobID, modelNumber);
}
