import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    // User who was selected in the allocation
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // Drop from which the user was selected
    dropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drop",
      required: true,
      index: true
    },

    // Original entry that won the allocation
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Entry",
      required: true,
      unique: true,
      index: true
    },

    // Ticket temporarily assigned to this user
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      unique: true,
      index: true
    },

    // Reservation lifecycle
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "CONFIRMED",
        "EXPIRED",
        "CANCELLED"
      ],
      default: "ACTIVE",
      index: true
    },

    // Time until which the user can confirm
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },

    // Set when reservation is successfully confirmed
    confirmedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent one user from having multiple reservations
// for the same drop.
reservationSchema.index(
  { userId: 1, dropId: 1 },
  { unique: true }
);

const Reservation = mongoose.model(
  "Reservation",
  reservationSchema
);

export default Reservation;