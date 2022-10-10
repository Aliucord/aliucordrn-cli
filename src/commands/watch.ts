import chalk from "chalk-template";
import { Command } from "commander";
import { stripIndent } from "common-tags";
import path from "node:path";
import { OutputAsset } from "rollup";
import * as rollupUtils from "../utils/rollup.js";
import { spinner } from "../utils/cli.js";

export function register(program: Command) {
	program
		.command("watch <plugin>")
		.description(
			"Watches a plugin using the rollup config in the current directory"
		)
		.action(async (plugin: string) => {
			const rollupConfig = await spinner(
				"Loading rollup configuration...",
				() => rollupUtils.loadConfig(plugin)
			).then(result =>
				result.unwrapOrElse((e: unknown) => {
					console.error(e);
					process.exit(1);
				})
			);

			console.log(
				chalk`{greenBright.bold Started watching plugin ${plugin}}`
			);

			for await (const data of rollupUtils.watchRollup(
				plugin,
				rollupConfig
			)) {
				const zip = data.outputs.find(asset =>
					asset.fileName.endsWith(".zip")
				) as OutputAsset;

				const parsed = path.parse(rollupConfig.output[0].file!);

				console.log(chalk`\n{magenta.bold Build #${data.i}:}`);
				console.log(
					stripIndent(
						chalk`
                            {greenBright.bold Successfully built ${plugin} to ${path.join(
							parsed.dir,
							zip.fileName
						)} in ${data.duration}ms}
                            {yellow.bold Warnings:}
                        `
					)
				);
				for (const warning of data.warnings)
					rollupConfig.onwarn!(warning, () => undefined);
			}
		});
}
