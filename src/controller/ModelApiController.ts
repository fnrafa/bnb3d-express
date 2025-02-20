import {Request, Response} from "express";
import ModelApiService from "@/service/ModelApiService";
import ResponseHelper from "@/config/Response";
import ModelWorker from "@/workers/ModelWorker";

class ModelApiController {
    public static async generateModel(req: Request, res: Response): Promise<void> {
        const userId = res.locals.user.id;
        const {prompt} = req.body;
        const data = await ModelApiService.createMeshEntry(prompt, userId);
        ResponseHelper.Created(res, "Starting model generation", data);
    }

    public static async getUserModel(req: Request, res: Response): Promise<void> {
        const userId = res.locals.user.id;
        const data = await ModelApiService.getUserMeshes(userId);
        ResponseHelper.Success(res, "Model fetched", data);
    }

    public static async getModelByUserId(req: Request, res: Response): Promise<void> {
        const {userId} = req.params;
        const data = await ModelApiService.getUserMeshes(userId);
        ResponseHelper.Success(res, "User related model fetched", data);
    }

    public static async getAllModel(req: Request, res: Response): Promise<void> {
        const data = await ModelApiService.getAllMeshes();
        ResponseHelper.Success(res, "All model fetched", data);
    }

    public static async getModelResult(req: Request, res: Response): Promise<void> {
        const {id} = req.params;
        const data = await ModelApiService.getMeshResult(id);
        if (data["state"] === "pending") {
            ModelWorker.addToQueue(data.id).then();
            ResponseHelper.Accepted(res, "Result is not ready yet. Try again later.");
            return;
        }
        ResponseHelper.Success(res, "Model result fetched", data);
    }
}

export default ModelApiController;
