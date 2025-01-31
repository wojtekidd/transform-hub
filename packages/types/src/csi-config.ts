/**
 * CSI configuration type.
 */
import { STHConfiguration } from "./sth-configuration";

export type CSIConfig = {
    socketPath: STHConfiguration["host"]["socketPath"]
    instanceAdapterExitDelay: STHConfiguration["instanceAdapterExitDelay"];
}
