const nodemailer = require('nodemailer');
let transporterPromise = null;

async function getTransporter(config) {
  if (transporterPromise) return transporterPromise;
  const { host, port, user, pass } = config;
  if (host && port && user && pass) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host,
        port: Number(port),
        auth: { user, pass },
      })
    );
    return transporterPromise;
  }
  transporterPromise = nodemailer.createTestAccount().then((testAccount) =>
    nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  );
  return transporterPromise;
}

async function sendPageEmail({ toEmail, fromEmail, fromName, message }, config) {
  const transporter = await getTransporter(config);
  const mailOptions = {
    from: fromEmail || config.defaultFrom || 'no-reply@example.com',
    to: toEmail,
    subject: `${fromName || 'Someone'} paged you on Live Friends`,
    text: message || 'You have been paged. Reply or hop on the map!',
  };
  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { info, previewUrl };
}

async function sendAdaptiveNotification({
  userEmail,
  userName,
  availability,
  location, // { lat, lon }
  distanceKm,
  timeOfDay,
  previousOccurrences,
  message,
}, config) {
  const transporter = await getTransporter(config);
  const subject = `Heads up${userName ? `, ${userName}` : ''}!`;
  const lines = [
    message || 'A friend activity update just came in.',
    availability !== undefined ? `Availability: ${availability ? 'Available' : 'Hidden'}` : null,
    location ? `Location: ${location.lat?.toFixed?.(4)}, ${location.lon?.toFixed?.(4)}` : null,
    distanceKm !== undefined ? `Distance signal: ${distanceKm.toFixed(2)} km` : null,
    timeOfDay ? `Time bucket: ${timeOfDay}` : null,
    previousOccurrences !== undefined ? `Recent similar events: ${previousOccurrences}` : null,
  ].filter(Boolean);

  const mailOptions = {
    from: config.defaultFrom || 'no-reply@example.com',
    to: userEmail,
    subject,
    text: lines.join('\n'),
  };
  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return { info, previewUrl };
}

module.exports = { sendPageEmail, sendAdaptiveNotification };
