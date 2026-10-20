export function errorMiddleware(err, req, res, next) {
  console.error("\n========== INTERNAL ERROR ==========");
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("====================================\n");

  return res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_ERROR",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Internal server error",
    },
  });
}