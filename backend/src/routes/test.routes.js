import express from "express";

import User from "../models/User.js";
import Event from "../models/Event.js";
import Drop from "../models/Drop.js";
import Ticket from "../models/Ticket.js";
import Entry from "../models/Entry.js";
import Reservation from "../models/Reservation.js";
import Allocation from "../models/Allocation.js";

const router = express.Router();


router.get("/database", async (req, res, next) => {

  try {

    const counts = {
      users: await User.countDocuments(),
      events: await Event.countDocuments(),
      drops: await Drop.countDocuments(),
      tickets: await Ticket.countDocuments(),
      entries: await Entry.countDocuments(),
      reservations: await Reservation.countDocuments(),
      allocations: await Allocation.countDocuments(),
    };


    res.status(200).json({

      success: true,

      data: counts,

      message: "Database models are working"

    });

  } catch (error) {

    next(error);

  }

});


export default router;