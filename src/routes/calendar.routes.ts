import { Router } from "express";
import {
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent
} from "../controllers/calendar.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getCalendarEvents);
router.post("/", createCalendarEvent);
router.put("/:id", updateCalendarEvent);
router.delete("/:id", deleteCalendarEvent);

export default router;
