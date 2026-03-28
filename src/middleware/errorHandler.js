const logger = require("../utils/logger");

module.exports = function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} → ${err.message}`);
  if (err.code === "23505") {
    return res.status(409).json({ error: "Duplicate entry: " + (err.detail || "record already exists") });
  }
  if (err.code === "23503") {
    return res.status(400).json({ error: "Referenced record not found" });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status < 500 ? err.message : "Internal server error",
  });
};
