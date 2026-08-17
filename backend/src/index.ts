import app from "./app";
import { config } from "./config";
import { bootstrapAdmins } from "./bootstrapAdmins";

app.listen(config.port, () => {
  console.log(`247 API running on http://localhost:${config.port}`);
  // After listening, not before: this is a convenience, and the API should not
  // be held off the port waiting for it.
  void bootstrapAdmins();
});
