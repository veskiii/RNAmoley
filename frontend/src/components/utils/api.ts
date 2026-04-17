import { API_URL } from "../../App";
import { ChainElement, Job, JobToPost } from "./types";

//const API_URL = "https://rnamoley.cs.put.poznan.pl/api/v1";
// const API_URL = "http://restapi/api/v1";

export const createJob = async (formData: FormData): Promise<any> => {
  const response = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(errorData || "Unknown error");
  }
  return response.json();
};

export const fetchJobCreation = async (jobID: string | undefined): Promise<any> => {
  if (!jobID) {
    throw new Error("Job ID is required");
  }
  const response = await fetch(`${API_URL}/jobs/${jobID}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch job: ${response.statusText}`);
  }
  return response.json();
};

export async function fetchJobData(
  jobID: string | undefined,
  model: number = 1
): Promise<Job> {
  try {
    const response = await fetch(`${API_URL}/jobs/${jobID}/${model}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error in fetchMyData:", error);
    throw error;
  }
}

export async function fetchMyData(jobID: string | undefined, modelNumber: number) {
  console.log(`Sending request to /api/v1/jobs/${jobID}/${modelNumber}`);

  // TODO: czy tego potrzebuje? Wywalilo bez powodu
  // Safari doesnt support AbortSignal
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${API_URL}/jobs/${jobID}/${modelNumber}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log("Fetch data response: " + response.status);
    return response;
  } catch (error) {
    console.error("Failed to fetch data:", error);
    throw error;
  }
}


export async function sendDataToAnalyze(
  analyzeNeighborhoods: boolean,
  jobID: string | undefined,
  selectedModels: Record<number, ChainElement[]>,
  sphereRadius?: number,
  sphereInterval?: number
): Promise<string | void> {

  if (!jobID) {
    throw new Error("jobID is required");
  }

  let jobToPost: JobToPost = {
    id: jobID,
    models: selectedModels,
    radius: -1,
    interval: -1,
  };

  if (analyzeNeighborhoods && sphereRadius && sphereInterval) {
    jobToPost = {
      ...jobToPost,
      radius: sphereRadius,
      interval: sphereInterval,
    };
  }

  try {
    const response = await fetch(`${API_URL}/jobs/analyzeStructure`, {
      method: "POST",
      body: JSON.stringify(jobToPost),
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      const data = await response.json();
      console.log("Data posted successfully:", data);
    } else {
      let errorData = await response.json();
      console.error("Error creating job:", errorData);
      const errorMessage = errorData?.message || "Unknown error";
    }
  } catch (error) {
    console.error(error);
  }
}

export type StartSimulationPayload = {
  id: string;
  modelNumber: number;
  restraintBackboneForce: number;
  restraintGlobalForce: number;
  restraintBasePairsForce: number;
  rmsdCutoff: number;
};

export async function startSimulation(payload: StartSimulationPayload) {
  const response = await fetch(`${API_URL}/jobs/simulation/start`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });

  let responseBody: any = null;
  try {
    responseBody = await response.json();
  } catch (_error) {
    responseBody = null;
  }

  if (!response.ok) {
    const message =
      responseBody?.error || responseBody?.message || "Failed to start simulation";
    throw new Error(message);
  }

  return responseBody;
}
