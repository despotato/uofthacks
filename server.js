require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const morgan = require('morgan');
const connectDB = require('./config/db');
const configurePassport = require('./config/passport');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const { initAmplitude } = require('./config/amplitude');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || 'hack-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN !== 'false';
const AMPLITUDE_API_KEY = process.env.AMPLITUDE_API_KEY;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

async function start() {
  await connectDB(MONGO_URI);

  initAmplitude(AMPLITUDE_API_KEY);

  configurePassport({
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: GOOGLE_CALLBACK_URL,
  });

  const app = express();
  app.use(morgan('dev'));
  app.use(express.json());
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
      store: MongoStore.create({ mongoUrl: MONGO_URI }),
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(
    authRouter({
      allowDevLogin: ALLOW_DEV_LOGIN,
      googleEnabled: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    })
  );
  app.use(
    apiRouter({
      mailConfig: {
        defaultFrom: process.env.MAIL_FROM || 'no-reply@example.com',
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      amplitudeKeyPublic: AMPLITUDE_API_KEY || null,
    })
  );

  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running at ${BASE_URL}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
