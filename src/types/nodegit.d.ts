import Git from "nodegit";

declare module "nodegit" {
    export class Branch {
        static remoteName(repo: Git.Repository, refName: string): Promise<string>
    }
}