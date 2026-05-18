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
	restraintBackboneForce: number;
	restraintGlobalForce: number;
	restraintBasePairsForce: number;
	rmsdCutoff: number;
	simOnlyFragment?: boolean;
};

export type SimJobResult = {
	simPath: string;
	targetPdbPath: string;
};

type DnatcoJobState = {
	state?: string;
	failedReason?: string | null;
	returnvalue?: {
		outputDir?: string;
		producedFiles?: string[];
	} | null;
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

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDnatcoBaseUrl() {
	return process.env.DNATCO_BASE_URL ?? "http://dnatco:3001";
}

async function requestDnatcoAnalysis(environmentPath: string, coordsPath: string) {
	const response = await fetch(`${getDnatcoBaseUrl()}/dnatco-jobs`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			environmentPath,
			coordsPath,
			outputDirName: "dnatco",
			report: false,
			reportText: false,
			ntcCsv: true,
			ntcJson: false,
		}),
	});

	if (!response.ok) {
		throw new Error(`DNATCO request failed with HTTP ${response.status}`);
	}

	const payload = await response.json() as { jobId?: string };
	if (!payload.jobId) {
		throw new Error("DNATCO response did not include jobId");
	}

	return String(payload.jobId);
}

async function waitForDnatcoJob(jobId: string) {
	const timeoutMs = Number(process.env.DNATCO_JOB_TIMEOUT_MS ?? 30 * 60 * 1000);
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const response = await fetch(`${getDnatcoBaseUrl()}/dnatco-jobs/${encodeURIComponent(jobId)}`);
		if (!response.ok) {
			throw new Error(`DNATCO status request failed with HTTP ${response.status}`);
		}

		const payload = await response.json() as DnatcoJobState;
		if (payload.state === "completed") {
			return payload.returnvalue?.outputDir ?? null;
		}

		if (payload.state === "failed") {
			throw new Error(payload.failedReason ?? `DNATCO job ${jobId} failed`);
		}

		await sleep(2000);
	}

	throw new Error(`Timed out waiting for DNATCO job ${jobId}`);
}

async function ensureDnatcoAnalysis(environmentPath: string, coordsPath: string) {
	const outputDir = path.join(environmentPath, "dnatco");
	const assignedNtcs = path.join(outputDir, "custom_assigned_ntcs.csv");

	console.log("[sim] DNATCO: submitting analysis job...");
	const jobId = await requestDnatcoAnalysis(environmentPath, coordsPath);
	console.log(`[sim] DNATCO: waiting for job ${jobId} to finish...`);
	await waitForDnatcoJob(jobId);

	await fs.access(assignedNtcs);
	return assignedNtcs;
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	label: string,
	options?: {
		logStdout?: boolean;
		logStderr?: boolean;
		logFilePath?: string;
		maxBuffer?: number;
	},
) {
	const logStdout = options?.logStdout ?? true;
	const logStderr = options?.logStderr ?? true;
	const logFilePath = options?.logFilePath;
	const maxBuffer = options?.maxBuffer ?? 50 * 1024 * 1024;

	try {
		const { stdout, stderr } = await execFileAsync(command, args, { cwd, maxBuffer });
		if (logFilePath) {
			const rendered = [
				`[${label}] command: ${command} ${args.join(" ")}`,
				"",
				"=== STDOUT ===",
				stdout ?? "",
				"",
				"=== STDERR ===",
				stderr ?? "",
			].join("\n");
			await fs.writeFile(logFilePath, rendered, "utf8");
		}
		if (logStdout && stdout?.trim()) {
			console.log(`[${label}] stdout:\n${stdout}`);
		}
		if (logStderr && stderr?.trim()) {
			console.log(`[${label}] stderr:\n${stderr}`);
		}
	} catch (error) {
		let details = error instanceof Error ? error.message : String(error);
		let stdout = "";
		let stderr = "";
		if (typeof error === "object" && error !== null) {
			stdout = "stdout" in error ? String(error.stdout ?? "") : "";
			stderr = "stderr" in error ? String(error.stderr ?? "") : "";
			if (stdout.trim()) {
				details += `\nstdout:\n${stdout}`;
			}
			if (stderr.trim()) {
				details += `\nstderr:\n${stderr}`;
			}
		}
		if (logFilePath) {
			const rendered = [
				`[${label}] command: ${command} ${args.join(" ")}`,
				"",
				"=== STDOUT ===",
				stdout,
				"",
				"=== STDERR ===",
				stderr,
			].join("\n");
			await fs.writeFile(logFilePath, rendered, "utf8");
		}
		throw new Error(`[${label}] command failed: ${details}`);
	}
}

