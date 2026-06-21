import { Router } from 'express';
import { db } from '../services/db.js';

export const historyRouter = Router();

historyRouter.get('/', (_req, res) => {
  res.json({ evaluations: db.list() });
});
