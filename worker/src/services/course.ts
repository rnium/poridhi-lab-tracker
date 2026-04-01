export async function getCourseModules(env: Env, courseId: string): Promise<CourseModules | null> {
    const courseData = await env.PORIDHI_LT.get(courseId)
    if (!courseData) return null
    return JSON.parse(courseData)
}

export async function setCourseModules(env: Env, courseId: string, modules: CourseModules): Promise<void> {
    await env.PORIDHI_LT.put(courseId, JSON.stringify(modules))
}

export async function updateCourseModule(env: Env, courseId: string, moduleKey: string, info: Partial<CourseModuleInfo>): Promise<CourseModuleInfo> {
    const existingModules = await getCourseModules(env, courseId) ?? {}
    const existing = existingModules[moduleKey] ?? {}

    if (Object.keys(info).length === 0) {
        return existing
    }

    const hasChanges = Object.entries(info).some(
        ([key, value]) => existing[key as keyof CourseModuleInfo] !== value
    )
    if (!hasChanges) {
        return existing
    }

    // if none of info and existing have done, then set done to false as default
    if (info.done === undefined && existing.done === undefined) {
        info.done = false
    }

    const updatedModule: CourseModuleInfo = {
        ...existing,
        ...info,
    }
    
    const updated: CourseModules = {
         ...existingModules,
         [moduleKey]: updatedModule,
    }
    await setCourseModules(env, courseId, updated)
    return updatedModule
}