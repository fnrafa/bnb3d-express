import axios from "axios";
import fs from "fs";
import WebSocket from "@/config/WebSocket";
import Service from "@/service/Service";
import {Prisma} from "@prisma/client";
import Variables from "@/config/Variables";

const MAX_TIME = 15 * 60 * 1000;
const POLL_INTERVAL = 1000;
const MAX_WORKERS_PER_KEY = 3;

class ModelWorker extends Service {
    private static workerPool: Map<string, number> = new Map();
    private static queue: { meshId: string; apiKeyId: string }[] = [];
    private static isBooted = false;

    public static boot(): void {
        if (this.isBooted) return;
        this.isBooted = true;
        setInterval(() => this.startPolling(), 1000);
    }

    private static async startPolling(): Promise<void> {
        const availableApiKey = await this.getAvailableApiKey();
        if (availableApiKey) {
            await this.startWorker(availableApiKey["id"]);
        }
    }

    public static async addToQueue(meshId: string): Promise<void> {
        const mesh = await this.prisma.mesh.findUnique({
            where: {id: meshId},
            include: {apiKey: true}
        });

        if (!mesh || mesh["state"] !== "pending" || !mesh["apiKey"]) {
            WebSocket.sendMessage(meshId, "error", "Mesh task not valid or no API key assigned.");
            return;
        }

        this.queue.push({meshId: mesh["id"], apiKeyId: mesh["apiKey"]["id"]});

        if ((this.workerPool.get(mesh["apiKey"]["id"]) || 0) < MAX_WORKERS_PER_KEY) {
            await this.startWorker(mesh["apiKey"]["id"]);
        }
    }

    private static async getAvailableApiKey(): Promise<{ id: string; keyHash: string } | null> {
        const apiKey = await this.prisma.apiKey.findFirst({
            orderBy: {activeTasks: Prisma.SortOrder.asc}
        });

        return apiKey ? {id: apiKey["id"], keyHash: apiKey["keyHash"]} : null;
    }

    private static async startWorker(apiKeyId: string): Promise<void> {
        if ((this.workerPool.get(apiKeyId) || 0) >= MAX_WORKERS_PER_KEY) return;

        this.workerPool.set(apiKeyId, (this.workerPool.get(apiKeyId) || 0) + 1);

        const processTask = async () => {
            const task = this.queue.find(t => t["apiKeyId"] === apiKeyId);
            if (!task) {
                this.workerPool.set(apiKeyId, this.workerPool.get(apiKeyId)! - 1);
                return;
            }

            this.queue = this.queue.filter(t => t["meshId"] !== task["meshId"]);
            await this.processTask(task["meshId"], apiKeyId);

            setTimeout(processTask, 1000);
        };

        await processTask();
    }

    private static async processTask(meshId: string, apiKeyId: string): Promise<void> {
        WebSocket.sendMessage(meshId, "waiting", "Task started processing.");

        const apiKey = await this.prisma.apiKey.findUnique({where: {id: apiKeyId}});
        if (!apiKey) {
            WebSocket.sendMessage(meshId, "error", "API Key not found.");
            return;
        }

        let taskIdFromApi: string | null = null;

        try {
            const mesh = await this.prisma.mesh.findUnique({where: {id: meshId}});
            if (!mesh) {
                WebSocket.sendMessage(meshId, "error", "Mesh not found.");
                return;
            }

            const response = await axios.post(`https://api.genai.masterpiecex.com/v2/functions/general`,
                {prompt: mesh["prompt"]},
                {headers: {Authorization: `Bearer ${apiKey["keyHash"]}`}}
            );

            taskIdFromApi = response.data["requestId"];

            await this.prisma.mesh.update({
                where: {id: meshId},
                data: {taskId: taskIdFromApi, apiKeyId, state: "processing"}
            });

            WebSocket.sendMessage(meshId, "task_created", `Task ID: ${taskIdFromApi}`);
        } catch (error: any) {
            WebSocket.sendMessage(meshId, "error", `Error generating model: ${error.message}`);
            return;
        }

        if (!taskIdFromApi) return;

        const startTime = Date.now();
        while (Date.now() - startTime < MAX_TIME) {
            try {
                const fetchResult = await axios.get(`https://api.genai.masterpiecex.com/v2/status/${taskIdFromApi}`, {
                    headers: {Authorization: `Bearer ${apiKey["keyHash"]}`},
                });

                const result = fetchResult.data;
                if (result["status"] === "complete") {
                    await this.downloadFiles(meshId, result["outputs"]);
                    WebSocket.sendMessage(meshId, "done", "Task completed.");
                    await this.prisma.apiKey.update({
                        where: {id: apiKeyId},
                        data: {activeTasks: {decrement: 1}}
                    });

                    this.workerPool.set(apiKeyId, this.workerPool.get(apiKeyId)! - 1);
                    return;
                } else if (result["status"] === "failed") {
                    WebSocket.sendMessage(meshId, "error", "Task Failed. Please Retry");
                    await this.prisma.mesh.update({
                        where: {id: meshId},
                        data: {state: "failed"}
                    });

                    this.workerPool.set(apiKeyId, this.workerPool.get(apiKeyId)! - 1);
                    return;
                }
                const progress = result["progress"] ? Math.floor(result["progress"]) : 0;

                WebSocket.sendMessage(meshId, "processing", `Hold tight! Your model is still processing... ${progress}% completed.`);
            } catch (error: any) {
                WebSocket.sendMessage(meshId, "error", `Error checking status: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }

        WebSocket.sendMessage(meshId, "timeout", "Processing time exceeded 10 minutes.");
    }


    private static async downloadFiles(meshId: string, outputs: any): Promise<void> {
        const download = async (url: string, outputPath: string) => {
            const response = await axios({url, method: "GET", responseType: "stream"});
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
            });
        };

        const task = await this.prisma.mesh.findUnique({where: {id: meshId}});

        if (!task) {
            WebSocket.sendMessage(meshId, "error", "Mesh not found.");
            return;
        }

        const glbPath = `${Variables.ASSETS_PATH}/models/${task["taskId"]}.glb`;
        const fbxPath = `${Variables.ASSETS_PATH}/models/${task["taskId"]}.fbx`;
        const usdzPath = `${Variables.ASSETS_PATH}/models/${task["taskId"]}.usdz`;
        const imagePath = `${Variables.ASSETS_PATH}/images/${task["taskId"]}.png`;

        if (outputs["glb"]) await download(outputs["glb"], glbPath);
        if (outputs["fbx"]) await download(outputs["fbx"], fbxPath);
        if (outputs["usdz"]) await download(outputs["usdz"], usdzPath);
        if (outputs["thumbnail"]) await download(outputs["thumbnail"], imagePath);

        await this.prisma.mesh.update({
            where: {id: meshId},
            data: {
                modelGlb: `${Variables.BASE_URL}/assets/models/${task["taskId"]}.glb`,
                modelFbx: `${Variables.BASE_URL}/assets/models/${task["taskId"]}.fbx`,
                modelUsdz: `${Variables.BASE_URL}/assets/models/${task["taskId"]}.usdz`,
                Image: `${Variables.BASE_URL}/assets/images/${task["taskId"]}.png`,
                state: "succeeded",
            }
        });
    }
}

export default ModelWorker;
