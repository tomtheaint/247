import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  listPublicTracks, getTrack, createTrack, updateTrack,
  deleteTrack, adoptTrack, reviewTrack, myTracks,
  reactToTrack, getMyReaction, adminUpdateTrack, adminDeleteTrack,
  setTrackGoals,
} from "../controllers/trackController";
import { requireRole } from "../middleware/auth";

const router = Router();
router.use(authenticate);

router.get("/", listPublicTracks);
router.get("/mine", myTracks);
router.post("/", createTrack);
router.get("/:id", getTrack);
router.patch("/:id", updateTrack);
router.delete("/:id", deleteTrack);
router.post("/:id/adopt", adoptTrack);
router.post("/:id/review", reviewTrack);
router.post("/:id/react", reactToTrack);
router.get("/:id/my-reaction", getMyReaction);
router.put("/:id/goals", setTrackGoals);

// Reviewer/Admin management
router.patch("/:id/admin", requireRole("ADMIN", "REVIEWER"), adminUpdateTrack);
router.delete("/:id/admin", requireRole("ADMIN", "REVIEWER"), adminDeleteTrack);

export default router;
