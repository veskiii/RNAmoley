import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { Queue, type ConnectionOptions, type JobsOptions, Worker } from "bullmq";

const execFileAsync = promisify(execFile);

export const simQueueName = "sim-jobs";

export type SimJobData = {
	environmentPath: string;
	modelNumber: string;
};

export type SimJobResult = {
	simPath: string;
	targetPdbPath: string;
};

export const redisConnection: ConnectionOptions = {
	host: process.env.REDIS_HOST ?? "127.0.0.1",
	port: Number(process.env.REDIS_PORT ?? 6379),
};

export const simQueue = new Queue<SimJobData, SimJobResult>(simQueueName, {
	connection: redisConnection,
});

export async function enqueueSimJob(
	data: SimJobData,
	options?: JobsOptions,
) {
	return simQueue.add("prepare-and-run", data, options);
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	label: string,
) {
	try {
		const { stdout, stderr } = await execFileAsync(command, args, { cwd });
		if (stdout?.trim()) {
			console.log(`[${label}] stdout:\n${stdout}`);
		}
		if (stderr?.trim()) {
			console.log(`[${label}] stderr:\n${stderr}`);
		}
	} catch (error) {
		const details = error instanceof Error ? error.message : String(error);
		throw new Error(`[${label}] command failed: ${details}`);
	}
}

export async function processSimJob(data: SimJobData): Promise<SimJobResult> {
	const envPath = path.resolve(data.environmentPath);
	const simPath = path.join(envPath, "sim");
	const modelsPath = path.join(envPath, "models");
	const scriptsPath = process.env.SIM_SCRIPTS_PATH ?? "/webserver/scripts";

	const sourceModel = path.join(modelsPath, `${data.modelNumber}.pdb`);
  const sourceModelPairs = path.join(modelsPath, `${data.modelNumber}_pairs.resid`);
  const sourceModelNtcs = path.join(modelsPath, `${data.modelNumber}_assigned_ntcs.csv`);
	const simModel = path.join(simPath, `${data.modelNumber}.pdb`);
	const sourcePsfgen = path.join(scriptsPath, "psfgen.tcl");
	const simPsfgen = path.join(simPath, "psfgen.tcl");
  const sourceNamd = path.join(scriptsPath, "namd.script");
	const simNamd = path.join(simPath, "namd.script");
	const outputPdb = path.join(simPath, "output.pdb");
	const targetPdb = path.join(simPath, "target.pdb");
	const restraintsScript = path.join(scriptsPath, "run_restraints_single.py");

	await fs.mkdir(simPath, { recursive: true });
	await fs.copyFile(sourceModel, simModel);
	await fs.copyFile(sourcePsfgen, simPsfgen);
	await fs.copyFile(sourceNamd, simNamd);

	const psfgenTemplate = await fs.readFile(simPsfgen, "utf8");
	const psfgenPrepared = psfgenTemplate.replaceAll("<input>", path.basename(simModel));
	await fs.writeFile(simPsfgen, psfgenPrepared, "utf8");

	await runCommand("vmd", ["-dispdev", "text", "-e", "psfgen.tcl"], simPath, "vmd");

	await fs.copyFile(outputPdb, targetPdb);

	await runCommand(
		"python",
		[restraintsScript, 
      "--namd-bin", "namd3",
      "--templates-dir", "/webserver/scripts/ntc_templates",
      "--base-pair-templates-dir", "/webserver/scripts/base_pair_templates",
      "--generator-script", "/webserver/scripts/generate_colvars_combined.py",
      "--pairs", sourceModelPairs,
      "--csv", sourceModelNtcs],
		simPath,
		"run_restraints_single",
	);

	return {
		simPath,
		targetPdbPath: targetPdb,
	};
}

export function createSimWorker(connection: ConnectionOptions = redisConnection) {
	return new Worker<SimJobData, SimJobResult>(
		simQueueName,
		async (job) => processSimJob(job.data),
		{
			connection,
			concurrency: Number(process.env.SIM_WORKER_CONCURRENCY ?? 1),
		},
	);
}
