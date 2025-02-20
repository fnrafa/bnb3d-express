import {Router} from "express";
import ModelApiController from "@/controller/ModelApiController";
import Auth from "@/middleware/Auth";
import ModelValidation from "@/validation/ModelValidation";

class ModelApiRoute {
    private static router = Router();

    public static route(): Router {
        this.router.post("/generate", Auth.authorize(), ModelValidation.generateModel(), ModelApiController.generateModel);
        this.router.get("/user", Auth.authorize(), ModelApiController.getUserModel);
        this.router.get("/user/:userId", ModelApiController.getModelByUserId);
        this.router.get("/result/:id", ModelApiController.getModelResult);
        this.router.get("/", ModelApiController.getAllModel);

        return this.router;
    }
}

export default ModelApiRoute;
