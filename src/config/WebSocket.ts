import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import Variables from "@/config/Variables";
import Service from "@/service/Service";

class WebSocket extends Service{
    private static io: Server | undefined;

    static boot(server: HTTPServer): void {
        this.io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                allowedHeaders: ["Content-Type"],
                credentials: true,
            },
        });

        this.io.use(async (socket: Socket, next) => {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error("Unauthorized: No token provided"));

            try {
                const decoded = jwt.verify(token, Variables.SECRET) as any;
                const session = await this.prisma.session.findFirst({ where: { token } });
                if (!session || session["expiresAt"] < new Date()) {
                    return next(new Error("Session expired or invalid"));
                }
                (socket as any).user = decoded.id;
                next();
            } catch (error) {
                next(new Error("Unauthorized"));
            }
        });

        this.io.on("connection", (socket: Socket) => {
            console.log("A user connected with socket id:", socket.id, "User ID:", (socket as any).user);

            socket.on("disconnect", () => {
                console.log("User disconnected", socket.id);
            });
        });
    }

    static sendMessage(taskId: string, status: string, message: string) {
        if (this.io) {
            this.io.emit(taskId, {status, message} as unknown as any);
            console.log(`📡 WebSocket | ID: ${taskId} | Status: ${status} | Message: ${message}`);
        }
    }
}

export default WebSocket;
