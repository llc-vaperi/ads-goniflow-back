import { supabase } from "../config/supabase.js";
import { throwSafeDbError } from "../utils/dbError.js";
// GET /api/v1/projects
export async function getProjects(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized: Missing user session" });
            return;
        }
        const { data, error } = await supabase
            .from("projects")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        // If the table doesn't exist yet, return empty array to prevent crashing the dev flow
        if (error) {
            console.error("Supabase projects query error:", error);
            if (error.code === "P0001" || error.message.includes("does not exist")) {
                res.status(200).json({ success: true, data: [], warning: "SQL tables not created yet in Supabase" });
                return;
            }
            throwSafeDbError("getProjects", error, "Failed to load projects");
        }
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// POST /api/v1/projects
export async function createProject(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { name, link, description, logo_url } = req.body;
        const { data, error } = await supabase
            .from("projects")
            .insert([
            {
                user_id: userId,
                name,
                link: link || "",
                description: description || "",
                logo_url: logo_url || ""
            }
        ])
            .select()
            .single();
        if (error)
            throwSafeDbError("createProject", error, "Failed to create project");
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// DELETE /api/v1/projects/:id
export async function deleteProject(req, res, next) {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { error } = await supabase
            .from("projects")
            .delete()
            .eq("id", projectId)
            .eq("user_id", userId);
        if (error)
            throwSafeDbError("deleteProject", error, "Failed to delete project");
        res.status(200).json({ success: true, message: "Project deleted successfully" });
    }
    catch (error) {
        next(error);
    }
}
// PUT /api/v1/projects/:id
export async function updateProject(req, res, next) {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { name, link, description, logo_url } = req.body;
        const { data, error } = await supabase
            .from("projects")
            .update({
            name,
            link: link || "",
            description: description || "",
            logo_url: logo_url || ""
        })
            .eq("id", projectId)
            .eq("user_id", userId)
            .select()
            .single();
        if (error)
            throwSafeDbError("updateProject", error, "Failed to update project");
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// GET /api/v1/projects/:projectId/ads
export async function getSavedAds(req, res, next) {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .eq("user_id", userId)
            .maybeSingle();
        if (projectError)
            throwSafeDbError("lookupProjectOwnership", projectError, "Failed to look up project");
        if (!project) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }
        const { data, error } = await supabase
            .from("saved_ads")
            .select("*")
            .eq("project_id", projectId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
        if (error) {
            console.error("Supabase saved_ads query error:", error);
            if (error.code === "P0001" || error.message.includes("does not exist")) {
                res.status(200).json({ success: true, data: [] });
                return;
            }
            throwSafeDbError("getSavedAds", error, "Failed to load saved ads");
        }
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// POST /api/v1/projects/:projectId/ads
export async function saveAd(req, res, next) {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { platform, tone, headline, text, cta, image_url } = req.body;
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .eq("user_id", userId)
            .maybeSingle();
        if (projectError)
            throwSafeDbError("lookupProjectOwnership", projectError, "Failed to look up project");
        if (!project) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }
        const { data, error } = await supabase
            .from("saved_ads")
            .insert([
            {
                project_id: projectId,
                user_id: userId,
                platform,
                tone,
                headline: headline || "",
                text,
                cta: cta || "",
                image_url: image_url || ""
            }
        ])
            .select()
            .single();
        if (error)
            throwSafeDbError("saveAd", error, "Failed to save ad");
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        next(error);
    }
}
// DELETE /api/v1/projects/:projectId/ads/:adId
export async function deleteSavedAd(req, res, next) {
    try {
        const userId = req.user?.id;
        const { adId } = req.params;
        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const { error } = await supabase
            .from("saved_ads")
            .delete()
            .eq("id", adId)
            .eq("user_id", userId);
        if (error)
            throwSafeDbError("deleteSavedAd", error, "Failed to delete saved ad");
        res.status(200).json({ success: true, message: "Saved ad deleted successfully" });
    }
    catch (error) {
        next(error);
    }
}
