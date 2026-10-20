import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    dropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drop",
      required: true
    },

    status: {
      type: String,
      enum: [
        "ELIGIBLE",
        "SELECTED",
        "NOT_SELECTED"
      ],
      default: "ELIGIBLE",
      index: true
    },

    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);


/*
|--------------------------------------------------------------------------
| FAIRNESS CONSTRAINT
|--------------------------------------------------------------------------
|
| One user can have only ONE entry
| for one drop.
|
| Example:
|
| user A + drop 1 = allowed
| user A + drop 1 = rejected
|
| This prevents:
|
| 1 request      → 1 entry
| 1000 requests  → still 1 entry
|
*/

entrySchema.index(
  {
    userId: 1,
    dropId: 1
  },
  {
    unique: true
  }
);


const Entry = mongoose.model(
  "Entry",
  entrySchema
);

export default Entry;