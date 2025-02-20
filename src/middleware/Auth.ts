import {NextFunction, Request, Response as EResponse} from "express";
import jwt from "jsonwebtoken";
import Variables from "@/config/Variables";
import Response from "@/config/Response";
import Service from "@/service/Service";

interface DecodedToken {
    id: string;
    address: string;
    iat: number;
    exp: number;
}

class Auth {
    private static verifyToken(token: string): DecodedToken | null {
        try {
            return jwt.verify(token, Variables.SECRET) as DecodedToken;
        } catch (error) {
            return null;
        }
    }

    public static authorize() {
        return async (req: Request, res: EResponse, next: NextFunction): Promise<void> => {
            const tokenWithBearer = req.headers.authorization;

            if (!tokenWithBearer || !tokenWithBearer.startsWith("Bearer ")) {
                Response.Unauthorized(res, "No Token Provided");
                return;
            }

            const token = tokenWithBearer.split(" ")[1];

            const decoded = Auth.verifyToken(token);
            if (!decoded) {
                Response.Unauthorized(res, "Invalid or Expired Token");
                return;
            }

            const session = await Service.prisma.session.findFirst({where: {token}});

            if (!session) {
                Response.Unauthorized(res, "Session not found");
                return;
            }

            if (session["expiresAt"] < new Date()) {
                Response.Unauthorized(res, "Session Expired");
                return;
            }

            res.locals.user = decoded;
            next();
        };
    }

    public static generateToken(id: string, address: string): string {
        return jwt.sign({id, address}, Variables.SECRET, {expiresIn: "24h"});
    }

    public static async revokeSession(token: string): Promise<void> {
        await Service.prisma.session.deleteMany({where: {token}});
    }
}

export default Auth;
