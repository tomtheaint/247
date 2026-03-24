import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { listEvents, listRecurringEvents, getEvent, createEvent, updateEvent, detachInstance, deleteEvent, deleteAllEvents } from "../controllers/eventController";

const router = Router();
router.use(authenticate);

router.get("/", listEvents);
router.get("/recurring", listRecurringEvents);
router.post("/", createEvent);
router.delete("/", deleteAllEvents);
router.get("/:id", getEvent);
router.patch("/:id", updateEvent);
router.post("/:id/detach-instance", detachInstance);
router.delete("/:id", deleteEvent);

export default router;
