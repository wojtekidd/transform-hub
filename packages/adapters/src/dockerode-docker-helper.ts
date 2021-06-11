import { SupervisorError } from "@scramjet/model";
import * as Dockerode from "dockerode";
import { PassThrough } from "stream";
import {
    DockerAdapterRunConfig,
    DockerAdapterRunResponse,
    DockerAdapterStreams, DockerAdapterVolumeConfig,
    DockerAdapterWaitOptions,
    DockerContainer,
    IDockerHelper, DockerImage, DockerVolume, ExitData
} from "./types";
import { FreePortsFinder } from "./utils";

/**
 * Configuration for volumes to be mounted to container.
 */
type DockerodeVolumeMountConfig = {
    /**
     * Directory in container where volume has to be mounted.
     */
    Target: string,

    /**
     * Volume name.
     */
    Source: string,

    /**
     * Mounting mode.
     */
    Type: "volume" | "bind",

    /**
     * Access mode.
     */
    ReadOnly: boolean
}

/**
 * Communicates with Docker using Dockerode library.
 */
export class DockerodeDockerHelper implements IDockerHelper {
    dockerode: Dockerode = new Dockerode();

    /**
     * Translates DockerAdapterVolumeConfig to volumes configuration that Docker API can understand.
     *
     * @param volumeConfigs Volumes configuration,
     * @returns Translated volumes configuration.
     */
    translateVolumesConfig(volumeConfigs: DockerAdapterVolumeConfig[]): DockerodeVolumeMountConfig[] {
        return volumeConfigs.map(cfg => {
            if ("bind" in cfg) {
                return {
                    Target: cfg.mountPoint,
                    Source: cfg.bind,
                    Type: "bind",
                    ReadOnly: false
                };
            }

            return {
                Target: cfg.mountPoint,
                Source: cfg.volume,
                Type: "volume",
                ReadOnly: false
            };
        });
    }

    async preparePortBindingsConfig(declaredPorts: string[], exposed = false) {
        if (declaredPorts.every(entry => (/^[0-9]{3,5}\/(tcp|udp)$/).test(entry))) {
            const freePorts = exposed ? [] : await FreePortsFinder.getPorts(declaredPorts.length);

            return declaredPorts.reduce((obj: { [ key: string ]: any }, entry: string) => {
                obj[entry] = exposed ? {} : [{ HostPort: freePorts?.pop()?.toString() }];

                return obj;
            }, {});
        }

        throw new SupervisorError("INVALID_CONFIGURATION", "Incorrect ports configuration provided.");
    }

    /**
     * Creates container based on provided parameters.
     *
     * @param dockerImage Image to start container from.
     * @param volumes Configuration of volumes to be mounted in container.
     * @param binds Configuration for mounting directories.
     * @param ports Exposed ports configuration.
     * @param envs Environmen variables to be set in container.
     * @param autoRemove Indicates that container should be auto-removed on exit.
     * @param maxMem Memory available for container (bytes).
     * @param command Optional command
     * @returns Created container id.
     */
    async createContainer(
        dockerImage: DockerImage,
        volumes: DockerAdapterVolumeConfig[] = [],
        binds: string[] = [],
        ports: any = [],
        envs: string[] = [],
        autoRemove: boolean = false,
        maxMem: number = 64 * 1024 * 1024, // TODO: Container configuration
        command?: string[]
    ): Promise<DockerContainer> {
        const config: Dockerode.ContainerCreateOptions = {
            Image: dockerImage,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            OpenStdin: true,
            StdinOnce: true,
            Env: envs,
            ExposedPorts: Array.isArray(ports) ? await this.preparePortBindingsConfig(ports, true) : undefined,
            HostConfig: {
                Binds: binds,
                Mounts: this.translateVolumesConfig(volumes),
                AutoRemove: autoRemove,
                Memory: maxMem,
                MemorySwap: 0,
                PortBindings: Array.isArray(ports) ? await this.preparePortBindingsConfig(ports, false) : undefined,
            },
        };

        if (command) config.Cmd = [...command];

        const { id } = await this.dockerode.createContainer(config);

        return id;
    }

