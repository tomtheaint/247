import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { config } from "../config";
import { JwtPayload } from "../types";

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

/**
 * `jti` is not decoration: without it these tokens collide.
 *
 * The payload was {id, email} plus the `iat` and `exp` jsonwebtoken adds, and
 * both of those are whole seconds. Two tokens issued to one account inside the
 * same second were therefore byte-identical — and RefreshToken.token is unique,
 * so the second insert threw and the request became a 500.
 *
 * Registering and then logging in is exactly that sequence, which made it a
 * reliable failure on a fresh account rather than a rare one. A random id per
 * token also means a refresh token is no longer a pure function of the account
 * and the clock.
 */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload, jti: randomUUID() }, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
}
