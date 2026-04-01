declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {
		  PORIDHI_LT: KVNamespace;
		  API_KEY: string;
	}
}

interface CourseModuleInfo {
	titleKey?: string;
	done: boolean;
}

interface CourseModules extends Record<string, CourseModuleInfo> {
}

interface ModulesLabs extends Record<string, boolean> {
}
