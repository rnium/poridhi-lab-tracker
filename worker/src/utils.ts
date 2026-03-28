import { getCourseModules, setCourseModules } from "./services/course";

export async function syncModuleCompletion(env: Env, courseId: string, moduleId: string, updatedLabs: ModulesLabs): Promise<void> {
    const allLabsDone = Object.values(updatedLabs).every(done => done);
    const courseModules = await getCourseModules(env, courseId);
    if (!courseModules) {
        // register course if not exists
        await setCourseModules(env, courseId, { [moduleId]: allLabsDone });
        return;
    }
    if (courseModules[moduleId] === allLabsDone) return; // no update needed
    courseModules[moduleId] = allLabsDone;
    await setCourseModules(env, courseId, courseModules);
}