import Router from 'express';
import { getJobs } from './controller.js';

const router = Router();

router.get('/', getJobs);

export { router };