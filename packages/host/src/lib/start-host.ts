import { createServer, ServerConfig } from "@scramjet/api-server";
import { STHConfiguration } from "@scramjet/types";
import { Host, HostOptions } from "./host";
import { SocketServer } from "./socket-server";

/**
 * Starts Host module.
 *
 * @param apiServerConfig - api server configuration
 * @param sthConfig - sth configuration
 * @param hostOptions - host options
 */
export async function startHost(
    apiServerConfig: ServerConfig,
    sthConfig: STHConfiguration,
    hostOptions: HostOptions
) {
    const apiServer = createServer(apiServerConfig);
    const tcpServer = new SocketServer(sthConfig.host.socketPath);
    const host = new Host(apiServer, tcpServer, sthConfig);

    await host.main(hostOptions);
}

