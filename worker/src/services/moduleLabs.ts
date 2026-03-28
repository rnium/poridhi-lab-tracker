interface ModulesLabs extends Record<string, boolean> {
}

export async function getModuleLabs(env: Env, moduleId: string): Promise<ModulesLabs | null> {
    const moduleData = await env.PORIDHI_LT.get(moduleId)
    if (!moduleData) return null
    return JSON.parse(moduleData)
}

async function setModuleLabs(env: Env, moduleId: string, labs: ModulesLabs): Promise<void> {
    await env.PORIDHI_LT.put(moduleId, JSON.stringify(labs))
}

export async function updateModuleLab(env: Env, moduleId: string, labKey: string, done: boolean): Promise<ModulesLabs> {
    const existing = await getModuleLabs(env, moduleId) ?? {}
    const updated: ModulesLabs = { ...existing, [labKey]: done }
    await setModuleLabs(env, moduleId, updated)
    return updated
}