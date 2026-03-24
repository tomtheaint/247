import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { listGoals, getGoal, createGoal, updateGoal, deleteGoal, addProgress, listPublicGoals } from "../controllers/goalController";
import { listMilestones, createMilestone, updateMilestone, deleteMilestone } from "../controllers/milestoneController";

const router = Router();
router.use(authenticate);

router.get("/community", listPublicGoals);
router.get("/", listGoals);
router.post("/", createGoal);
router.get("/:id", getGoal);
router.patch("/:id", updateGoal);
router.delete("/:id", deleteGoal);
router.post("/:id/progress", addProgress);

// Milestones
router.get("/:goalId/milestones", listMilestones);
router.post("/:goalId/milestones", createMilestone);
router.patch("/milestones/:id", updateMilestone);
router.delete("/milestones/:id", deleteMilestone);

export default router;
