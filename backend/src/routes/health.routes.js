import express from "express";
import mongoose from "mongoose";

import { redisClient } from "../config/redis.js";

const router = express.Router();


/*
|--------------------------------------------------------------------------
| API Health
|--------------------------------------------------------------------------
|
| GET /api/v1/health
|
| Basic API health check.
|
*/

router.get("/", (req, res) => {

  res.status(200).json({

    success: true,

    data: {
      service: "fair-drop-api",
      status: "healthy",
      timestamp: new Date().toISOString()
    },

    message: "API is healthy"

  });

});


/*
|--------------------------------------------------------------------------
| MongoDB Health
|--------------------------------------------------------------------------
|
| GET /api/v1/health/mongodb
|
*/

router.get("/mongodb", (req, res) => {

  const connected =
    mongoose.connection.readyState === 1;


  res.status(connected ? 200 : 503).json({

    success: connected,

    data: {
      service: "mongodb",

      status: connected
        ? "healthy"
        : "unhealthy"
    },

    message: connected
      ? "MongoDB is healthy"
      : "MongoDB is unavailable"

  });

});


/*
|--------------------------------------------------------------------------
| Redis Health
|--------------------------------------------------------------------------
|
| GET /api/v1/health/redis
|
*/

router.get("/redis", (req, res) => {

  const connected =
    redisClient.isReady;


  res.status(connected ? 200 : 503).json({

    success: connected,

    data: {
      service: "redis",

      status: connected
        ? "healthy"
        : "unhealthy"
    },

    message: connected
      ? "Redis is healthy"
      : "Redis is unavailable"

  });

});


export default router;