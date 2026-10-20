import mongoose from "mongoose";
import Notification from "../models/Notification.js";


// ============================================================
// GET MY NOTIFICATIONS
// GET /api/v1/notifications
// ============================================================

export async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.id;

    const page = Math.max(
      parseInt(req.query.page) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit) || 20,
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const filter = {
      userId
    };

    // Optional unread filter
    if (req.query.unread === "true") {
      filter.isRead = false;
    }

    const [notifications, total, unreadCount] =
      await Promise.all([
        Notification.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Notification.countDocuments(filter),

        Notification.countDocuments({
          userId,
          isRead: false
        })
      ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      message: "Notifications fetched successfully"
    });
  } catch (error) {
    next(error);
  }
}


// ============================================================
// MARK NOTIFICATION AS READ
// PATCH /api/v1/notifications/:notificationId/read
// ============================================================

export async function markNotificationAsRead(
  req,
  res,
  next
) {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    if (
      !mongoose.Types.ObjectId.isValid(notificationId)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid notification ID"
        }
      });
    }

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          userId
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        },
        {
          new: true
        }
      ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOTIFICATION_NOT_FOUND",
          message: "Notification not found"
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        notification
      },
      message: "Notification marked as read"
    });
  } catch (error) {
    next(error);
  }
}