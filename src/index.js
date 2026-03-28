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
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : "*",
  methods: ["GET","POST","PUT","PATCH","DELETE"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", {
  stream: { write: function(msg){ logger.info(msg.trim()); } }
}));

const globalLimiter = rateLimit({ windowMs: 15*60*1000, max: 300 });
const authLimiter   = rateLimit({ windowMs: 15*60*1000, max: 20 });
app.use(globalLimiter);

app.get("/health", async function(req, res) {
  const db​​​​​​​​​​​​​​​​
