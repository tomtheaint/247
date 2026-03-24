import app from "./app";
import { config } from "./config";

app.listen(config.port, () => {
  console.log(`247 API running on http://localhost:${config.port}`);
});
