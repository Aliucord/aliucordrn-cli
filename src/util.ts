import ora from "ora";
import { Result } from "@sapphire/result";
import chalk from "chalk-template";
import Git from "nodegit";
import { ReadStream } from "node:fs";

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
    const repo = await Git.Repository.open(
        process.cwd()
    )
    const remotes = await repo.getRemotes();
    const origin = remotes.find(r => r.name() === "origin");
    let remote: Git.Remote;
    if (remotes.length === 1) {
        remote = remotes[0];
    } else if (remotes.length < 1) {
        return null;
    } else if (origin) {
        remote = origin;
    } else {
        // Otherwise, check the current upstream
        const upstreamRef = await Git.Branch.remoteName(
            repo,
            await Git.Branch.upstream(
                await repo.getCurrentBranch()
            ).then(ref => ref.name())
        )
        const branchRemote = remotes.find(r => r.name() === upstreamRef)
        if (!branchRemote) return null;
        remote = branchRemote;
    }
    // Check if remote is an ssh remote
    const url = remote.url();
    if (url.startsWith("git@")) {
        const parsed = /^git@(?<domain>[\w.]+):(?<repo>.+)/.exec(url)
        if (!parsed) return null;
        return `https://${parsed.groups!.domain}/${parsed.groups!.repo}`
    } else if (url.startsWith("http")) {
        return url;
    } else return null;
}

export async function getLatestCommit(): Promise<string|null> {
    const repo = await Git.Repository.open(
        process.cwd()
    );
    const head = await repo.getHeadCommit();
    return head.sha();
}