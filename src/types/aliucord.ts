/**
 * All the data that is sent to the workflow that is used to create a pr
 */
export interface PublishData {
	name: string;
	description: string;
	version: string;
	authors: {
		id: string;
		name: string;
	}[];
	licenseIdentifier: string;
	gitRepoUrl: string;
	commitId: string;
}

/**
 * An interface for the aliucord plugin manifests built with plugins
 */
export interface PluginManifest {
	authors: {
		id: string;
		name: string;
	}[];
	license: string;
	version: string;
	description: string;
	name: string;
}
