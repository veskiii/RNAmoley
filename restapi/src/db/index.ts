import pg from 'pg';

const PORT = (process.env.POSTGRES_PORT || 5432) as number;

const db = new pg.Pool({
    host: process.env.POSTGRES_HOST,
    port: PORT,
    user: process.env.POSTGRES_USER,
    password: `${process.env.POSTGRES_PASSWORD}`,
    database: process.env.POSTGRES_DATABASE
});

export default db;