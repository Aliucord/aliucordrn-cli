import ora from "ora";
import { Result } from "@sapphire/result";
import chalk from "chalk-template";
import { promisify } from "node:util";
import { exec as execCallback } from "child_process";

const exec = promisify(execCallback);
const remoteRegex = /^(?<name>.+)\t(?<url>.+) \((?<type>push|fetch)\)$/;

/**
 * Runs some code, adding a visual spinner and automatically handling success/fail
 * @param text The text to be used for the spinner
 * @param func The code to run while spinning.
 */
export async function spinner<T, E>(text: string, func: () => T): Promise<Result<Awaited<T>, E>> {
    const spinner = ora(chalk`{bold ${text}}`).start();
    const funcResult = await Result.fromAsync<T, E>(func);
    if (funcResult.isErr()) {
        spinner.fail(spinner.text + chalk` {redBright Failed}`);
    } else {
        spinner.succeed(spinner.text + chalk` {greenBright Done}`);
    }

    return funcResult as Result<Awaited<T>, E>;
}

export async function getGitUrl(): Promise<string|null> {
    const remotes = await exec("git remote -v").then(
        output => 
            output
            .stdout
            .trimEnd()
            .split("\n") // Split into array
            .map(e => e.match(remoteRegex)) // Parse all lines
            .filter(e => e !== null) as RegExpMatchArray[] // Filter out all non-null elements
    )
    let remote: RegExpMatchArray;
    if (remotes.length === 1) {
        remote = remotes[0]; // Use only remote if exists
    } else if (remotes.length < 1) {
        return null; // Return null if no remotes exist
    } else if (remotes.find(r => r.groups!.name === "origin")) {
        remote = remotes.find(r => r.groups!.name === "origin")!; // Prioritize remote named "origin"
    } else {
        // Otherwise, check the current upstream
        const branch = await exec("git branch --show-current")
            .then(output => output.stdout.trimEnd())
        const upstreamRemote = await exec(`git config --get branch.${branch}.remote`)
            .then(output => output.stdout.trimEnd())
            .catch(() => null) // If comman fails, replace with null
        if (upstreamRemote === null) return null;
        else remote = remotes.find(r => r.groups!.name === upstreamRemote)!;
    }
    // Check if remote is an ssh remote
    const url = remote.groups!.url;
    if (url.startsWith("git@")) {
        const parsed = /^git@(?<domain>[\w.]+):(?<repo>.+)/.exec(url)
        if (!parsed) return null;
        return `https://${parsed.groups!.domain}/${parsed.groups!.repo}`
    } else if (url.startsWith("http")) {
        return url;
    } else return null;
}

export async function getLatestCommit(): Promise<string|null> {
    return await exec("git rev-parse HEAD").then(o => o.stdout.trimEnd())
}