type ModelAnnotationRecord = {
	name?: string;
};

function toValidSegmentName(rawName: string | undefined) {
	const normalized = (rawName ?? "")
		.trim()
		.toUpperCase()
		.replaceAll(/[^A-Z0-9]/g, "")
		.slice(0, 4);

	return normalized || "S";
}

function toPdbChainId(rawName: string) {
	return rawName.trim().charAt(0);
}

function makeUniqueSegmentName(baseSegmentName: string, used: Set<string>) {
	if (!used.has(baseSegmentName)) {
		used.add(baseSegmentName);
		return baseSegmentName;
	}

	for (let i = 1; i <= 9; i += 1) {
		const candidate = `${baseSegmentName.slice(0, 3)}${i}`;
		if (!used.has(candidate)) {
			used.add(candidate);
			return candidate;
		}
	}

	let fallbackIndex = used.size + 1;
	while (true) {
		const candidate = `S${String(fallbackIndex).slice(-3)}`;
		if (!used.has(candidate)) {
			used.add(candidate);
			return candidate;
		}
		fallbackIndex += 1;
	}
}

async function getChainNamesFromAnnotation(modelsPath: string, modelNumber: string) {
	const annotationPath = path.join(modelsPath, `${modelNumber}_annotation.json`);

	try {
		const raw = await fs.readFile(annotationPath, "utf8");
		const parsed = JSON.parse(raw) as ModelAnnotationRecord[];
		if (!Array.isArray(parsed)) {
			return ["S"];
		}

		const names = parsed
			.map((entry) => entry?.name?.trim() ?? "")
			.filter((name) => name.length > 0);

		if (names.length === 0) {
			return ["S"];
		}

		const unique = new Set<string>();
		for (const name of names) {
			unique.add(name);
		}

		return [...unique];
	} catch (error) {
		console.warn(`[sim] Could not read chain names from ${annotationPath}. Falling back to segment S.`, error);
		return ["S"];
	}
}

async function ensureSelectedResidues(modelsPath: string, envPath: string, modelNumber: string) {
	const selectedPath = path.join(modelsPath, `${modelNumber}_residues.json`);

	try {
 		await fs.access(selectedPath);
 		return;
 	} catch (err) {
 		// missing, try to reconstruct from results
 	}

 	const resultsPath = path.join(envPath, `${modelNumber}_results.json`);
 	try {
 		const resultsRaw = await fs.readFile(resultsPath, "utf-8");
 		const results = JSON.parse(resultsRaw) as any;
 		const items = Array.isArray(results?.data) ? results.data : [];
 		const recovered = items
 			.filter((r: any) => r && r.selected)
 			.map((r: any) => ({
 				chainID: r.chainID ?? r.original_chain_id ?? "A",
 				residueID: Number(r.residue_number ?? r.original_index ?? r.index),
 			}));
 		if (recovered.length > 0) {
 			await fs.mkdir(modelsPath, { recursive: true });
 			await fs.writeFile(selectedPath, JSON.stringify(recovered, null, 2), "utf-8");
 			console.log(`[sim] Recovered selected residues to ${selectedPath}`);
 		}
 	} catch (err2) {
 		// ignore if results file missing or invalid; downstream code will handle absence
 	}
}

