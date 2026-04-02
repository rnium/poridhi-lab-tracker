import { getCourseModules, setCourseModules, updateCourseModule } from "./services/course";

export async function syncModuleCompletion(env: Env, courseId: string, moduleId: string, updatedLabs: ModulesLabs): Promise<void> {
    const allLabsDone = Object.values(updatedLabs).every(done => done);
    const courseModules = await getCourseModules(env, courseId);
    if (!courseModules) {
        // register course if not exists
        await setCourseModules(env, courseId, { [moduleId]: { done: allLabsDone } });
        return;
    }
    if (courseModules[moduleId]?.done === allLabsDone) return; // no update needed
    await updateCourseModule(env, courseId, moduleId, { done: allLabsDone });
}
