const { auditLog } = require("../routes/auth");

// Middleware to auto-log important API actions
function auditMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    // Auto-audit key actions
    if (req.user && res.statusCode < 400) {
      const method = req.method;
      const path   = req.path;
      const ip     = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection?.remoteAddress;

      // Sample status changes
      if (method === "PATCH" && path.includes("/status")) {
        auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
          action:"SAMPLE_STATUS_CHANGED", category:"samples",
          targetId:req.params.id, newValue:{ status:req.body.status }, ip });
      }
      // Report signed
      if (method === "PATCH" && path.includes("/sign")) {
        auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
          action:"REPORT_SIGNED", category:"reports", targetId:req.params.reportId, ip });
      }
      // Results saved
      if (method === "POST" && path.includes("/reports/sample")) {
        auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
          action:"RESULTS_SAVED", category:"reports",
          targetId:req.params.sampleId, targetName:"Sample "+req.params.sampleId, ip });
      }
    }
    return originalJson(data);
  };
  next();
}

module.exports = auditMiddleware;