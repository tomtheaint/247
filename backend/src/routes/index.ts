import { Router } from "express";
import authRoutes from "./auth";
import goalRoutes from "./goals";
import eventRoutes from "./events";
import trackRoutes from "./tracks";
import schedulingRoutes from "./scheduling";
import integrationRoutes from "./integrations";
import userRoutes from "./users";
import adminRoutes from "./admin";
import reviewerRoutes from "./reviewer";

const router = Router();

router.use("/auth", authRoutes);
router.use("/goals", goalRoutes);
router.use("/events", eventRoutes);
router.use("/tracks", trackRoutes);
router.use("/scheduling", schedulingRoutes);
router.use("/integrations", integrationRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/reviewer", reviewerRoutes);

router.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));

export default router;
