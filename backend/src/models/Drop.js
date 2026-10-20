import mongoose from "mongoose";

const dropSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    opensAt: {
      type: Date,
      required: true,
      index: true
    },

    closesAt: {
      type: Date,
      required: true,
      index: true
    },

    allocationMethod: {
      type: String,
      enum: [
        "BATCHED_RANDOM"
      ],
      default: "BATCHED_RANDOM"
    },

    status: {
      type: String,
      enum: [
        "SCHEDULED",
        "OPEN",
        "CLOSED",
        "ALLOCATING",
        "COMPLETED",
        "CANCELLED"
      ],
      default: "SCHEDULED",
      index: true
    }
  },
  {
    timestamps: true
  }
);

const Drop = mongoose.model("Drop", dropSchema);

export default Drop;