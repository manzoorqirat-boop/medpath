require("dotenv").config();
const express     = require("express");
const cors        = require("cors");
const helmet      = require("helmet");
const morgan      = require("morgan");
const compression = require("compression");
const rateLimit   = require("express-rate-limit");
const logger      = require("./utils/logger");
const { testConnection } = require("./db");
const errorHandler = require("./middleware/errorHandler");
const authRoutes         = require("./routes/auth");
const patientRoutes      = require("./routes/patients");
const testCatalogRoutes  = require("./routes/testCatalog");
const sampleRoutes       = require("./routes/samples");
const billingRoutes      = require("./routes/billing");
const reportRoutes       = require("./routes/reports");
const staffRoutes        = require("./routes/staff");
const notificationRoutes = require("./routes/notifications");
const familyRoutes       = require("./routes/family");
const homeCollectRoutes  = require("./routes/homeCollection");
const dashboardRoutes    = require("./routes/dashboard");
const app  = express();
const PORT = process.env.PORT || 3000;
app.use(helmet());
app.use(compression());
app.use(cors({ origin: "*", methods: ["GET","POST","PUT","PATCH","DELETE"], allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("tiny"));
const globalLimiter = rateLimit({ windowMs: 900000, max: 300 });
const authLimiter = rateLimit({ windowMs: 900000, max: 20 });
app.use(globalLimiter);app.get("/health", async function(req, res) {
  const dbOk = await testConnection();
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "healthy" : "degraded", database: dbOk ? "connected" : "unreachable" });
});
app.get("/", function(req, res) {
  res.json({ message: "MedPath API is running" });
});
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/tests", testCatalogRoutes);
app.use("/api/samples", sampleRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/family", familyRoutes);
app.use("/api/home-collect", homeCollectRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use(function(req, res) { res.status(404).json({ error: "Route not found" }); });
app.use(errorHandler);
async function start() {
  const dbOk = await testConnection();
  if (!dbOk) { logger.error("Cannot connect to database."); process.exit(1); }
  app.listen(PORT, function() { logger.info("MedPath API listening on port " + PORT); });
}
start();

