import User from "../models/User.js";

export async function createUser(req, res, next) {
  try {
    const {
      name,
      email,
      passwordHash
    } = req.body;

    if (!name || !email || !passwordHash) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "name, email and passwordHash are required"
        }
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase()
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: "USER_ALREADY_EXISTS",
          message: "User with this email already exists"
        }
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        }
      },
      message: "User created successfully"
    });

  } catch (error) {
    next(error);
  }
}


export async function getUser(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found"
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      },
      message: "User fetched successfully"
    });

  } catch (error) {
    next(error);
  }
}