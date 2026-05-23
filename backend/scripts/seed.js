import { seed } from '../src/db/seed.js';

await seed();
console.log('Seed executado com sucesso.');
