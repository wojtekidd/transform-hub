import { STHConfiguration } from "@scramjet/types";
import { HostOptions, startHost } from "@scramjet/host";

export class STH {
    config: STHConfiguration;

    constructor(config: STHConfiguration) {
        this.config = config;
    }

    start(options: HostOptions = {}) {
        startHost(
            {},
            this.config,
            {
                identifyExisting: options.identifyExisting
            })
            .catch((e: Error & { exitCode?: number }) => {
                // eslint-disable-next-line no-console
                console.error(e.stack);
                process.exitCode = e.exitCode || 1;
                process.exit();
            });
    }

    stop() {
        throw new Error("Not implemented");
    }
}
