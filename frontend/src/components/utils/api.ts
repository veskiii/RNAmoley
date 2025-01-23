import {Job, JobToPost} from "./types";

const API_URL = "https://rnamoley.cs.put.poznan.pl/api/v1";
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

export async function fetchJobData(jobID: string | undefined, model: number = 1): Promise<Job> {
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

export async function fetchMyData(jobID: string | undefined) {
    console.log(`Sending request to /api/v1/jobs/${jobID}`);
    const response = await fetch(`${API_URL}/jobs/${jobID}`, {
        signal: AbortSignal.timeout(5000),
    });
    console.log("Fetch data response: " + response.status);
    return response;
}

export async function sendDataToAnalyze(
    analyzeWholeStructure: boolean,
    jobID: string | undefined,
    selectedModel: number,
    selectedList: number[]): Promise<string | void> {
    let API_Url = '';

    if (!jobID) {
        throw new Error("jobID is required");
    }

    let jobToPost: JobToPost = {id: '', residues: [], modelNumber: 0, radius: 0, interval: 0};

    if (analyzeWholeStructure) {
        API_Url = `${API_URL}/jobs/analyzeStructure`;
        const radius = parseInt((document.getElementById("radiusInput") as HTMLInputElement).value);
        const interval = parseInt((document.getElementById("intervalInput") as HTMLInputElement).value);
        jobToPost = {id: jobID, modelNumber: selectedModel, residues: [], radius: radius, interval: interval}
    } else {
        API_Url = `${API_URL}/jobs/analyzeFragment`;
        jobToPost = {id: jobID, modelNumber: 0, residues: selectedList, radius: 0, interval: 0}
    }

    try {
        const response = await fetch(`${API_Url}`, {
            method: "POST",
            body: JSON.stringify(jobToPost),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
        });
        if (response.ok) {
            const data = await response.json();
            console.log("Data posted successfully:", data.id);
        } else {
            let errorData = await response.json();
            console.error("Error creating job:", errorData);
            const errorMessage = errorData?.message || "Unknown error";
        }
    } catch (error) {
        console.error(error);
    }
}