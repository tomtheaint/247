export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "dev_jwt_secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret",
  jwtExpiresIn: "15m",
  jwtRefreshExpiresIn: "7d",
  bcryptRounds: 10,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  /**
   * Who is an administrator, by email.
   *
   * There was no way to make the first one. Registration always creates a USER,
   * and the route that changes a role is itself behind requireRole("ADMIN") —
   * so on a fresh database the admin pages were unreachable by anybody, for
   * ever, with no error to say why.
   *
   * Kept in the environment rather than the database on purpose: it is a fact
   * about the deployment, it survives the database being rebuilt, and it cannot
   * be granted by anyone who only has the app.
   */
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
};
