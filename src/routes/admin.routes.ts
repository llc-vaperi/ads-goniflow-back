import { Router } from "express";
import {
    createAdminMember,
    getAdminAuditLog,
    getAdminMe,
    getAdminMembers,
    patchAdminMember,
} from "../controllers/admin-members.controller.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import {
    addAdminMemberSchema,
    updateAdminMemberSchema,
} from "../validators/admin-members.schema.js";
import {
    createCreditAdjustment,
    getAdminCreditUsers,
} from "../controllers/admin-credits.controller.js";
import { adjustUserCreditsSchema } from "../validators/admin-credits.schema.js";

const router = Router();
const allAdminRoles = ["owner", "admin", "viewer"] as const;

router.use(requireAuth);
router.get("/me", requireAdmin(allAdminRoles), getAdminMe);
router.get("/members", requireAdmin(allAdminRoles), getAdminMembers);
router.get("/users", requireAdmin(allAdminRoles), getAdminCreditUsers);
router.get(
    "/audit",
    requireAdmin(["owner", "admin"]),
    getAdminAuditLog,
);
router.post(
    "/members",
    requireAdmin(["owner"]),
    validateBody(addAdminMemberSchema),
    createAdminMember,
);
router.patch(
    "/members/:userId",
    requireAdmin(["owner"]),
    validateBody(updateAdminMemberSchema),
    patchAdminMember,
);
router.post(
    "/users/:userId/credits",
    requireAdmin(["owner", "admin"]),
    validateBody(adjustUserCreditsSchema),
    createCreditAdjustment,
);

export default router;
