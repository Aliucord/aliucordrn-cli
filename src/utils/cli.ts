import { Result } from "@sapphire/result";
import chalk from "chalk-template";
import ora from "ora";

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