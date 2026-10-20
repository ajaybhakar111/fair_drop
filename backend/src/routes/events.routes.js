import express from "express";

import {
  createEvent,
  getEvents,
  getEvent,
  updateEvent,
  deleteEvent
} from "../controllers/event.controller.js";

const router = express.Router();

// Create
router.post("/", createEvent);

// List
router.get("/", getEvents);

// Single event
router.get("/:eventId", getEvent);

// Update
router.patch("/:eventId", updateEvent);

// Delete
router.delete("/:eventId", deleteEvent);

export default router;