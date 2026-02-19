import { readdirSync, readFileSync, statSync, promises as fs } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import path = require("path");
import * as vscode from "vscode";
import { Constants } from "./Constants";
import { Language } from "./Language";

const execFileAsync = promisify(execFile);

export class FileUtils {
  public static detectLanguage(path: string): Language {
    const extension: string | undefined = path.split(".").pop();
    switch (extension) {
      case undefined:
        return "Unknown";
      case "java":
        return "Java";
      case "js":
        return "JavaScript";
      case "ts":
        // case 'tsx':
        return "TypeScript";
      case "py":
        return "Python";
      default:
        return "Unknown";
    }
  }

  public static readFileContent(absPath: string): string {
    return readFileSync(absPath, "utf-8");
  }

  /**
   * Get the absolute path of conflicting files using JJ CLI or file scanning.
   *
   * Primary method: `jj resolve --list` (when scanMode is 'jj-cli')
   * Fallback method: scan files for JJ conflict markers (when scanMode is 'file-scan' or CLI fails)
   */
  public static async getConflictingFilePaths(
    directory: string,
  ): Promise<string[]> {
    const config = vscode.workspace.getConfiguration("somanyconflicts-jj");
    const scanMode = config.get<string>("scanMode", "jj-cli");

    if (scanMode === "jj-cli") {
      try {
        return await this.getConflictingFilePathsFromJJ(directory);
      } catch (err: any) {
        console.log(
          "jj resolve --list failed, falling back to file scan: " + err.message,
        );
        return this.getConflictingFilePathsFromScan(directory);
      }
    } else {
      return this.getConflictingFilePathsFromScan(directory);
    }
  }

  /**
   * Use `jj resolve --list` to find files with unresolved conflicts.
   */
  private static async getConflictingFilePathsFromJJ(
    directory: string,
  ): Promise<string[]> {
    console.log("Using jj resolve --list in: " + directory);
    const { stdout } = await execFileAsync("jj", ["resolve", "--list"], {
      cwd: directory,
    });

    const filePaths: string[] = stdout
      .split(/\r\n|\r|\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((filePath) => path.join(directory, filePath));

    return filePaths;
  }

  /**
   * Scan all files in directory for JJ conflict markers.
   */
  private static getConflictingFilePathsFromScan(directory: string): string[] {
    console.log("Scanning for JJ conflict markers in: " + directory);
    const conflictingFilePaths: string[] = [];
    const filePaths: string[] = this.listFilePathsSync(directory);
    for (const filePath of filePaths) {
      const content = this.readFileContent(filePath);
      if (content.includes(Constants.conflictMarkerStart)) {
        // Verify it's a JJ conflict (not just any line starting with <<<<<<<)
        if (Constants.conflictStartPattern.test(content)) {
          conflictingFilePaths.push(filePath);
        }
      }
    }
    return conflictingFilePaths;
  }

  private static listFilePathsSync(directory: string): string[] {
    let fileList: string[] = [];

    const files = readdirSync(directory);
    for (const file of files) {
      if (file.startsWith(".")) {
        continue;
      }
      const absPath = path.join(directory, file);
      if (statSync(absPath).isDirectory()) {
        fileList = [...fileList, ...this.listFilePathsSync(absPath)];
      } else {
        fileList.push(absPath);
      }
    }
    return fileList;
  }

  private static async listFilePaths(directory: string) {
    let fileList: string[] = [];

    const files = await fs.readdir(directory);
    for (const file of files) {
      if (file.startsWith(".")) {
        continue;
      }
      const absPath = path.join(directory, file);
      if ((await fs.stat(absPath)).isDirectory()) {
        fileList = [...fileList, ...(await this.listFilePaths(absPath))];
      } else {
        fileList.push(absPath);
      }
    }

    return fileList;
  }

  public static getFileNameFromPath(filePath: string): string {
    return path.basename(filePath);
  }
}
