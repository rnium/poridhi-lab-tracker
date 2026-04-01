import { IRequest, json, error } from "itty-router";
import { getModuleLabs, updateModuleLabs } from "./services/moduleLabs";
import { syncModuleCompletion, mapCourseModuleStatus } from "./utils";
import { getCourseModules, updateCourseModule } from "./services/course";
import { ValidationError } from "./errors";



export async function handleGetCourseModules(req: IRequest, env: Env): Promise<Response> {
    const { courseId } = req.params;
    if (!courseId) return error(400, "Course ID is required")
    try {
        const modules = await getCourseModules(env, courseId);
        const statusMap = mapCourseModuleStatus(modules ?? {});
        return modules ? json(statusMap) : error(404, "Course not found");
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

export async function handleModuleTitleKeyUpdate(req: IRequest, env: Env): Promise<Response> {
    const { courseId, moduleId } = req.params;
    if (!courseId) return error(400, "Course ID is required");
    if (!moduleId) return error(400, "Module ID is required");
    try {
        const { titleKey }: Partial<CourseModuleInfo> = await req.json();
        if (!titleKey) {
            return error(400, "Title key is required in the payload");
        }
        const updated = await updateCourseModule(env, courseId, moduleId, { titleKey });
        return json(updated);
    } catch (err) {
        if (err instanceof ValidationError) {
            console.warn("Error:", err.name)
            return error(400, err.message);
        }
        return error(500, "Internal Server Error");
    }
}

export async function handleUpdateModuleLabs(req: IRequest, env: Env): Promise<Response> {
    const { courseId, moduleId } = req.params;
    if (!courseId) return error(400, "Course ID is required");
    if (!moduleId) return error(400, "Module ID is required");
    try {
        const payload: LabInfo[] = await req.json();        
        const updated = await updateModuleLabs(env, moduleId, payload);
        await syncModuleCompletion(env, courseId, moduleId, updated);
        return json(updated);
    } catch (err) {
        if (err instanceof ValidationError) {
            console.warn("Error:", err.name)
            return error(400, err.message);
        }
        return error(500, "Internal Server Error");
    }
}