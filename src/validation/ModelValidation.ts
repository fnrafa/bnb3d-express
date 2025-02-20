import Joi from "joi";
import Validator from "@/validation/Validator";

class ModelValidation extends Validator {
    public static generateModel() {
        return this.validate(
            Joi.object({
                prompt: this.text(1, 3000),
            })
        );
    }
}

export default ModelValidation;
