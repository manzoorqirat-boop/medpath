require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const logger = require("./utils/logger");
const { testConnection } = require("./db");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);
app.use(rateLimit({ windowMs: 900000, max: 300 }));

app.use(express.static(require("path").join(__dirname, "../public")));

app.get("/", function(req, res) {
  res.sendFile(require("path").join(__dirname, "../public/index.html"));
});

app.get("/health", async function(req, res) {
  const dbOk = await testConnection();
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "healthy" : "degraded" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/tests", require("./routes/testCatalog"));
app.use("/api/samples", require("./routes/samples"));
app.use("/api/billing", require("./routes/billing"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/staff", require("./routes/staff"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/family", require("./routes/family"));
app.use("/api/home-collect", require("./routes/homeCollection"));
app.use("/api/dashboard", require("./routes/dashboard"));

app.use(function(req, res) {
  res.status(404).json({ error: "Not found" });
});
app.use(errorHandler);

async function start() {
  const ok = await testConnection();
  if (!ok) { process.exit(1); }
  app.listen(PORT, function() {
    logger.info("Listening on port " + PORT);
  });
}
start();