import Joi from "joi";
import Validator from "@/validation/Validator";

class AuthValidation extends Validator {

    public static nonce() {
        return this.validate(
            Joi.object({
                address: this.text(1, 255),
            })
        );
    }

    public static login() {
        return this.validate(
            Joi.object({
                address: this.text(1, 255),
                signature: Joi.string().required(),
                password: Joi.string().optional()
            })
        );
    }
}

export default AuthValidation;
