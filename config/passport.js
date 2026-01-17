const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

function configurePassport({ googleClientId, googleClientSecret, googleCallbackUrl }) {
  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: googleCallbackUrl,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('Google account missing email'));
            }
            let user = await User.findOne({ googleId: profile.id });
            if (!user) {
              user = await User.findOneAndUpdate(
                { email },
                { googleId: profile.id, name: profile.displayName || profile.name?.givenName || email },
                { new: true }
              );
            }
            if (!user) {
              user = await User.create({
                googleId: profile.id,
                email,
                name: profile.displayName || profile.name?.givenName || email,
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

module.exports = configurePassport;
