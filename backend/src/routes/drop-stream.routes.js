import { Router } from "express";

import { streamDrop } from "../controllers/drop-stream.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/drops/:dropId/stream",
  requireAuth,
  streamDrop
);

export default router;