    /**
     * Start continer with provided id.
     *
     * @param containerId Container id.
     * @returns Promise resolving when container has been started.
     */
    startContainer(containerId: DockerContainer): Promise<void> {
        return this.dockerode.getContainer(containerId).start();
    }

    /**
     * Stops container with provided id.
     *
     * @param containerId Container id.
     * @returns Promise which resolves when the container has been stopped.
     */
    stopContainer(containerId: DockerContainer): Promise<void> {
        return this.dockerode.getContainer(containerId).stop();
    }

    /**
     * Forcefully removes container with provided id.
     *
     * @param containerId Container id.
     * @returns Promise which resolves when container has been removed.
     */
    removeContainer(containerId: DockerContainer): Promise<void> {
        return this.dockerode.getContainer(containerId).remove();
    }

    /**
     * Gets statistics from container with provided id.
     *
     * @param containerId Container id.
     * @returns Promise which resolves with container statistics.
     */
    stats(containerId: DockerContainer): Promise<Dockerode.ContainerStats> {
        return this.dockerode.getContainer(containerId).stats({ stream: false });
    }

    /**
     * Creates docker volume.
     *
     * @param name Volume name. Optional. If not provided, volume will be named with unique name.
     * @returns Volume name.
     */
    async createVolume(name: string = ""): Promise<DockerVolume> {
        return this.dockerode.createVolume({
            Name: name,
        }).then((volume: Dockerode.Volume) => {
            return volume.name;
        });
    }

    /**
     * Removes volume with specific name.
     *
     * @param volumeName Volume name.
     * @returns Promise which resolves when volume has been removed.
     */
    async removeVolume(volumeName: DockerVolume): Promise<void> {
        return this.dockerode.getVolume(volumeName).remove();
    }

    async listVolumes() {
        const { Volumes } = await this.dockerode.listVolumes();

        return Volumes.map(volume => volume.Name);
    }

    /**
     * Attaches to container streams.
     *
     * @param container Container id.
     * @param opts Attach options.
     * @returns Object with container's standard I/O streams.
     */
    async attach(container: DockerContainer, opts: any): Promise<any> {
        return this.dockerode.getContainer(container).attach(opts);
    }

    /**
     * Starts container.
     *
     * @param config Container configuration.
     * @returns @see {DockerAdapterRunResponse}
     */
    async run(config: DockerAdapterRunConfig): Promise<DockerAdapterRunResponse> {
        const streams: DockerAdapterStreams = {
            stdin: new PassThrough(),
            stdout: new PassThrough(),
            stderr: new PassThrough()
        };
        // ------
        const container = await this.createContainer(
            config.imageName,
            config.volumes,
            config.binds,
            config.ports,
            config.envs,
            config.autoRemove,
            config.maxMem,
            config.command
        );
        // ------
        const stream = await this.attach(container, {
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true,
            hijack: true
        });

        stream.on("close", () => {
            streams.stdout.emit("end");
            streams.stderr.emit("end");
        });

        await this.startContainer(container);

        streams.stdin.pipe(stream);

        this.dockerode.getContainer(container)
            .modem.demuxStream(stream, streams.stdout, streams.stderr);

        return {
            streams: streams,
            containerId: container,
            wait: async () => this.wait(container, { condition: "not-running" })
        };
    }

    /**
     * Waits for container status change.
     *
     * @param container Container id.
     * @param options Condition to be fullfilled. @see {DockerAdapterWaitOptions}
     * @returns Container exit code.
     */
    async wait(container: DockerContainer, options: DockerAdapterWaitOptions): Promise<ExitData> {
        const containerExitResult = await this.dockerode.getContainer(container).wait(options);

        return { statusCode: containerExitResult.StatusCode };
    }
}
