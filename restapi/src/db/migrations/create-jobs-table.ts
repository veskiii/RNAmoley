const createJobsTable = `
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY,
    originalFilename VARCHAR(63) NOT NULL,
    name VARCHAR(63) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`;

export default createJobsTable;