import * as rollup from "rollup";
import type { MergedRollupOptions, RollupWarning } from "rollup";
import loadAndParseConfigFile from "rollup/loadConfigFile";
import path, { resolve } from "node:path";

export type RollupGenerated = [rollup.OutputChunk, ...(rollup.OutputChunk | rollup.OutputAsset)[]];

export async function loadConfig(plugin: string): Promise<MergedRollupOptions> {
    process.env.plugin = plugin;
    const options = await loadAndParseConfigFile(
        path.join(
            process.cwd(),
            "rollup.config.ts"
        ),
        { configPlugin: "@rollup/plugin-typescript" }
    ).then(c => c.options[0]);
    delete process.env.plugin;
    return options;
}

export async function runRollup(plugin: string, options: MergedRollupOptions) {
    // Set plugin env variable because that is how aliu rollup is setup
    process.env.plugin = plugin;
    // Create the bundle, capturing warnings
    const warnings: RollupWarning[] = [];

    process.stdout
    const bundle = await rollup.rollup({
        ...options,
        onwarn: (warning, original) => {
            warnings.push(warning);
        }
    });

    // Generate the actual output
    const outputsResult = await bundle.generate(options.output[0]);
    // Remove env var
    delete process.env.plugin;
    // Return output data
    return {
        outputs: outputsResult.output,
        warnings
    };
}

export async function *watchRollup(plugin: string, options: MergedRollupOptions) {
    // Set plugin env variable because that is how aliu rollup is setup
    process.env.plugin = plugin;
    // Create watcher
    let warnings: RollupWarning[] = [];
    const watcher = rollup.watch({
        ...options,
        watch: {
            clearScreen: false,
            skipWrite: true
        },
        onwarn: (warning, original) => {
            warnings.push(warning);
        }
    });
    // Define a closed variable to stop the loop
    let closed = false;
    // Register a finished callback
    watcher.on("close", () => {
        delete process.env.plugin;
        closed = true
    });
    // Define an iteration counter
    let i = 0;
    // Register an event callback
    while (!closed) {
        i++;
        yield await new Promise<{ duration: number, outputs: RollupGenerated, warnings: RollupWarning[], i: number }>(r => {
            const callback = async (e: rollup.RollupWatcherEvent) => {
                if (e.code === "BUNDLE_END") {
                    watcher.removeListener("event", callback);
                    const written = await e.result.write(options.output[0]);
                    const warningsCopy = [...warnings];
                    warnings = [];
                    r({
                        duration: e.duration,
                        outputs: written.output,
                        warnings: warningsCopy,
                        i
                    })
                }
            };
            watcher.on("event", callback);
        })
    }
}