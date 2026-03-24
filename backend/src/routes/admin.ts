import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { listUsers, updateUserRole, seedTestData } from "../controllers/adminController";

const router = Router();
router.use(authenticate, requireRole("ADMIN"));

router.get("/users", listUsers);
router.patch("/users/:id/role", updateUserRole);
router.post("/seed-test-data", seedTestData);

export default router;
