import Router from 'express';
import { getJobById, getJobs, createJob, analyzeFragment, analyzeStructure } from './controller.js';
import { upload } from './utils.js';

const router = Router();

router.get('/', getJobs);
router.post('/', upload.single('rnaFile'), createJob);
router.get('/:id', getJobById);
router.get('/:id/:modelNumber', getJobById);
router.post('/analyzeFragment', analyzeFragment);
router.post('/analyzeStructure', analyzeStructure);

export { router };