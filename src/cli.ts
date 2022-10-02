import { Command, program } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

program
    .name("Aliucord CLI")
    .description("A CLI to make developing aliucord plugins easier")
    .version("1.0.0");

// Dynamically register all commands in the commands folder
const commands = await fs.opendir(
    path.join(
        url.fileURLToPath(new URL('.', import.meta.url)), 
        "commands"
    )
)

for await (const commandFile of commands) {
    const exported: { register: (program: Command) => unknown } = await import(
        path.join(
            url.fileURLToPath(new URL('.', import.meta.url)), 
            "commands",
            commandFile.name
        )
    );
    await exported.register(program);
}

program.parse();