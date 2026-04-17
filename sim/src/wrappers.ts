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
	options?: {
		logStdout?: boolean;
		logStderr?: boolean;
	},
) {
	const logStdout = options?.logStdout ?? true;
	const logStderr = options?.logStderr ?? true;

	try {
		const { stdout, stderr } = await execFileAsync(command, args, { cwd });
		if (logStdout && stdout?.trim()) {
			console.log(`[${label}] stdout:\n${stdout}`);
		}
		if (logStderr && stderr?.trim()) {
			console.log(`[${label}] stderr:\n${stderr}`);
		}
	} catch (error) {
		let details = error instanceof Error ? error.message : String(error);
		if (typeof error === "object" && error !== null) {
			const stdout = "stdout" in error ? String(error.stdout ?? "") : "";
			const stderr = "stderr" in error ? String(error.stderr ?? "") : "";
			if (stdout.trim()) {
				details += `\nstdout:\n${stdout}`;
			}
			if (stderr.trim()) {
				details += `\nstderr:\n${stderr}`;
			}
		}
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
	const outputPsf = path.join(simPath, "output.psf");
	const targetPdb = path.join(simPath, "target.pdb");
	const restraintsScript = path.join(scriptsPath, "run_restraints_single.py");
	const exportPDBScript = path.join(scriptsPath, "export_first_rmsd_threshold_single.py");
	const resultPdb = path.join(simPath, `${data.modelNumber}_sim.pdb`);

	await fs.mkdir(simPath, { recursive: true });
	await fs.copyFile(sourceModel, simModel);
	await fs.copyFile(sourcePsfgen, simPsfgen);
	await fs.copyFile(sourceNamd, simNamd);

	const psfgenTemplate = await fs.readFile(simPsfgen, "utf8");
	const psfgenPrepared = psfgenTemplate.replaceAll("<input>", path.basename(simModel));
	await fs.writeFile(simPsfgen, psfgenPrepared, "utf8");

	console.log("[sim] VMD: generowanie plikow output.pdb oraz output.psf z szablonu psfgen.tcl...");
	await runCommand("vmd", ["-dispdev", "text", "-e", "psfgen.tcl"], simPath, "vmd", {
		logStdout: false,
		logStderr: true,
	});

	await fs.copyFile(outputPdb, targetPdb);

	console.log("[sim] NAMD: uruchamianie restrykcji i symulacji przez run_restraints_single.py...");
	await runCommand(
		"python",
		[restraintsScript, 
      "--namd-bin", "namd3",
      "--templates-dir", "/webserver/scripts/ntc_templates",
      "--base-pair-templates-dir", "/webserver/scripts/base_pair_templates",
      "--generator-script", "/webserver/scripts/generate_colvars_combined.py",
      "--pairs", sourceModelPairs,
      "--csv", sourceModelNtcs,
	  "--outputname", "sim"],
		simPath,
		"run_restraints_single",
	);

	const dcdFilePath = path.join(simPath, "sim.dcd");

	console.log("[sim] NAMD: eksport pierwszej klatki spelniajacej prog RMSD do pliku PDB...");
	await runCommand(
		"python",
		[exportPDBScript,
			"--dcd", dcdFilePath,
			"--threshold", "0.4",
			"--psf", outputPsf,
			"--reference", outputPdb,
			"--selection", "nucleic and noh",
			"--out-pdb", resultPdb],
		simPath,
		"export_first_rmsd_threshold_single",
	);

	return {
		simPath,
		targetPdbPath: resultPdb,
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