type PreparedChain = {
	segmentName: string;
	pdbChainId: string;
	pdbFileName: string;
};

function isPdbChainScopedRecord(line: string) {
	return line.startsWith("ATOM  ")
		|| line.startsWith("HETATM")
		|| line.startsWith("ANISOU")
		|| line.startsWith("TER   ");
}

function getPdbLineChainId(line: string) {
	return (line[21] ?? "").trim();
}

async function preparePdbFilesForChains(
	simPath: string,
	simModelPath: string,
	chainNames: string[],
) {
	const baseFileName = path.basename(simModelPath);
	const baseName = path.basename(simModelPath, path.extname(simModelPath));
	const extension = path.extname(simModelPath);
	const usedSegments = new Set<string>();

	const chains: PreparedChain[] = chainNames.map((chainName) => {
		const segmentBase = toValidSegmentName(chainName);
		const segmentName = makeUniqueSegmentName(segmentBase, usedSegments);
		const pdbChainId = toPdbChainId(chainName);

		return {
			segmentName,
			pdbChainId,
			pdbFileName: baseFileName,
		};
	});

	if (chains.length <= 1) {
		return chains;
	}

	const pdbContent = await fs.readFile(simModelPath, "utf8");
	const pdbLines = pdbContent.split(/\r?\n/);

	for (const chain of chains) {
		const splitFileName = `${baseName}_${chain.pdbChainId || "S"}${extension}`;
		const splitPath = path.join(simPath, splitFileName);
		const outputLines: string[] = [];
		let matched = 0;

		for (const line of pdbLines) {
			if (isPdbChainScopedRecord(line)) {
				if (getPdbLineChainId(line) === chain.pdbChainId) {
					outputLines.push(line);
					matched += 1;
				}
			} else {
				outputLines.push(line);
			}
		}

		if (matched === 0) {
			throw new Error(`[sim] Chain ${chain.pdbChainId || "<empty>"} from annotation not found in ${baseFileName}`);
		}

		await fs.writeFile(splitPath, `${outputLines.join("\n")}\n`, "utf8");
		chain.pdbFileName = splitFileName;
	}

	return chains;
}

function buildPsfgenSegmentBlocks(chains: PreparedChain[]) {
	return chains
		.map(
			(chain) => `segment ${chain.segmentName} {\n    pdb ${chain.pdbFileName}\n}\n\ncoordpdb ${chain.pdbFileName} ${chain.segmentName}`,
		)
		.join("\n\n");
}

