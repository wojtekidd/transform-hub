import { SupervisorErrorCode } from "@scramjet/types";
import { AppError } from ".";

export type ISupervisorErrorData = any;

export class SupervisorError extends AppError implements ISupervisorErrorData {
    constructor(code: SupervisorErrorCode, data?: ISupervisorErrorData) {
        super(code);

        this.data = data;
    }
}
