import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { findUserByEmail, createUser, isEmailInvited } from "./storage";

passport.serializeUser((user: any, done) => {
  done(null, user.email);
});

passport.deserializeUser(async (email: string, done) => {
  try {
    const user = await findUserByEmail(email);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/auth/callback",
      scope: ["profile", "email"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(null, false, { message: "No email found in Google profile" });
        }

        // Check invite list
        const invited = await isEmailInvited(email);
        if (!invited) {
          // Check if user already exists (previously invited/approved)
          const existing = await findUserByEmail(email);
          if (!existing) {
            return done(null, false, {
              message: "You are not on the invite list. Please request access.",
            });
          }
        }

        // Find or create user
        let user = await findUserByEmail(email);
        if (!user) {
          user = await createUser({
            email,
            firstName: profile.name?.givenName ?? null,
            lastName: profile.name?.familyName ?? null,
            profileImageUrl: profile.photos?.[0]?.value ?? null,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

export default passport;
