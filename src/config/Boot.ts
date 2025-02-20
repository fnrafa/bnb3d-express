import express from "express";
/*import {readFileSync} from 'fs';*/

import {createServer} from 'http';
/*import {createServer} from 'https';*/

import Limiter from "@/middleware/Limiter";
import Cors from "@/middleware/Cors";
import WebSocket from "@/config/WebSocket";
import Variables from "@/config/Variables";
import AnimationConsole from "@/utils/Console";
import Route from "@/routes/Route";
import ModelWorker from "@/workers/ModelWorker";

class Boot {
    private static app = express();

    /*private static options = {
        key: readFileSync('/etc/letsencrypt/live/logicai.technology/privkey.pem'),
        cert: readFileSync('/etc/letsencrypt/live/logicai.technology/fullchain.pem')
    };
    private static server = createServer(this.options, this.app);*/

    private static server = createServer(this.app);


    public static async boot(): Promise<void> {
        await AnimationConsole.dots('Processing: getting information', new Promise<void>((resolve) => {
            Variables.boot();
            resolve();
        }));
        await AnimationConsole.static('Success: information retrieved');
        await AnimationConsole.dots('Processing: booting', new Promise<void>((resolve) => {
            this.booting();
            resolve();
        }));
        await AnimationConsole.static('Success: booting completed');
        await AnimationConsole.dots(`Starting: trying to run server on port ${Variables.PORT}`, new Promise<void>((resolve) => {
            this.initialize();
            resolve();
        }));
        this.server.listen(Variables.PORT, async () => {
            await AnimationConsole.static(`Server is running on port ${Variables.PORT}\n`);
        });
    }

    private static booting(): void {
        WebSocket.boot(this.server);
        Limiter.boot();
        ModelWorker.boot();
    }

    private static initialize(): void {
        Cors.applyCors(this.app);
        Limiter.applyRateLimits(this.app);

        Route.registerRoutes(this.app);
    }
}

export default Boot;
