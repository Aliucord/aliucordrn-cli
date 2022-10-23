import { Command } from "commander";
import { unzip as unzipCallback, Zip, ZipPassThrough } from "fflate";
import * as openpgp from "openpgp";
import prompt from "prompts";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const unzip = promisify(unzipCallback);

export function register(program: Command) {
	program
		.command("sign")
		.description("Signs a plugin zip with a specific key")
		.argument("<file>", "The plugin file to sign")
		.argument("<key>", "The key file to sign with (may be - for stdin)")
		.option(
			"-p, --key-password <password>",
			"The password to use for signing with the key"
		)
		.action(async (plugin, key, opts: { keyPassword: string }) => {
			// Get the key data into a buffer allowing for - (stdin)
			let armoredKey: string;
			if (key === "-") {
				const chunks: Buffer[] = [];
				for await (const chunk of process.stdin) chunks.push(chunk);
				armoredKey = Buffer.concat(chunks).toString("utf8");
			} else {
				armoredKey = await fs
					.readFile(key)
					.then(buf => buf.toString("utf8"));
			}
			// Ask for the key password
			prompt.override(opts);
			const { keyPassword } = await prompt({
				name: "keyPassword",
				type: "password",
				message: "Please enter the password of the key: "
			});
			// Decrypt the key
			const privateKey = await openpgp.decryptKey({
				privateKey: await openpgp.readPrivateKey({ armoredKey }),
				passphrase: keyPassword
			});
			// Read all file data from the plugin
			const oldZip = await unzip(await fs.readFile(plugin));
			// Assemble a new zip file with the same data but signatures added in the comments of each file
			// eslint-disable-next-line no-async-promise-executor
			const newZip = await new Promise<Uint8Array>(async (res, rej) => {
				// Create a new fflate zip class mapping the callback to the promise callbacks
				const zipChunks: Uint8Array[] = [];
				const newZip = new Zip((err, data, final) => {
					if (err) rej(err);
					else if (!final) zipChunks.push(data);
					else if (final) res(Buffer.concat([...zipChunks, data]));
				});
				// Loop over old zip data, signing and adding back to the new one
				for (const [fileName, data] of Object.entries(oldZip)) {
					// Create an unsigned message
					const unsignedMessage = await openpgp.createMessage({
						text: new ReadableStream({
							start(controller) {
								controller.enqueue(data);
								controller.close();
							}
						}),
						filename: fileName,
						format: "binary"
					});
					// Sign the message (with some type fuckery because the types are borked)
					const signedMessage = (await openpgp.sign({
						message: unsignedMessage,
						signingKeys: privateKey,
						detached: true,
						format: "binary"
					})) as openpgp.WebStream<Uint8Array> & {
						[Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
					};
					// Read the output stream
					const chunks: Uint8Array[] = [];
					for await (const chunk of signedMessage) chunks.push(chunk);
					const signedData = Buffer.concat(chunks).toString("base64");
					// Create the actual compressed zip object
					const compressedData = new ZipPassThrough(fileName);
					compressedData.comment = signedData;
					// Add the compressed zip object to the zip
					newZip.add(compressedData);
					// Push the actual file data back into the new zip
					compressedData.push(data, true);
				}
				newZip.end();
			});
			await fs.writeFile("signed.zip", newZip);
		});
}
