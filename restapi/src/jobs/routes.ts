import Router from 'express';
import { getJobById, getJobs, createJob, analyzeStructure, downloadJobFiles, getJobCreation, startSimulation, getSimulationStatus } from './controller.js';
import { streamAnalysisProgress } from './controller.js';
import { upload } from './utils.js';

const router = Router();

// router.get('/', getJobs);
router.post('/', upload.single('rnaFile'), createJob);
router.get('/:id', getJobCreation);
router.get('/:id/download', downloadJobFiles);
router.get('/:id/:modelNumber', getJobById);
// router.post('/analyzeFragment', analyzeFragment);
router.post('/analyzeStructure', analyzeStructure);
router.get('/:id/:modelNumber/analysis-stream', streamAnalysisProgress);
router.post('/simulation/start', startSimulation);
router.get('/:id/simulation', getSimulationStatus);

export { router };