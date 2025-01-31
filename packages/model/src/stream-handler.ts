import { CommunicationChannel as CC, CPMMessageCode, RunnerMessageCode, SupervisorMessageCode } from "@scramjet/symbols";
import {
    ControlMessageCode,
    ControlMessageHandler,
    DownstreamStreamsConfig,
    EncodedControlMessage,
    EncodedMonitoringMessage,
    ICommunicationHandler,
    LoggerOutput,
    MaybePromise,
    MessageDataType,
    MonitoringMessageCode,
    MonitoringMessageHandler,
    MutatingMonitoringMessageHandler,
    PassThoughStream,
    UpstreamStreamsConfig,
    WritableStream
} from "@scramjet/types";

import { DataStream, StringStream } from "scramjet";
import { PassThrough, Readable, Writable } from "stream";

export type ConfiguredMessageHandler<T extends RunnerMessageCode | SupervisorMessageCode | CPMMessageCode> = {
    handler: MutatingMonitoringMessageHandler<T extends MonitoringMessageCode ? T : never>
    blocking: boolean
} | {
    handler: ControlMessageHandler<T extends ControlMessageCode ? T : never>
    blocking: boolean
};

type MonitoringMessageHandlerList = {
    [RunnerMessageCode.ACKNOWLEDGE]: ConfiguredMessageHandler<RunnerMessageCode.ACKNOWLEDGE>[];
    [RunnerMessageCode.DESCRIBE_SEQUENCE]: ConfiguredMessageHandler<RunnerMessageCode.DESCRIBE_SEQUENCE>[];
    [RunnerMessageCode.STATUS]: ConfiguredMessageHandler<RunnerMessageCode.STATUS>[];
    [RunnerMessageCode.ALIVE]: ConfiguredMessageHandler<RunnerMessageCode.ALIVE>[];
    [RunnerMessageCode.ERROR]: ConfiguredMessageHandler<RunnerMessageCode.ERROR>[];
    [RunnerMessageCode.MONITORING]: ConfiguredMessageHandler<RunnerMessageCode.MONITORING>[];
    [RunnerMessageCode.PING]: ConfiguredMessageHandler<RunnerMessageCode.PING>[];
    [RunnerMessageCode.PANG]: ConfiguredMessageHandler<RunnerMessageCode.PANG>[];
    [RunnerMessageCode.SNAPSHOT_RESPONSE]: ConfiguredMessageHandler<RunnerMessageCode.SNAPSHOT_RESPONSE>[];
    [RunnerMessageCode.SEQUENCE_STOPPED]: ConfiguredMessageHandler<RunnerMessageCode.SEQUENCE_STOPPED>[];
    [RunnerMessageCode.SEQUENCE_COMPLETED]: ConfiguredMessageHandler<RunnerMessageCode.SEQUENCE_COMPLETED>[];
    [RunnerMessageCode.EVENT]: ConfiguredMessageHandler<RunnerMessageCode.EVENT>[];
    [CPMMessageCode.LOAD]: ConfiguredMessageHandler<CPMMessageCode.LOAD>[];
    [CPMMessageCode.NETWORK_INFO]: ConfiguredMessageHandler<CPMMessageCode.NETWORK_INFO>[];
};

type ControlMessageHandlerList = {
    [RunnerMessageCode.FORCE_CONFIRM_ALIVE]: ConfiguredMessageHandler<RunnerMessageCode.FORCE_CONFIRM_ALIVE>[];
    [RunnerMessageCode.KILL]: ConfiguredMessageHandler<RunnerMessageCode.KILL>[];
    [RunnerMessageCode.MONITORING_RATE]: ConfiguredMessageHandler<RunnerMessageCode.MONITORING_RATE>[];
    [RunnerMessageCode.STOP]: ConfiguredMessageHandler<RunnerMessageCode.STOP>[];
    [RunnerMessageCode.PONG]: ConfiguredMessageHandler<RunnerMessageCode.PONG>[];
    [RunnerMessageCode.INPUT_CONTENT_TYPE]: ConfiguredMessageHandler<RunnerMessageCode.PONG>[];
    [RunnerMessageCode.EVENT]: ConfiguredMessageHandler<RunnerMessageCode.EVENT>[];
    [SupervisorMessageCode.CONFIG]: ConfiguredMessageHandler<SupervisorMessageCode.CONFIG>[];
    [CPMMessageCode.STH_ID]: ConfiguredMessageHandler<CPMMessageCode.STH_ID>[];
};

