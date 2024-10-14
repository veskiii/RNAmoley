import Router from 'express';
import { getJobById, getJobs, createJob, analyzeFragment, getJobResult } from './controller.js';
import { upload } from './utils.js';

const router = Router();

router.get('/', getJobs);
router.post('/', upload.single('rnaFile'), createJob);
router.get('/:id', getJobById);
router.get('/:id/result', getJobResult);
router.post('/analyzeFragment', analyzeFragment);

export { router };