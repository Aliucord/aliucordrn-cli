declare module "rollup/loadConfigFile" {
    import { MergedRollupOptions, RollupWarning } from "rollup";

    /**
     * Copy pasted from rollup source, its not exported for some reason
     */
    interface BatchWarnings {
        add: (warning: RollupWarning) => void;
        readonly count: number;
        flush: () => void;
        readonly warningOccurred: boolean;
    }

    export default function loadAndParseConfigFile(
        fileName: string,
        commandOptions: any
    ): Promise<{ options: MergedRollupOptions[]; warnings: BatchWarnings }>
}