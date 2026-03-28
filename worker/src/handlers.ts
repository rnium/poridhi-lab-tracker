import { IRequest, json, error } from "itty-router";
import { getModuleLabs, updateModuleLab } from "./services/moduleLabs";

interface Payload {
    labId: string;
    done: boolean;
}

export async function handleGetModuleLabs(req: IRequest, env: Env): Promise<Response> {
    const { moduleId } = req.params;
    if (!moduleId) return error(400, "Module ID is required")
    try {
        const labs = await getModuleLabs(env, moduleId);
        return labs ? json(labs) : error(404, "Module not found");
    } catch {
        return error(500, "Internal Server Error");
    }
}

export async function handleUpdateModuleLab(req: IRequest, env: Env): Promise<Response> {
    const { moduleId } = req.params;
    if (!moduleId) return error(400, "Module ID is required");
    try {
        const { labId, done }: Payload = await req.json();
        if (typeof done !== "boolean" || !labId) return error(400, "Invalid request body");
        await updateModuleLab(env, moduleId, labId, done);
        return json({ success: true });
    } catch {
        return error(500, "Internal Server Error");
    }
}