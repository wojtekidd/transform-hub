import { Server as NetServer } from "net";
import { Server as HttpServer } from "http";
import { EncodedMonitoringMessage } from "@scramjet/types";
import { RunnerMessageCode, HandshakeAcknowledgeMessage, MessageUtilities } from "@scramjet/model";
import { DataStream } from "scramjet";
import * as vorpal from "vorpal";

export class HostOne {
    // @ts-ignore    
    private socketName: string = "";//TODO should be unique
    // @ts-ignore
    private netServer: NetServer;
    // @ts-ignore
    private httpApiServer: HttpServer;
    // @ts-ignore
    private monitorStream: DataStream;
    // @ts-ignore
    private controlStream: DataStream;
    // @ts-ignore
    private sequencePath: string;
    // @ts-ignore
    private configPath: string;
    // @ts-ignore
    private vorpal: any;

    errors = {
        noParams: "No params provided. Type help to know more.",
        parsingError: "An error occurred during parsing monitoring message.",
        noImplement: "Method not implemented."
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(sequencePath: string, configPath: string){
        this.controlStream = new DataStream();
        this.monitorStream = new DataStream();
    }

    async main(): Promise<void> {
        await this.createNetServer(this.socketName);
        await this.startSupervisor(this.socketName);
        await this.createApiServer();
        await this.hookupMonitorStream();
        await this.init();
    }

    async init() {
        this.vorpal = new vorpal();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async createNetServer(socketName: string): Promise<void> {
        throw new Error(this.errors.noImplement);
    }

    async createApiServer(): Promise<void> {
        throw new Error(this.errors.noImplement);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async startSupervisor(socketName: string): Promise<void> {
        throw new Error(this.errors.noImplement);
    }

    async hookupMonitorStream() {
        //TODO monitorStream has to be demuxed before?
        this.monitorStream
            .stringify()
            .JSONParse()
            .map(async ([code, data]: EncodedMonitoringMessage) => {
                console.log(data);//TODO delete
                switch (code) {
                case RunnerMessageCode.ACKNOWLEDGE:
                    break;
                case RunnerMessageCode.DESCRIBE_SEQUENCE:
                    break;
                case RunnerMessageCode.ALIVE:
                    break;
                case RunnerMessageCode.ERROR:
                    break;
                case RunnerMessageCode.MONITORING:
                    break;
                case RunnerMessageCode.EVENT:
                    break;
                case RunnerMessageCode.PING:
                    this.handleHandshake();
                    break;
                case RunnerMessageCode.SNAPSHOT_RESPONSE:
                    break;
                default:
                    break;
                }
            })
            .run()
            .catch(async (error) => {
                console.error(this.errors.parsingError, error.stack);
            });
    }

    async handleHandshake() {
        const pongMsg: HandshakeAcknowledgeMessage = {
            msgCode: RunnerMessageCode.PONG,
            appConfig: { key: "app configuration value TODO" }, //TODO
            arguments: ["../../package/data.json", "out.txt"] //TODO think how to avoid passing relative path (from runner)
        };

        await this.controlStream.whenWrote(MessageUtilities.serializeMessage<RunnerMessageCode.PONG>(pongMsg));
    }

    controlStreamsHandler() {
        this.vorpal
            .command("alive", "Confirm that sequence is alive when it is not responding")
            .action(() => this.controlStream.whenWrote([RunnerMessageCode.ALIVE, {}]));

        this.vorpal
            .command("kill", "Kill forcefully sequence")
            .action(() => this.controlStream.whenWrote([RunnerMessageCode.KILL, {}]));

        this.vorpal
            .command("stop", "Stop gracefully sequence")
            /* 
            * @feature/analysis-stop-kill-invocation
            * Stop message must include two properties:
            * timeout: number - the Sequence will be stopped after the provided timeout (miliseconds)
            * canCallKeepalive: boolean - indicates whether Sequence can prolong operation to complete the task
            * required for AppContext's:
            * stopHandler?: (timeout: number, canCallKeepalive: boolean) => MaybePromise<void>;
            * once the promise is resolved the Runner assumes it is safe to stop the Sequence
            */
            .action(() => this.controlStream.whenWrote([RunnerMessageCode.STOP, {}]));

        this.vorpal
            .command("event [EVENT_NAME] [ANY]", "Send event and any object, arry, function to the sequence")
            .action((args: any) => {
                // TODO: needs removal... why not JSON.parse?
                let eventName = args.EVENT_NAME;
                let obj = args.ANY; // temp eval

                return eventName === undefined && obj === undefined
                    ? this.vorpal.log(this.errors.noParams)
                    : this.controlStream.whenWrote([RunnerMessageCode.EVENT, { eventName, obj }]);
            });

        this.vorpal
            .command("monitor [NUMBER]", "Change sequence monitoring rate")
            .alias("rate")
            .action((args: any) => {
                let monitoringRate = parseInt(args.NUMBER, 10);

                console.log();

                return isNaN(monitoringRate)
                    ? this.vorpal.log(this.errors.noParams)
                    : this.controlStream.whenWrote([RunnerMessageCode.MONITORING_RATE, { monitoringRate }]);
            });

        this.vorpal
            .delimiter("sequence:")
            .show()
            .parse(process.argv);
    }

    /**
     * For testing puspose only
     */
    vorpalExec(command: string) {
        this.vorpal.exec(command);
    }
}
