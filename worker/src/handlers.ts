import { IRequest, json, error } from "itty-router";
import { getModuleLabs, updateModuleLab } from "./services/moduleLabs";
import { syncModuleCompletion } from "./utils";
import { getCourseModules } from "./services/course";

interface Payload {
    courseId: string;
    labId: string;
    done: boolean;
}

export async function handleGetCourseModules(req: IRequest, env: Env): Promise<Response> {
    const { courseId } = req.params;
    if (!courseId) return error(400, "Course ID is required")
    try {
        const modules = await getCourseModules(env, courseId);
        return modules ? json(modules) : error(404, "Course not found");
    } catch {
        return error(500, "Internal Server Error");
    }
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
        const { courseId, labId, done }: Payload = await req.json();
        if (typeof done !== "boolean" || !courseId || !labId) {
            return error(400, "courseId, labId and done(boolean) are required in the payload");
        }
        const updated = await updateModuleLab(env, moduleId, labId, done);
        await syncModuleCompletion(env, courseId, moduleId, updated);
        return json({ success: true });
    } catch {
        return error(500, "Internal Server Error");
    }
}