import Router from 'express';
import { getJobById, getJobs, createJob, analyzeStructure, downloadJobFiles, getJobCreation, startSimulation, getSimulationStatus } from './controller.js';
import { streamAnalysisProgress } from './controller.js';
import { upload } from './utils.js';
import { createPollingRateLimiter } from './pollingRateLimit.js';

const router = Router();

const parseEnvInt = (rawValue: string | undefined, fallback: number) => {
	const parsed = Number.parseInt(rawValue || '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const statusPollingLimiter = createPollingRateLimiter({
	windowMs: parseEnvInt(process.env.STATUS_POLLING_WINDOW_MS, 1000),
	maxRequests: parseEnvInt(process.env.STATUS_POLLING_MAX_REQUESTS, 3),
});

const streamConnectLimiter = createPollingRateLimiter({
	windowMs: parseEnvInt(process.env.STREAM_CONNECT_WINDOW_MS, 10000),
	maxRequests: parseEnvInt(process.env.STREAM_CONNECT_MAX_REQUESTS, 5),
});

// router.get('/', getJobs);
router.post('/', upload.single('rnaFile'), createJob);
router.get('/:id', getJobCreation);
router.get('/:id/download', downloadJobFiles);
router.get('/:id/:modelNumber', statusPollingLimiter, getJobById);
// router.post('/analyzeFragment', analyzeFragment);
router.post('/analyzeStructure', analyzeStructure);
router.get('/:id/:modelNumber/analysis-stream', streamConnectLimiter, streamAnalysisProgress);
router.post('/simulation/start', startSimulation);
router.get('/:id/simulation', statusPollingLimiter, getSimulationStatus);

export { router };