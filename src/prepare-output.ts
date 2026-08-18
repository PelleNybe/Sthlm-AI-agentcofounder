import { cp, lstat, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MARKER = ".agent-cofounder-output";

function isInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function prepareOutput(
  repositoryRoot: string,
  requestedOutputDirectory: string,
): Promise<string> {
  const outputRoot = path.resolve(repositoryRoot, "output");
  const outputDirectory = path.resolve(repositoryRoot, requestedOutputDirectory);
  if (!isInside(outputRoot, outputDirectory)) {
    throw new Error(`Output directory must be a child of ${outputRoot}`);
  }

  for (const staleResult of [
    path.join(repositoryRoot, "result.json"),
    path.join(outputRoot, "result.json"),
  ]) {
    try {
      await unlink(staleResult);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  let outputExists = false;
  try {
    const stat = await lstat(outputDirectory);
    outputExists = true;
    if (stat.isSymbolicLink()) throw new Error("Refusing to reset a symbolic-link output directory");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (outputExists) {
    let marker: string;
    try {
      marker = await readFile(path.join(outputDirectory, MARKER), "utf8");
    } catch {
      throw new Error(`Refusing to reset unrecognized directory: ${outputDirectory}`);
    }
    if (marker.trim() !== "managed by agent-cofounder-starter") {
      throw new Error(`Refusing to reset unrecognized directory: ${outputDirectory}`);
    }
    await rm(outputDirectory, { recursive: true });
  }

  await mkdir(outputDirectory, { recursive: true });
  await cp(path.join(repositoryRoot, "app-template"), outputDirectory, {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes("node_modules") && !source.endsWith(`${path.sep}dist`),
  });
  await writeFile(path.join(outputDirectory, MARKER), "managed by agent-cofounder-starter\n", "utf8");
  return outputDirectory;
}
