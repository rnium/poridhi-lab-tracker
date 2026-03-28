import { AutoRouter } from "itty-router"; 
import { handleGetModuleLabs, handleUpdateModuleLab } from "./handlers";

const router = AutoRouter();

router.get("/modules/:moduleId/labs", handleGetModuleLabs);
router.post("/modules/:moduleId/labs", handleUpdateModuleLab);

export default router;