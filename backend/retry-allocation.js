import { Queue } from "bullmq";
import { env } from "./src/config/env.js";

const dropId = "6ac102ad05ca2e533155b257";

const allocationId =
  "6ac1166636574641f794df95";

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT
};

const queue = new Queue(
  "fair-drop-allocation",
  {
    connection
  }
);

const oldJobId = `allocation-${dropId}`;

const oldJob = await queue.getJob(
  oldJobId
);

if (oldJob) {

  console.log(
    `🗑️ Removing old job: ${oldJobId}`
  );

  try {
    await oldJob.remove();

    console.log(
      "✅ Old job removed"
    );

  } catch (error) {

    console.error(
      "❌ Could not remove old job:",
      error.message
    );
  }
}

const newJob = await queue.add(
  "allocate-drop",
  {
    dropId,
    allocationId
  },
  {
    jobId: oldJobId
  }
);

console.log("");
console.log(
  "================================="
);

console.log(
  "🚀 Fresh allocation job created"
);

console.log(
  `Job ID: ${newJob.id}`
);

console.log(
  `Drop ID: ${dropId}`
);

console.log(
  `Allocation ID: ${allocationId}`
);

console.log(
  "================================="
);

await queue.close();