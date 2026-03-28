const nodemailer = require("nodemailer");
const logger     = require("./logger");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER) {
    logger.warn("SMTP not configured – email skipped");
    return false;
  }
  try {
    await transporter.sendMail({
      from: `"MedPath Lab" <${process.env.SMTP_USER}>`,
      to, subject, html, text,
    });
    return true;
  } catch (err) {
    logger.error("Email send failed:", err.message);
    return false;
  }
}

async function sendSMS({ to, message }) {
  if (!process.env.SMS_API_KEY) {
    logger.warn("SMS not configured – skipped");
    return false;
  }
  try {
    const phone = to.replace("+91","").replace("+","");
    const url = "https://www.fast2sms.com/dev/bulkV2?authorization="+process.env.SMS_API_KEY+"&route=q&message="+encodeURIComponent(message)+"&flash=0&numbers="+phone;
    const res = await fetch(url);
    const data = await res.json();
    if(data.return) {
      logger.info("SMS sent to "+to);
      return true;
    }
    logger.error("SMS failed:", data.message);
    return false;
  } catch (err) {
    logger.error("SMS send failed:", err.message);
    return false;
  }
}

async function notifyReportReady({ name, phone, email, sampleNo, testNames }) {
  const msg = `MedPath: Hi ${name}, your report for ${testNames.join(", ")} (${sampleNo}) is ready.`;
  await sendSMS({ to: phone, message: msg });
  await sendEmail({ to: email, subject: "Your Lab Report is Ready – MedPath", html: `<p>Dear <b>${name}</b>, your report is ready.</p>` });
}

async function notifyPaymentSuccess({ name, phone, email, invoiceNo, amount }) {
  const msg = `MedPath: Payment of Rs.${amount} received for invoice ${invoiceNo}.`;
  await sendSMS({ to: phone, message: msg });
  await sendEmail({ to: email, subject: `Payment Confirmed – ${invoiceNo}`, html: `<p>Payment of ₹${amount} received.</p>` });
}

async function notifyOTP({ phone, otp }) {
  const msg = `MedPath OTP: ${otp} is your login code. Valid for 10 minutes.`;
  await sendSMS({ to: phone, message: msg });
}

async function notifyHomeCollection({ name, phone, email, date, slot, address }) {
  const msg = `MedPath: Home collection confirmed for ${date} at ${slot}. Address: ${address}`;
  await sendSMS({ to: phone, message: msg });
  await sendEmail({ to: email, subject: "Home Collection Scheduled – MedPath", html: `<p>Collection on ${date} at ${slot}.</p>` });
}

module.exports = { sendEmail, sendSMS, notifyReportReady, notifyPaymentSuccess, notifyOTP, notifyHomeCollection };
