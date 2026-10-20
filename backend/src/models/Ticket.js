import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true
    },

    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    status: {
      type: String,
      enum: [
        "AVAILABLE",
        "RESERVED",
        "SOLD"
      ],
      default: "AVAILABLE",
      index: true
    }
  },
  {
    timestamps: true
  }
);

const Ticket = mongoose.model("Ticket", ticketSchema);

export default Ticket;