import { supabase } from "../config/supabase.js";
import { throwSafeDbError } from "../utils/dbError.js";
// GET /api/v1/calendar
export async function getCalendarEvents(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { data, error } = await supabase
            .from("calendar_events")
            .select("*")
            .eq("user_id", userId)
            .order("start_time", { ascending: true });
        if (error) {
            console.error("Supabase calendar_events query error:", error);
            if (error.code === "P0001" || error.message.includes("does not exist")) {
                res.status(200).json({ success: true, data: [], warning: "SQL tables not created yet in Supabase" });
                return;
            }
            throwSafeDbError("getCalendarEvents", error, "Failed to load calendar events");
        }
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// POST /api/v1/calendar
export async function createCalendarEvent(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { project_id, platform, tone, headline, text, cta, start_time, all_day } = req.body;
        if (project_id) {
            const { data: project, error: projectError } = await supabase
                .from("projects")
                .select("id")
                .eq("id", project_id)
                .eq("user_id", userId)
                .maybeSingle();
            if (projectError)
                throwSafeDbError("lookupProjectOwnership", projectError, "Failed to look up project");
            if (!project) {
                res.status(404).json({ success: false, error: "Project not found" });
                return;
            }
        }
        const { data, error } = await supabase
            .from("calendar_events")
            .insert([
            {
                user_id: userId,
                project_id: project_id || null,
                platform,
                tone,
                headline: headline || "",
                text: text || "",
                cta: cta || "",
                start_time,
                all_day: !!all_day
            }
        ])
            .select()
            .single();
        if (error)
            throwSafeDbError("createCalendarEvent", error, "Failed to create calendar event");
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// PUT /api/v1/calendar/:id
export async function updateCalendarEvent(req, res, next) {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { project_id, platform, tone, headline, text, cta, start_time, all_day } = req.body;
        const updates = {};
        if (project_id !== undefined)
            updates.project_id = project_id || null;
        if (platform !== undefined)
            updates.platform = platform;
        if (tone !== undefined)
            updates.tone = tone;
        if (headline !== undefined)
            updates.headline = headline;
        if (text !== undefined)
            updates.text = text;
        if (cta !== undefined)
            updates.cta = cta;
        if (start_time !== undefined)
            updates.start_time = start_time;
        if (all_day !== undefined)
            updates.all_day = !!all_day;
        const { data, error } = await supabase
            .from("calendar_events")
            .update(updates)
            .eq("id", id)
            .eq("user_id", userId)
            .select()
            .single();
        if (error)
            throwSafeDbError("updateCalendarEvent", error, "Failed to update calendar event");
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// DELETE /api/v1/calendar/:id
export async function deleteCalendarEvent(req, res, next) {
    try {
        const userId = req.user?.id;
        const { id } = req.params;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { error } = await supabase
            .from("calendar_events")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);
        if (error)
            throwSafeDbError("deleteCalendarEvent", error, "Failed to delete calendar event");
        res.status(200).json({ success: true, message: "Calendar event deleted successfully" });
    }
    catch (error) {
        next(error);
    }
}
