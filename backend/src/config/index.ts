export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "dev_jwt_secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret",
  jwtExpiresIn: "15m",
  jwtRefreshExpiresIn: "7d",
  bcryptRounds: 10,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};
