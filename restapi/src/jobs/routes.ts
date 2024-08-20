import Router from 'express';
import { getJobById, getJobs, createJob } from './controller.js';
import { upload } from './utils.js';

const router = Router();

router.get('/', getJobs);
router.post('/', upload.single('rnaFile'), createJob);
router.get('/:id', getJobById);

export { router };