import AdbKit from "@devicefarmer/adbkit"
import { ReadStream } from "node:fs";

export async function pushFile(contents: string|ReadStream, devicePath: string): Promise<void> {
    // This sucks but node won't import it without doing it like this
    const adb = AdbKit.Adb.createClient();
    const devices = await adb.listDevices().then(
        devices =>
            devices
                .filter(d => d.type !== "offline")
                .map(d => adb.getDevice(d.id))
    );
    if (devices.length < 1) throw new AdbError(AdbErrorReason.NO_DEVICES);
    if (devices.length > 1) throw new AdbError(AdbErrorReason.TOO_MANY_DEVICES);
    const device = devices[0];
    const transfer = await device.push(
        contents, 
        devicePath
    );
    await new Promise(r => transfer.on("end", r));
}

export async function restartPackage(intent: string): Promise<void> {
    const adb = AdbKit.Adb.createClient();
    const devices = await adb.listDevices().then(
        devices =>
            devices
                .filter(d => d.type !== "offline")
                .map(d => adb.getDevice(d.id))
    );
    if (devices.length < 1) throw new AdbError(AdbErrorReason.NO_DEVICES);
    if (devices.length > 1) throw new AdbError(AdbErrorReason.TOO_MANY_DEVICES);
    const device = devices[0];
    const outputStream = await device.shell(["am", "start", "-S", "-n", intent]);
    const chunks: Buffer[] = [];
    for await (const chunk of outputStream) chunks.push(chunk);
    const output = Buffer.concat(chunks).toString("utf8");
    console.log(output)
    if (output.includes("Error type 3")) { // Fairly safe way to detect package name errors
        throw new AdbError(AdbErrorReason.INVALID_PACKAGE)
    }
    await device.startActivity({})
}

// export async function findDiscordPackage(): Promise<string> {
//     const adb = AdbKit.Adb.createClient();
//     const devices = await adb.listDevices().then(
//         devices =>
//             devices
//                 .filter(d => d.type !== "offline")
//                 .map(d => adb.getDevice(d.id))
//     );
//     if (devices.length < 1) throw new AdbError(AdbErrorReason.NO_DEVICES);
//     if (devices.length > 1) throw new AdbError(AdbErrorReason.TOO_MANY_DEVICES);
//     const device = devices[0];
//     const packages = await device.getPackages();
//     for (const appPackage of packages) {
//         await device.
//     }
// }

export class AdbError extends Error {
    constructor(public reason: AdbErrorReason) {
        super(reason);
    }
}

export enum AdbErrorReason {
    NO_DEVICES = "There are no devices connected via adb",
    TOO_MANY_DEVICES = "There is more than one device connected via adb",
    INVALID_PACKAGE = "The package name did not exist. A non-default one can be specified with the --package option"
}