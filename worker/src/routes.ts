import { AutoRouter, cors } from "itty-router"; 
import { handleGetCourseModules, handleGetModuleLabs, handleUpdateModuleLabs, handleModuleTitleKeyUpdate } from "./handlers";
import { withAuthenticate } from "./middleware";

const { preflight, corsify } = cors({
    origin: "https://poridhi.io",
    allowMethods: "*"
})

const router = AutoRouter({
    before: [preflight],
    finally: [corsify]
}).all("*", withAuthenticate);


router.get("/course/:courseId/modules", handleGetCourseModules);
router.get("/modules/:moduleId/labs", handleGetModuleLabs);
router.post("/course/:courseId/modules/:moduleId/title", handleModuleTitleKeyUpdate);
router.post("/course/:courseId/modules/:moduleId/labs", handleUpdateModuleLabs);

export default router;