import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    description: {
      type: String,
      default: "",
      maxlength: 2000
    },

    imageUrl: {
      type: String,
      default: ""
    },

    venue: {
      type: String,
      required: true,
      trim: true
    },

    date: {
      type: String,
      required: true
    },

    startTime: {
      type: String,
      required: true
    },

    totalTickets: {
      type: Number,
      required: true,
      min: 1
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED"
      ],
      default: "DRAFT",
      index: true
    }
  },
  {
    timestamps: true
  }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;