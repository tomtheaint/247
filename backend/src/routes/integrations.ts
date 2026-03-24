import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listIntegrations,
  googleAuthUrl, googleCallback, googleSync,
  microsoftAuthUrl, microsoftCallback, microsoftSync,
  disconnectIntegration,
} from "../controllers/integrationsController";

const router = Router();

// Callback routes are called by OAuth providers — no auth header (state param carries userId)
router.get("/google/callback", googleCallback as never);
router.get("/microsoft/callback", microsoftCallback as never);

router.use(authenticate);

router.get("/", listIntegrations);
router.get("/google/auth-url", googleAuthUrl);
router.post("/google/sync", googleSync);
router.get("/microsoft/auth-url", microsoftAuthUrl);
router.post("/microsoft/sync", microsoftSync);
router.delete("/:provider", disconnectIntegration);

export default router;