export class CommunicationHandler implements ICommunicationHandler {
    upstreams?: UpstreamStreamsConfig;
    downstreams?: DownstreamStreamsConfig;

    private loggerPassThrough: PassThoughStream<string>;
    private controlPassThrough: DataStream;
    private monitoringPassThrough: DataStream;

    private _piped?: boolean;

    // private monitoringHandlers: MonitoringMessageHandler<MonitoringMessageCode>[] = [];
    // private controlHandlers: ControlMessageHandler<ControlMessageCode>[] = [];

    private monitoringHandlerHash: MonitoringMessageHandlerList;
    private controlHandlerHash: ControlMessageHandlerList;

    constructor() {
        this.controlPassThrough = new DataStream();
        this.monitoringPassThrough = new DataStream();
        this.loggerPassThrough = new PassThrough();
        this.controlHandlerHash = {
            [RunnerMessageCode.FORCE_CONFIRM_ALIVE]: [],
            [RunnerMessageCode.KILL]: [],
            [RunnerMessageCode.MONITORING_RATE]: [],
            [RunnerMessageCode.STOP]: [],
            [RunnerMessageCode.EVENT]: [],
            [RunnerMessageCode.PONG]: [],
            [RunnerMessageCode.INPUT_CONTENT_TYPE]: [],
            [SupervisorMessageCode.CONFIG]: [],
            [CPMMessageCode.STH_ID]: []
        };
        this.monitoringHandlerHash = {
            [RunnerMessageCode.ACKNOWLEDGE]: [],
            [RunnerMessageCode.DESCRIBE_SEQUENCE]: [],
            [RunnerMessageCode.STATUS]: [],
            [RunnerMessageCode.ALIVE]: [],
            [RunnerMessageCode.ERROR]: [],
            [RunnerMessageCode.MONITORING]: [],
            [RunnerMessageCode.EVENT]: [],
            [RunnerMessageCode.PING]: [],
            [RunnerMessageCode.PANG]: [],
            [RunnerMessageCode.SNAPSHOT_RESPONSE]: [],
            [RunnerMessageCode.SEQUENCE_STOPPED]: [],
            [RunnerMessageCode.SEQUENCE_COMPLETED]: [],
            [CPMMessageCode.LOAD]: [],
            [CPMMessageCode.NETWORK_INFO]: []
        };
    }

    safeHandle(promisePotentiallyRejects: MaybePromise<any>): void {
        Promise.resolve(promisePotentiallyRejects).catch(
            // eslint-disable-next-line no-console
            (e: any) => console.error(e?.stack || e) // TODO: push this to log file
        );
    }

    getMonitorStream(): DataStream {
        return this.monitoringPassThrough.pipe(new DataStream());
    }

    getStdio(): { stdin: Writable; stdout: Readable; stderr: Readable; } {
        if (!this.downstreams) {
            throw new Error("Streams not attached");
        }

        return {
            stdin: this.downstreams[CC.STDIN] as Writable,
            stdout: this.downstreams[CC.STDOUT] as Readable,
            stderr: this.downstreams[CC.STDERR] as Readable
        };
    }

    hookUpstreamStreams(streams: UpstreamStreamsConfig): this {
        this.upstreams = streams;
        return this;
    }

    hookDownstreamStreams(streams: DownstreamStreamsConfig): this {
        this.downstreams = streams;
        return this;
    }

