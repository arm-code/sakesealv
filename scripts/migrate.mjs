// Aplica las migraciones de Drizzle (carpeta ./drizzle) a la base libSQL.
// Sustituye a `drizzle-kit migrate` en la imagen: drizzle-kit muere con "Illegal
// instruction" (SIGILL) en CPUs viejos, mientras que @libsql/client + drizzle-orm
// (lo mismo que usa la app) funcionan en cualquier CPU.
// OJO: libsql está fijado en 0.5.28 (pnpm.overrides en package.json): la 0.5.29 trae un
// binario que muere con SIGILL al ejecutar CREATE TABLE en CPUs sin SSE4.2/AVX2. Usa la misma tabla de control
// (__drizzle_migrations), así que es compatible con bases ya migradas con drizzle-kit.
//   node scripts/migrate.mjs     (lee LIBSQL_URL / LIBSQL_AUTH_TOKEN del entorno)
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { resolveLibsqlConfig } from '../src/lib/server/config/infrastructure.shared.js';

const config = resolveLibsqlConfig(process.env);
const client = createClient({ url: config.url, authToken: config.authToken });

async function waitForDatabase() {
	for (let attempt = 1; attempt <= 30; attempt++) {
		try {
			await client.execute('select 1');
			return;
		} catch (error) {
			if (attempt === 30) throw error;
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}
}

try {
	await waitForDatabase();
	await migrate(drizzle(client), { migrationsFolder: './drizzle' });
	console.log('Migraciones aplicadas.');
} catch (error) {
	console.error('Falló la migración:', error);
	process.exitCode = 1;
} finally {
	client.close();
}
