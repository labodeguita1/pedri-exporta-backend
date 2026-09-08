const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER);
}

module.exports = { getTransporter, mailConfigured };
