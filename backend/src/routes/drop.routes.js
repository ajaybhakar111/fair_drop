import express from "express";

import {
  createDrop,
  getDrop,
  updateDrop,
  startDrop,
  closeDrop
} from "../controllers/drop.controller.js";

const router = express.Router();

router.post("/", createDrop);

router.get("/:dropId", getDrop);

router.patch("/:dropId", updateDrop);

router.post("/:dropId/start", startDrop);

router.post("/:dropId/close", closeDrop);

export default router;