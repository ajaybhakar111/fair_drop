import express from "express";

import {
  createUser,
  getUser
} from "../controllers/user.controller.js";

const router = express.Router();


/*
|--------------------------------------------------------------------------
| Create User
|--------------------------------------------------------------------------
|
| POST /api/v1/users
|
*/

router.post(
  "/",
  createUser
);


/*
|--------------------------------------------------------------------------
| Get User
|--------------------------------------------------------------------------
|
| GET /api/v1/users/:userId
|
*/

router.get(
  "/:userId",
  getUser
);


export default router;