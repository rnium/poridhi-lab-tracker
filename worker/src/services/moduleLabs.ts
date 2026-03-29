export async function getModuleLabs(env: Env, moduleId: string): Promise<ModulesLabs | null> {
    const moduleData = await env.PORIDHI_LT.get(moduleId)
    if (!moduleData) return null
    return JSON.parse(moduleData)
}

async function setModuleLabs(env: Env, moduleId: string, labs: ModulesLabs): Promise<void> {
    await env.PORIDHI_LT.put(moduleId, JSON.stringify(labs))
}

export async function updateModuleLabs(env: Env, moduleId: string, labs: LabInfo[]): Promise<ModulesLabs> {
    const existingLabs = await getModuleLabs(env, moduleId) ?? {}
    const updated: ModulesLabs = { ...existingLabs }
    for (const { labId, done } of labs) {
        if (typeof done !== "boolean" || !labId) {
            throw new Error("labId and done(boolean) are required for each lab in the payload");
        }
        if (existingLabs[labId] !== done) {
            updated[labId] = done
        }
    }
    // Only update if there's a change to minimize unnecessary writes
    if (Object.keys(updated).length > 0) {
        await setModuleLabs(env, moduleId, updated)
    }
    return updated
}