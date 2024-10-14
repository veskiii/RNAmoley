import Router from 'express';
import { getJobById, getJobs, createJob, analyzeFragment } from './controller.js';
import { upload } from './utils.js';

const router = Router();

router.get('/', getJobs);
router.post('/', upload.single('rnaFile'), createJob);
router.get('/:id', getJobById);
router.post('/analyzeFragment', analyzeFragment);

export { router };