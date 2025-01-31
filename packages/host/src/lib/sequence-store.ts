import { DockerodeDockerHelper } from "@scramjet/adapters";
import { getLogger } from "@scramjet/logger";
import { HostError } from "@scramjet/model";
import { Sequence, ISequenceStore, STHRestAPI } from "@scramjet/types";
import { ReasonPhrases } from "http-status-codes";
import { InstanceStore } from "./instance-store";

/**
 *
 * An utility class for manipulation of the
 * Sequences stored on the CSH.
 *
 * Question: Patryk raised an issue that we should think of
 * saving the Sequence information in the file (for the future sprints)
 *
 * or, we could just try to reconnect instances after host restart.
 */
export class SequenceStore implements ISequenceStore {
    dockerHelper: DockerodeDockerHelper = new DockerodeDockerHelper();

    instancesStore = InstanceStore;

    private logger = getLogger(this);
    private sequences: Partial<Record<string, Sequence>> = {}

    getSequences(): Sequence[] {
        return Object.values(this.sequences) as Sequence[];
    }

    getById(key: string): Sequence | undefined {
        return this.sequences[key];
    }

    add(sequence: Sequence) {
        if (sequence) {
            this.sequences[sequence.id] = sequence;
        }

        this.logger.info("New sequence added:", sequence.id);
    }

    async delete(sequenceId: string): Promise<STHRestAPI.DeleteSequenceResponse> {
        if (!sequenceId) {
            return {
                opStatus: ReasonPhrases.BAD_REQUEST
            };
        }

        const sequence = this.getById(sequenceId);

        if (!sequence) {
            return {
                opStatus: ReasonPhrases.NOT_FOUND
            };
        }

        if (sequence.instances.length) {
            this.logger.warn("Can't remove sequence in use:", sequenceId);

            return {
                opStatus: ReasonPhrases.CONFLICT,
                error: "Can't remove sequence in use."
            };
        }

        const volumeId = sequence.config.packageVolumeId;

        try {
            this.logger.log("Removing volume...", volumeId);

            await this.dockerHelper.removeVolume(volumeId).catch(reason => {
                throw new HostError("CONTROLLER_ERROR", reason);
            });

            this.logger.log("Volume removed:", volumeId);

            delete this.sequences[sequenceId];

            this.logger.log("Sequence removed:", sequenceId);

            return {
                opStatus: ReasonPhrases.OK,
                id: sequenceId
            };
        } catch (error: any) {
            this.logger.error("Error removing sequence!", error);
            throw new HostError("CONTROLLER_ERROR");
        }
    }

    close() {
        return Promise.all(
            this.getSequences().map(seq => {
                return this.delete(seq.id);
            })
        );
    }
}
