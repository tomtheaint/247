import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

describe("JWT utilities", () => {
  const payload = { id: "user_1", email: "test@test.com" };

  it("signs and verifies an access token", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
  });

  it("signs and verifies a refresh token", () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.id).toBe(payload.id);
  });

  it("throws on invalid token", () => {
    expect(() => verifyAccessToken("bad.token.value")).toThrow();
  });
});
