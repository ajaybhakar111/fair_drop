import mongoose from "mongoose";

const allocationSchema = new mongoose.Schema(
    {
        // Drop being allocated
        dropId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Drop",
            required: true,
            unique: true,
            index: true
        },

        // Current allocation state
        status: {
            type: String,
            enum: [
                "PENDING",
                "PROCESSING",
                "COMPLETED",
                "FAILED"
            ],
            default: "PENDING",
            index: true
        },

        // Number of eligible entries when allocation started
        totalEntries: {
            type: Number,
            default: 0,
            min: 0
        },

        // Number of tickets available for this allocation
        totalTickets: {
            type: Number,
            default: 0,
            min: 0
        },

        // Number of entries processed by worker
        processedCount: {
            type: Number,
            default: 0,
            min: 0
        },

        // Number of entries selected
        selectedCount: {
            type: Number,
            default: 0,
            min: 0
        },

        // When allocation actually started
        startedAt: {
            type: Date,
            default: null
        },

        // When allocation finished successfully
        completedAt: {
            type: Date,
            default: null
        },

        // When allocation failed
        failedAt: {
            type: Date,
            default: null
        },

        // Useful for debugging failed worker jobs
        errorMessage: {
            type: String,
            default: null
        },
        allocationSeed: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
    },
    {
        timestamps: true
    }
);

const Allocation = mongoose.model(
    "Allocation",
    allocationSchema
);

export default Allocation;