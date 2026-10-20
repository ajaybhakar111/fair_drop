import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    type: {
      type: String,
      enum: [
        "ALLOCATION_SELECTED",
        "ALLOCATION_NOT_SELECTED",
        "RESERVATION_CREATED",
        "RESERVATION_CONFIRMED",
        "RESERVATION_EXPIRED"
      ],
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },

    dropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drop",
      default: null,
      index: true
    },

    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      default: null,
      index: true
    },

    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
      index: true
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true
    },

    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({
  userId: 1,
  isRead: 1,
  createdAt: -1
});

notificationSchema.index({
  userId: 1,
  createdAt: -1
});

const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;