export async function processSimJob(data: SimJobData): Promise<SimJobResult> {
	const envPath = path.resolve(data.environmentPath);
	const simPath = path.join(envPath, `${data.modelNumber}_sim`);
	const modelsPath = path.join(envPath, "models");
	const scriptsPath = process.env.SIM_SCRIPTS_PATH ?? "/webserver/scripts";

	console.log("[sim-worker] Running simulation with parameters:", {
		environmentPath: data.environmentPath,
		modelNumber: data.modelNumber,
		restraintBackboneForce: data.restraintBackboneForce,
		restraintGlobalForce: data.restraintGlobalForce,
		restraintBasePairsForce: data.restraintBasePairsForce,
		rmsdCutoff: data.rmsdCutoff,
	});

	const sourceModel = path.join(modelsPath, `${data.modelNumber}.pdb`);
	const sourceModelPairs = path.join(modelsPath, `${data.modelNumber}_pairs.resid`);
	const sourceModelSelectedResidues = path.join(modelsPath, `${data.modelNumber}_residues.json`);

	// Ensure selected residues JSON exists (recover from results if missing)
	await ensureSelectedResidues(modelsPath, envPath, data.modelNumber);
	const sourceModelNtcs = await ensureDnatcoAnalysis(envPath, path.relative(envPath, sourceModel));
	const chainNames = await getChainNamesFromAnnotation(modelsPath, data.modelNumber);
	const simModel = path.join(simPath, `${data.modelNumber}.pdb`);
	const sourcePsfgen = path.join(scriptsPath, "psfgen.tcl");
	const simPsfgen = path.join(simPath, "psfgen.tcl");
	const sourceNamd = path.join(scriptsPath, "namd.script");
	const simNamd = path.join(simPath, "namd.script");
	const vmdLogPath = path.join(simPath, "vmd.log");
	const outputPdb = path.join(simPath, "output.pdb");
	const outputPsf = path.join(simPath, "output.psf");
	const targetPdb = path.join(simPath, "target.pdb");
	const restraintsScript = path.join(scriptsPath, "run_restraints_single.py");
	const exportPDBScript = path.join(scriptsPath, "export_first_rmsd_threshold_single.py");
	const exportLogPath = path.join(simPath, "export_first_rmsd_threshold_single.log");
	const resultPdb = path.join(simPath, `${data.modelNumber}_sim.pdb`);

	await fs.rm(simPath, { recursive: true, force: true });
	await fs.mkdir(simPath, { recursive: true });
	await fs.copyFile(sourceModel, simModel);
	await fs.copyFile(sourcePsfgen, simPsfgen);
	await fs.copyFile(sourceNamd, simNamd);

	const preparedChains = await preparePdbFilesForChains(simPath, simModel, chainNames);
	const segmentBlocks = buildPsfgenSegmentBlocks(preparedChains);

	const psfgenTemplate = await fs.readFile(simPsfgen, "utf8");
	const psfgenPrepared = psfgenTemplate.replaceAll("<segment_blocks>", segmentBlocks);
	await fs.writeFile(simPsfgen, psfgenPrepared, "utf8");

	console.log("[sim] VMD: generowanie plikow output.pdb oraz output.psf z szablonu psfgen.tcl...");
	await runCommand("vmd", ["-dispdev", "text", "-e", "psfgen.tcl"], simPath, "vmd", {
		logStdout: false,
		logStderr: true,
		logFilePath: vmdLogPath,
	});

	await fs.copyFile(outputPdb, targetPdb);

	console.log("[sim] NAMD: uruchamianie restrykcji i symulacji przez run_restraints_single.py...");
	await runCommand(
		"python",
		[
			restraintsScript,
			"--namd-bin",
			"namd3",
			"--templates-dir",
			"/webserver/scripts/ntc_templates",
			"--base-pair-templates-dir",
			"/webserver/scripts/base_pair_templates",
			"--generator-script",
			"/webserver/scripts/generate_colvars_combined.py",
			data.simOnlyFragment && "--residues-json",
			data.simOnlyFragment && sourceModelSelectedResidues,
			"--pairs",
			sourceModelPairs,
			"--csv",
			sourceModelNtcs,
			"--zero-psf-charges",
			"--global-force-constant",
			String(data.restraintGlobalForce),
			"--pairs-force-constant",
			String(data.restraintBasePairsForce),
			"--backbone-force-constant",
			String(data.restraintBackboneForce),
			"--outputname",
			"sim",
		],
		simPath,
		"run_restraints_single",
	);

	const dcdFilePath = path.join(simPath, "sim.dcd");

	console.log("[sim] NAMD: eksport pierwszej klatki spelniajacej prog RMSD do pliku PDB...");
	await runCommand(
		"python",
		[
			exportPDBScript,
			"--dcd",
			dcdFilePath,
			"--threshold",
			String(data.rmsdCutoff),
			"--psf",
			outputPsf,
			"--reference",
			outputPdb,
			"--selection",
			"nucleic and noh",
			"--out-pdb",
			resultPdb,
		],
		simPath,
		"export_first_rmsd_threshold_single",
		{
			logFilePath: exportLogPath,
		},
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
