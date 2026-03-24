import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getMe, updatePreferences } from "../controllers/userController";

const router = Router();
router.use(authenticate);

router.get("/me", getMe);
router.patch("/me", updatePreferences);

export default router;
