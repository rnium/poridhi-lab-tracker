interface CourseModules extends Record<string, boolean> {
}

export async function getCourseModules(env: Env, courseId: string): Promise<CourseModules | null> {
    const courseData = await env.PORIDHI_LT.get(courseId)
    if (!courseData) return null
    return JSON.parse(courseData)
}

export async function setCourseModules(env: Env, courseId: string, modules: CourseModules): Promise<void> {
    await env.PORIDHI_LT.put(courseId, JSON.stringify(modules))
}

export async function updateCourseModule(env: Env, courseId: string, moduleKey: string, done: boolean): Promise<CourseModules> {
    const existing = await getCourseModules(env, courseId) ?? {}
    const updated: CourseModules = { ...existing, [moduleKey]: done }
    await setCourseModules(env, courseId, updated)
    return updated
}