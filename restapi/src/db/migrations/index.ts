import db from '../index.js';
import createJobsTable from './create-jobs-table.js';

async function runDbMigrations() {
    console.log('Running DB migrations...');

    // use single clinet for transacion
    const client = await db.connect();

    try {
        await client.query(`BEGIN`);
        await client.query(createJobsTable);
        await client.query(`COMMIT`);
        console.log('DB migrations ran successfully.');

    } catch (error) {
        await client.query(`ROLLBACK`);
        console.error('DB migrations failed:', error);

    } finally {
        client.release();
    }
}

export default runDbMigrations;