import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";
import { uploadBufferToStorage } from "../services/storage.service.js";
import { getTextProvider, getImageProvider, getTextProviderName, getImageProviderName } from "../services/ai/index.js";

import { randomUUID } from 'node:crypto';
import {
    getModeImageProvider,
    getModeImageProviderName,
    getModeTextProvider,
    getModeTextProviderName,
} from '../services/ai/index.js';
import { GENERATION_CREDIT_COSTS } from '../config/credits.js';
import {
    consumeCreditReservation,
    refundCreditReservation,
    reserveCredits,
} from '../services/credits.service.js';

async function loadProjectParams(
    userId: string,
    projectId: string,
    body: {
        platform: string;
        tone: string;
        textPrompt?: string;
        imagePrompt?: string;
        mode?: 'standard' | 'premium';
    }
) {
    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("name, description, link")
        .eq("id", projectId)
        .eq("user_id", userId)
        .single();

    if (projectError || !project) {
        return null;
    }

    return {
        platform: body.platform,
        tone: body.tone,
        textPrompt: body.textPrompt,
        imagePrompt: body.imagePrompt,
        projectName: project.name,
        projectDescription: project.description,
        projectLink: project.link,
    };
}

export async function generateAdText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const params = await loadProjectParams(userId, String(projectId), req.body);
        if (!params) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        const mode = req.body.mode === 'premium' ? 'premium' : 'standard';
        const creditCost = GENERATION_CREDIT_COSTS.text;
        const reservation = await reserveCredits(
            userId,
            creditCost,
            'generate_text',
            randomUUID(),
            { projectId, mode, platform: params.platform },
        );
        const logContext = `[generate-text] provider=${getModeTextProviderName(mode)} projectId=${projectId} platform=${params.platform} tone=${params.tone}`;

        try {
            const textResult = await getModeTextProvider(mode).generateText(params);
            await consumeCreditReservation(userId, reservation.reservationId);
            res.status(200).json({ success: true, data: textResult });
        } catch (textError) {
            try {
                await refundCreditReservation(
                    userId,
                    reservation.reservationId,
                    'text_generation_failed',
                );
            } catch (refundError) {
                console.error(`${logContext} — CREDIT refund failed:`, refundError);
            }
            console.error(`${logContext} — TEXT generation failed:`, textError);
            throw textError;
        }
    } catch (error) {
        next(error);
    }
}

export async function generateAdImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.user?.id;
        const { projectId } = req.params;

        if (!userId) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }

        const params = await loadProjectParams(userId, String(projectId), req.body);
        if (!params) {
            res.status(404).json({ success: false, error: "Project not found" });
            return;
        }

        const mode = req.body.mode === 'premium' ? 'premium' : 'standard';
        const creditCost = mode === 'premium'
            ? GENERATION_CREDIT_COSTS.premiumImage
            : GENERATION_CREDIT_COSTS.standardImage;
        const reservation = await reserveCredits(
            userId,
            creditCost,
            'generate_image',
            randomUUID(),
            { projectId, mode, platform: params.platform },
        );
        const logContext = `[generate-image] provider=${getModeImageProviderName(mode)} projectId=${projectId} platform=${params.platform} tone=${params.tone}`;

        let imageUrl: string | null = null;
        try {
            const image = await getModeImageProvider(mode).generateImage(params);
            if (image) {
                imageUrl = "url" in image
                    ? image.url
                    : await uploadBufferToStorage(userId, image.buffer, image.mimeType, image.extension);
            } else {
                throw new Error("Image generation returned an empty result");
            }
        } catch (imageError) {
            try {
                await refundCreditReservation(
                    userId,
                    reservation.reservationId,
                    'image_generation_failed',
                );
            } catch (refundError) {
                console.error(`${logContext} — CREDIT refund failed:`, refundError);
            }
            console.error(`${logContext} — IMAGE generation failed:`, imageError);
            throw imageError;
        }

        try {
            await consumeCreditReservation(userId, reservation.reservationId);
        } catch (billingError) {
            try {
                await refundCreditReservation(
                    userId,
                    reservation.reservationId,
                    'billing_finalize_failed',
                );
            } catch (refundError) {
                console.error(`${logContext} — CREDIT refund failed:`, refundError);
            }
            throw billingError;
        }

        res.status(200).json({ success: true, data: { imageUrl } });
    } catch (error) {
        next(error);
    }
}
