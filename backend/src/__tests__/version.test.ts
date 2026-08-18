/**
 * The stamp the browser reads to know whether its page is still current.
 *
 * The part with a rule in it is the fallback: running from source is not a
 * build, and a server that invented a version there would look permanently
 * stale to every tab watching it — which is worse than saying "dev" and being
 * ignored.
 */
import { readVersion } from "../routes/version";

describe("the version stamp", () => {
  it("says dev when there is no build to describe", () => {
    // The tests run from source, where the frontend build has written nothing.
    const stamp = readVersion();
    expect(stamp.sha).toBe("dev");
    expect(stamp.builtAt).toBeNull();
  });

  it("gives the same answer every time, since a build cannot change under it", () => {
    expect(readVersion()).toEqual(readVersion());
  });
});
