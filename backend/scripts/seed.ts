import { connectDatabase, disconnectDatabase } from '../src/config/database';
async function seed() { await connectDatabase(); console.info('Seed scaffold complete; no sample data is inserted.'); await disconnectDatabase(); } seed().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
