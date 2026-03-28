require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
const { testConnection } = require("./db");
const errorHandler = require("./middleware/errorHandler");
const app = express();
const PORT = process.env.PORT || 3000;
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));
app.get("/health", async function(req, res) {
  const ok = await testConnection();
  res.status(ok?200:503).json({ status: ok?"healthy":"degraded" });
});
app.get("/test", function(req, res) {
  res.json({ cwd: process.cwd(), exists: fs.existsSync(path.join(publicDir,"index.html")) });
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
app.get("*", function(req, res) {
  res.sendFile(path.join(publicDir, "index.html"));
});
app.use(errorHandler);
async function start() {
  const ok = await testConnection();
  if (!ok) { process.exit(1); }
  app.listen(PORT, function() {
    console.log("Listening on port " + PORT);
  });
}
start();