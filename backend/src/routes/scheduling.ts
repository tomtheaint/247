import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { scheduleGoalSessions, getConflicts, resolveConflicts, optimizeSchedule, snoozeEvent, takeDayOff } from "../controllers/schedulingController";

const router = Router();
router.use(authenticate);

router.post("/goal", scheduleGoalSessions);
router.get("/conflicts", getConflicts);
router.post("/resolve-conflicts", resolveConflicts);
router.post("/optimize", optimizeSchedule);
router.post("/snooze/:id", snoozeEvent);
router.post("/take-day-off", takeDayOff);

export default router;
