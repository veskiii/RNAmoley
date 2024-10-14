export const getJobsQuery = 'SELECT * FROM jobs';

export const getJobByIdQuery = 'SELECT * FROM jobs WHERE id = $1';

export const createJobQuery = `
    INSERT INTO jobs (id, originalFilename, name)
    VALUES ($1, $2, $3) RETURNING *
`;