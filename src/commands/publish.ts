import { Command } from "commander";
import { PluginManifest, PublishData } from "../types/aliucord.js";
import prompts from "prompts";
import { getGitUrl, getLatestCommit, spinner } from "../util.js";
import * as rollupUtils from "../rollup.js";
import { OutputAsset } from "rollup";
import { fetch } from "undici";
import { SPDXLicensesInfo } from "../types/spdx.js";
import chalk from "chalk-template";
import { oneLineCommaListsAnd, stripIndent } from "common-tags";

export function register(program: Command) {
    const cwd = process.cwd();

    program
        .command("publish [plugin]")
        .description("Publishes your plugin to the aliucord plugin repo")
        .option("-c, --commit-id <sha>", "commit id to build from")
        .option("-r, --git-repo <url>", "https git url to build from")
        .option("-y, --confirm", "bypasses all confirmation prompts")
        .action(async (pluginArg, opts) => {
            // Allow cmd line options to override prompts
            prompts.override({
                ...opts,
                pluginName: pluginArg
            })
            // Show prompts
            const { pluginName, commitId, gitRepo } = await prompts([
                {
                    type: "text",
                    name: "pluginName",
                    message: "What is the name of the plugin you want to publish?"
                },
                {
                    type: "text",
                    name: "gitRepo",
                    message: "What is the https git url that this plugin can be cloned from?",
                    initial: await getGitUrl() ?? undefined
                },
                {
                    type: "text",
                    name: "commitId",
                    message: "What is the ENTIRE commit id that this plugin can be built from?",
                    validate: (t: string) => t.match(/^[a-f0-9]{40}$/) !== null ? true : "Please enter a valid git commit hash. The hash must be full, not shortened.",
                    initial: await getLatestCommit() ?? undefined
                }
            ], {
                onCancel: () => process.exit(1)
            });
            
            const { confirm: confirmBuild } = await prompts({
                type: "confirm",
                name: "confirm",
                message: "To proceed, your plugin will need to be built. This can be done automatically. Proceed?",
                initial: true
            });
            if (!confirmBuild) process.exit(1);

            const rollupConfigResult = await spinner(
                "Loading rollup configuration...", 
                () => rollupUtils.loadConfig(pluginName)
            )
            const rollupConfig = rollupConfigResult.unwrapOrElse((e: unknown) => {
                console.error(e);
                process.exit(1);
            })
            
            const pluginBuildResult = await spinner(
                "Building plugin...", 
                () => 
                    rollupUtils.runRollup(pluginName, rollupConfig)
            )
            const { outputs: pluginBuild } = pluginBuildResult.unwrapOrElse((e: unknown) => {
                console.error(e);
                process.exit(1);
            })

            const extractedManifest = (pluginBuild.find(output => output.fileName === `${pluginName}-manifest.json`) as OutputAsset).source as string
            const parsedManifest = JSON.parse(extractedManifest) as PluginManifest;

            const pluginLicenseInfo = await spinner("Fetching plugin license data from spdx...", async () => {
                const spdxLicenses = await fetch(`https://spdx.org/licenses/licenses.json`).then(res => res.json()) as SPDXLicensesInfo;
                const pluginLicenseInfo = spdxLicenses.licenses.find(l => l.licenseId === parsedManifest.license);
                if (!pluginLicenseInfo) throw new Error("Unable to find license");
                return pluginLicenseInfo;
            }).then(
                result =>
                    result.unwrapOrElse((e: unknown) => {
                        if (e instanceof Error && e.message === "Unable to find license") {
                            console.error(chalk`{redBright Unable to find the spdx license entry from your plugin's license. Make sure the license specified is a valid (case-sensitive) spdx license identifier.}`);
                        } else console.error(e);
                        process.exit(1);
                    })
            );

            const publishData: PublishData = {
                name: pluginName,
                description: parsedManifest.description,
                version: parsedManifest.version,
                authors: parsedManifest.authors,
                gitRepoUrl: gitRepo,
                commitId,
                licenseIdentifier: pluginLicenseInfo.licenseId
            };

            if (!opts.confirm) {
                console.log()
                console.log(
                    stripIndent(
                        chalk`
                            {magenta.bold Please make sure the following information is correct:}
                            Name: {yellow ${publishData.name}}
                            Description: {yellow ${publishData.description}}
                            Version: {yellow ${publishData.version}}
                            Authors: ${
                                oneLineCommaListsAnd`
                                    ${publishData.authors.map(a => chalk`{yellow ${a.name}} ({yellow ${a.id}})`)}
                                `
                            }
                            Git repo url: {yellow ${publishData.gitRepoUrl}}
                            Commit ID: {yellow ${publishData.commitId}}
                            License: {yellow ${pluginLicenseInfo.name}}
                        `
                    )
                );
                console.log();
            }

            const { confirm: confirmData } = await prompts({
                type: "confirm",
                name: "confirm",
                message: "After confirming, this data will be sent and used to add your plugin to the plugins repo. Please make sure all of the information above is correct, and then proceed. Publish this data? "
            })
        })
}