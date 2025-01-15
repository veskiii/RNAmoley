const API_URL = "http://localhost:3000/api/v1";
//const API_URL = "http://restapi/api/v1";

export const createJob = async (formData: FormData): Promise<any> => {
    const response = await fetch(`${API_URL}/jobs`, {
      method: "POST",
      body: formData,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3000",
      },
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Unknown error");
    }
    return response.json();
  };
  