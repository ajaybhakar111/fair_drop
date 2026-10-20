import express from "express";

import {
  getDropStatus,
  getDropResult
} from "../controllers/drop-status.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();


/*
============================================================
DROP STATUS
============================================================
*/

router.get(
  "/drops/:dropId/status",
  requireAuth,
  getDropStatus
);


/*
============================================================
DROP RESULT
============================================================
*/

router.get(
  "/drops/:dropId/result",
  requireAuth,
  getDropResult
);


export default router;