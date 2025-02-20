import {Router} from 'express';
import AuthValidation from "@/validation/AuthValidation";
import AuthController from "@/controller/AuthController";
import Auth from "@/middleware/Auth";

class AuthRoute {
    private static router = Router();

    public static route(): Router {
        this.router.post('/nonce', AuthValidation.nonce(), AuthController.getNonce);
        this.router.post('/login', AuthValidation.login(), AuthController.login);
        this.router.post('/logout', Auth.authorize(), AuthController.logout);
        return this.router;
    }
}

export default AuthRoute;
