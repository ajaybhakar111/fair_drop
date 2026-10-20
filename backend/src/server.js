import app from "./app.js";

import { env } from "./config/env.js";

import {
  connectMongoDB
} from "./config/mongodb.js";

import {
  connectRedis
} from "./config/redis.js";


async function startServer() {

  try {

    console.log(
      "🚀 Starting Fair Drop backend..."
    );


    /*
    |--------------------------------------------------------------------------
    | MongoDB
    |--------------------------------------------------------------------------
    */

    await connectMongoDB();


    /*
    |--------------------------------------------------------------------------
    | Redis
    |--------------------------------------------------------------------------
    */

    await connectRedis();


    /*
    |--------------------------------------------------------------------------
    | Express Server
    |--------------------------------------------------------------------------
    */

    app.listen(
      env.PORT,
      () => {

        console.log(
          `🚀 Fair Drop API running on http://localhost:${env.PORT}`
        );

        console.log(
          `❤️ Health endpoint: http://localhost:${env.PORT}/api/v1/health`
        );

      }
    );

  } catch (error) {

    console.error(
      "❌ Failed to start Fair Drop backend"
    );

    console.error(error);

    process.exit(1);

  }

}


startServer();