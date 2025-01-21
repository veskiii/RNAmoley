import { Job } from "./types";

// const API_URL = "http://localhost:3000/api/v1";
const API_URL = "http://restapi:3001/api/v1";

export const createJob = async (formData: FormData): Promise<any> => {
  const response = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    body: formData,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Unknown error");
  }
  return response.json();
};

export async function fetchJobData(jobID: string | undefined, model: number = 1): Promise<Job> {
  try {
    const response = await fetch(`${API_URL}/jobs/${jobID}/${model}`, {
      method: "GET",
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }
  catch (error) {
    console.error("Error in fetchMyData:", error);
    throw error;
  }
}