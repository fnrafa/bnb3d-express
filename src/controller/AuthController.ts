import {Request, Response as EResponse} from "express";
import {verifyMessage} from "ethers";
import {v4 as uuidv4} from "uuid";
import Response from "@/config/Response";
import Service from "@/service/Service";
import Auth from "@/middleware/Auth";
import bcrypt from "bcrypt";

class AuthController {
    public static async getNonce(req: Request, res: EResponse): Promise<void> {
        const {address} = req.body;
        if (!address) {
            Response.BadRequest(res, "Wallet address is required");
            return;
        }

        const nonce = uuidv4();

        await Service.prisma.user.upsert({
            where: {address},
            update: {nonce},
            create: {address, username: `User_${address.slice(0, 6)}`, nonce},
        });

        Response.Success(res, "Nonce generated", {nonce});
    }

    public static async login(req: Request, res: EResponse): Promise<void> {
        const {address, signature} = req.body;

        if (!address || !signature) {
            Response.BadRequest(res, "Address and signature are required");
            return;
        }

        const user = await Service.prisma.user.findUnique({where: {address}});
        if (!user || !user["nonce"]) {
            Response.Forbidden(res, "User not found or nonce missing");
            return;
        }

        let recoveredAddress: string;
        try {
            recoveredAddress = verifyMessage(user["nonce"], signature);
        } catch (error) {
            Response.Unauthorized(res, "Error verifying signature");
            return;
        }

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            Response.Unauthorized(res, "Invalid signature");
            return;
        }

        await Service.prisma.session.deleteMany({where: {userId: user["id"]}});

        const token = Auth.generateToken(user["id"], address);

        await Service.prisma.session.create({
            data: {
                userId: user["id"],
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        Response.Success(res, "Login successful", {
            id: user["id"],
            username: user["username"],
            address,
            point: user["point"],
            token,
        });
    }

    public static async logout(req: Request, res: EResponse): Promise<void> {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            Response.Unauthorized(res, "No token provided");
            return;
        }
        const token = authHeader.split(" ")[1];

        await Auth.revokeSession(token);
        Response.Success(res, "Logged out successfully");
    }

    public static async register(req: Request, res: EResponse): Promise<void> {
        const {address, password, username} = req.body;
        const existingUser = await Service.prisma.user.findUnique({where: {address}});
        if (existingUser) {
            Response.BadRequest(res, "User already exists");
            return;
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const finalUsername = username ? username : `User_${address.slice(0, 6)}`;
        const user = await Service.prisma.user.create({
            data: {
                address,
                username: finalUsername,
                password: hashedPassword,
            },
        });

        Response.Success(res, "User registered successfully", {
            id: user["id"],
            username: user["username"],
            address: user["address"],
            point: user["point"],
        });
    }

    public static async loginBNB(req: Request, res: EResponse): Promise<void> {
        const {address, password} = req.body;
        if (!address || !password) {
            Response.BadRequest(res, "Address and password are required");
            return;
        }

        const user = await Service.prisma.user.findUnique({where: {address}});
        if (!user || !user["password"]) {
            Response.Forbidden(res, "User not found or password not set");
            return;
        }

        const validPassword = await bcrypt.compare(password, user["password"]);
        if (!validPassword) {
            Response.Unauthorized(res, "Invalid password");
            return;
        }

        await Service.prisma.session.deleteMany({where: {userId: user["id"]}});

        const token = Auth.generateToken(user["id"], address);

        await Service.prisma.session.create({
            data: {
                userId: user["id"],
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        Response.Success(res, "Login successful", {
            id: user["id"],
            username: user["username"],
            address,
            point: user["point"],
            token,
        });
    }
}

export default AuthController;
