import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import testRoutes from "./routes/test.routes.js"
import { env } from "./config/env.js";
import userRoutes from "./routes/user.routes.js"
import healthRoutes
  from "./routes/health.routes.js";
import adminTicketRoutes from "./routes/ticket.routes.js";
import {
  notFoundMiddleware
} from "./middleware/not-found-middleware.js";

import adminDropRoutes from "./routes/admin-drop.routes.js";
import dropStatusRoutes from "./routes/drop-status.routes.js";
import allocationRoutes from "./routes/allocation.routes.js";
import dropRoutes from "./routes/drop.routes.js";
import eventRoutes from "./routes/events.routes.js";
import authRoutes from "./routes/auth.routes.js";
import entryRoutes from "./routes/entry.routes.js";
import queueTestRoutes from "./routes/queue-test.routes.js";
import reservationRoutes from "./routes/reservation.routes.js";
import dropStreamRoutes from "./routes/drop-stream.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminMetricsRoutes from "./routes/admin-metrics.routes.js";

import {
  errorMiddleware
} from './middleware/error-middleware.js'
const app = express();


/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(
  helmet()
);


/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| credentials: true
|
| Required for future HTTP-only authentication cookies.
|
*/

app.use(
  cors({

    origin: env.FRONTEND_URL,

    credentials: true

  })
);


/*
|--------------------------------------------------------------------------
| Request Body
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "1mb"
  })
);


app.use(
  express.urlencoded({
    extended: true
  })
);


/*
|--------------------------------------------------------------------------
| Cookie Parser
|--------------------------------------------------------------------------
*/

app.use(
  cookieParser()
);


/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/v1/test",
  testRoutes
);
app.use(
  "/api/v1/health",
  healthRoutes
);

app.use(
  "/api/v1/users",
  userRoutes
);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/drops", dropRoutes);
app.use("/api/v1/tickets", ticketRoutes);
app.use("/api/v1/auth", authRoutes);  
app.use("/api/v1", entryRoutes);
app.use("/api/v1/test/queue", queueTestRoutes);
app.use("/api/v1/admin", allocationRoutes);
app.use("/api/v1", reservationRoutes);
app.use("/api/v1", dropStreamRoutes);
app.use("/api/v1", dropStatusRoutes);
app.use("/api/v1", notificationRoutes);
app.use("/api/v1", adminDropRoutes);
app.use("/api/v1", adminMetricsRoutes);
/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
*/

app.use(
  notFoundMiddleware
);


/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use(
  errorMiddleware
);


export default app;