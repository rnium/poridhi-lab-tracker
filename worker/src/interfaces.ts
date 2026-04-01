interface Env {
  PORIDHI_LT: KVNamespace;
  API_KEY: string;
}

interface CourseModuleInfo {
    titleKey?: string;
    done: boolean;
}

interface CourseModules extends Record<string, CourseModuleInfo> {
}

interface ModulesLabs extends Record<string, boolean> {
}

interface ModulesStatus extends Record<string, boolean> {
}

interface LabInfo {
    labId: string;
    done: boolean;
}
