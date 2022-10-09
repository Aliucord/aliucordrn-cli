import { Command } from "commander";
import { spinner } from "../utils/cli.js";
import * as rollupUtils from "../utils/rollup.js";
import chalk from "chalk-template";
import { OutputAsset } from "rollup";
import fs from "node:fs";
import path from "node:path";
import * as adbUtils from "../utils/adb.js";
import { stripIndent } from "common-tags";

export function register(program: Command) {
    const cwd = process.cwd();

    program
        .command("build <plugin>")
        .description("Builds a plugin using the rollup config in the current directory")
        .option("-o, --output <path>", "the file path to output the plugin to")
        .option("-d, --deploy", "whether or not to deploy the plugin to the connected adb device")
        .option("-p, --package <package name>", "the package to use for deploying the built plugin")
        .action(async (plugin: string, opts: { output?: string, deploy: boolean, package?: string }) => {
            console.log(chalk`{magenta.bold Building plugin ${plugin}:}`)
            const rollupConfig = await spinner(
                "Loading rollup configuration...", 
                () => rollupUtils.loadConfig(plugin)
            ).then(
                result =>
                    result.unwrapOrElse((e: unknown) => {
                        console.error(e);
                        process.exit(1);
                    })
            )
            
            const pluginBuild = await spinner(
                "Building plugin...", 
                () => 
                    rollupUtils.runRollup(plugin, rollupConfig)
            ).then(
                res =>
                    res.unwrapOrElse((e: unknown) => {
                        console.error(e);
                        process.exit(1);
                    })
            )
            const zip = pluginBuild.outputs.find(asset => asset.fileName.endsWith(".zip")) as OutputAsset;
            const rollupOutputPath = path.join(
                path.parse(
                    rollupConfig.output[0].file!
                ).dir,
                zip.fileName
            )

            if (!opts.output) {
                const parsed = path.parse(
                    rollupConfig.output[0].file!
                )
                console.log(
                    chalk`{greenBright.bold Successfully built ${plugin} to ${rollupOutputPath}}`
                )
            } else {
                await fs.promises.writeFile(opts.output, zip.source);
                console.log(
                    chalk`{greenBright.bold Successfully built ${plugin} to ${opts.output}}`
                )
            }
            // Print all captured warnings (rollup doesn't let you get the actual onwarn function so this is the best way to show warnings while handling custom handlers)
            for (const warning of pluginBuild.warnings) rollupConfig.onwarn!(warning, () => undefined);
            // Deploy the plugin if the --deploy option was specified
            if (opts.deploy) {
                console.log(opts)
                // Push the file via adb
                await spinner(
                    "Deploying via adb...", 
                    () => 
                        adbUtils.pushFile(
                            fs.createReadStream(
                                path.join(
                                    process.cwd(),
                                    rollupOutputPath
                                )
                            ), 
                            `/sdcard/AliucordRN/plugins/${zip.fileName}`
                        )
                ).then(
                    result =>
                        result.unwrapOrElse(
                            e => {
                                console.error(
                                    stripIndent(
                                        chalk`
                                            {redBright.bold Failed to push plugin to device:}
                                            {redBright ${e?.reason ?? e?.message ?? e}}
                                        `
                                    )
                                )
                                process.exit(1)
                            }
                        )
                )
                // Restart aliucordrn app
                await spinner("Restarting the aliucord app...", () => adbUtils.restartPackage(opts.package ?? "com.aliucord.rn")).then(
                    result =>
                        result.unwrapOrElse(
                            e => {
                                console.error(
                                    stripIndent(
                                        chalk`
                                            {redBright.bold Failed to restart app:}
                                            {redBright ${e?.reason ?? e?.message ?? e}}
                                        `
                                    )
                                )
                                process.exit(1)
                            }
                        )
                )

                console.log(
                    chalk`{greenBright.bold Successfully deployed ${plugin} to device.}`
                )
            }
        })
}