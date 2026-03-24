import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { listAllGoals, promoteGoalToTrack, deleteGoalAsReviewer } from "../controllers/reviewerController";

const router = Router();
router.use(authenticate, requireRole("ADMIN", "REVIEWER"));

router.get("/goals", listAllGoals);
router.post("/goals/:goalId/promote", promoteGoalToTrack);
router.delete("/goals/:goalId", deleteGoalAsReviewer);

export default router;
