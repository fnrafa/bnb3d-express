import Service from "@/service/Service";
import {Mesh, Prisma} from "@prisma/client";
import ModelWorker from "@/workers/ModelWorker";
import CustomError from "@/middleware/CustomError";

class ModelApiService extends Service {

    public static async createMeshEntry(prompt: string, userId: string): Promise<Mesh> {
        const apiKey = await this.prisma.apiKey.findFirst({
            orderBy: {activeTasks: Prisma.SortOrder.asc}
        });

        if (!apiKey) {
            throw new Error("No available API key");
        }

        const mesh = await this.prisma.mesh.create({
            data: {
                prompt,
                state: "pending",
                userId,
                apiKeyId: apiKey["id"],
            }
        });

        await this.prisma.apiKey.update({
            where: {id: apiKey["id"]},
            data: {activeTasks: {increment: 1}},
        });

        ModelWorker.addToQueue(mesh["id"]).then();
        return mesh;
    }

    public static async getMeshResult(id: string): Promise<any> {
        try {
            return await this.prisma.mesh.findUnique({
                where: {id},
                include: {user: true}
            });
        } catch (error) {
            this.handleError(new CustomError("Failed to fetch mesh result", 500));
            throw error;
        }
    }

    public static async getUserMeshes(userId: string): Promise<any[]> {
        try {
            return await this.prisma.mesh.findMany({
                where: {userId},
                include: {user: true}
            });
        } catch (error) {
            this.handleError(new CustomError("Failed to fetch user meshes", 500));
            throw error;
        }
    }

    public static async getAllMeshes(): Promise<any[]> {
        try {
            return await this.prisma.mesh.findMany({
                include: {user: true}
            });
        } catch (error) {
            this.handleError(new CustomError("Failed to fetch all meshes", 500));
            throw error;
        }
    }
}

export default ModelApiService;



