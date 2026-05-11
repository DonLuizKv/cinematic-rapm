import { Router } from "express";
import { Esp32Controller } from "./esp32.controller";

export function createEsp32Routes(controller: Esp32Controller): Router {
    const router: Router = Router();

    router.post("/command", controller.Command);

    return router;
}