    pipeMessageStreams() {
        if (this._piped)
            throw new Error("pipeMessageStreams called twice");
        this._piped = true;

        if (!this.downstreams || !this.upstreams) {
            throw new Error("Streams not hooked");
        }

        this.downstreams[CC.LOG].pipe(this.loggerPassThrough, { end: false }).pipe(this.upstreams[CC.LOG]);

        const monitoringOutput = StringStream.from(this.downstreams[CC.MONITORING] as Readable)
            .JSONParse()
            .map(async (message: EncodedMonitoringMessage) => {
                // TODO: WARN if (!this.monitoringHandlerHash[message[0]])
                if (this.monitoringHandlerHash[message[0]].length) {
                    let currentMessage = message as any;

                    for (const item of this.monitoringHandlerHash[message[0]]) {
                        const { handler, blocking } = item;
                        const result = handler(currentMessage);

                        if (blocking) currentMessage = await result;
                        else this.safeHandle(result);
                    }
                    return currentMessage as EncodedMonitoringMessage;
                }

                return message;
            })
            .pipe(this.monitoringPassThrough)
            .JSONStringify();

        monitoringOutput.pipe(this.upstreams[CC.MONITORING]);

        StringStream.from(this.upstreams[CC.CONTROL] as Readable)
            .JSONParse()
            .map(async (message: EncodedControlMessage) => {
                // TODO: WARN if (!this.controlHandlerHash[message[0]])
                if (this.controlHandlerHash[message[0]].length) {
                    let currentMessage = message as any;

                    for (const item of this.controlHandlerHash[message[0]]) {
                        const { handler, blocking } = item;
                        const result = handler(currentMessage);

                        if (blocking) currentMessage = await result;
                        else this.safeHandle(result);
                    }
                    return currentMessage as EncodedMonitoringMessage;
                }

                return message;
            })
            .pipe(this.controlPassThrough)
            .JSONStringify()
            .pipe(this.downstreams[CC.CONTROL]);

        return this;
    }

    areStreamsHooked() {
        return typeof this.upstreams !== "undefined" && typeof this.downstreams !== "undefined";
    }

    getLogOutput(): LoggerOutput {
        return { out: this.loggerPassThrough, err: this.loggerPassThrough };
    }

    pipeStdio(): this {
        if (!this.downstreams || !this.upstreams) {
            throw new Error("Streams not hooked");
        }

        this.upstreams[CC.STDIN].pipe(this.downstreams[CC.STDIN]);
        this.downstreams[CC.STDOUT].pipe(this.upstreams[CC.STDOUT]);
        this.downstreams[CC.STDERR].pipe(this.upstreams[CC.STDERR]);

        return this;
    }

    pipeDataStreams(): this {
        if (!this.downstreams || !this.upstreams) {
            throw new Error("Streams not hooked");
        }

        /**
         * @analyze-how-to-pass-in-out-streams
         * Pipe upstream input stream to a Sequence to downstream input stream.
         * Pipe downstream output stream from a Sequence to upstream output stream.
         */
        this.upstreams[CC.IN].pipe(this.downstreams[CC.IN]);
        this.downstreams[CC.OUT].pipe(this.upstreams[CC.OUT]);
        this.downstreams[CC.OUT].resume();

        if (this.upstreams[CC.PACKAGE] && this.downstreams[CC.PACKAGE] !== undefined) {
            this.upstreams[CC.PACKAGE]?.pipe(this.downstreams[CC.PACKAGE] as WritableStream<any>);
        }

        return this;
    }

    addMonitoringHandler<T extends MonitoringMessageCode>(
        _code: T,
        handler: MonitoringMessageHandler<T> | MutatingMonitoringMessageHandler<T>,
        blocking: boolean = false
    ): this {
        this.monitoringHandlerHash[_code].push({
            handler,
            blocking
        } as any);
        return this;
    }

    addControlHandler<T extends ControlMessageCode>(
        _code: T,
        handler: ControlMessageHandler<T>,
        blocking: boolean = false
    ): this {
        this.controlHandlerHash[_code].push({
            handler,
            blocking
        } as any);
        return this;
    }

    async sendMonitoringMessage<T extends MonitoringMessageCode>(code: T, msg: MessageDataType<T>): Promise<void> {
        const encoded: EncodedMonitoringMessage = [code, msg];

        await this.monitoringPassThrough.whenWrote(encoded);
    }

    async sendControlMessage<T extends ControlMessageCode>(code: T, msg: MessageDataType<T>): Promise<void> {
        const encoded: EncodedControlMessage = [code, msg];

        await this.controlPassThrough.whenWrote(encoded);
    }
}

