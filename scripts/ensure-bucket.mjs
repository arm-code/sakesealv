// Crea el bucket S3 si no existe (SeaweedFS en el despliegue self-hosted).
// Sustituye al contenedor amazon/aws-cli: usa el mismo SDK que la app y no depende de
// un binario externo. Espera a que el almacenamiento responda antes de crear nada.
//   node scripts/ensure-bucket.mjs     (lee las variables S3_* del entorno)
import {
	S3Client,
	ListBucketsCommand,
	HeadBucketCommand,
	CreateBucketCommand
} from '@aws-sdk/client-s3';

const env = process.env;
const endpoint = env.S3_ENDPOINT;
const bucket = env.S3_BUCKET || 'sake';
const accessKeyId = env.S3_ACCESS_KEY_ID;
const secretAccessKey = env.S3_SECRET_ACCESS_KEY;

if (!endpoint || !accessKeyId || !secretAccessKey) {
	console.error('Faltan S3_ENDPOINT, S3_ACCESS_KEY_ID o S3_SECRET_ACCESS_KEY.');
	process.exit(1);
}

const s3 = new S3Client({
	region: env.S3_REGION || 'us-east-1',
	endpoint,
	forcePathStyle: String(env.S3_FORCE_PATH_STYLE).toLowerCase() !== 'false',
	credentials: { accessKeyId, secretAccessKey }
});

const MAX_WAIT_MS = Number(env.ENSURE_BUCKET_TIMEOUT_MS || 120_000);
const started = Date.now();

// 1) Esperar a que el almacenamiento acepte peticiones
for (;;) {
	try {
		await s3.send(new ListBucketsCommand({}));
		break;
	} catch (error) {
		if (Date.now() - started > MAX_WAIT_MS) {
			console.error(`El almacenamiento no respondió en ${MAX_WAIT_MS / 1000}s:`, error.message);
			process.exit(1);
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

// 2) Crear el bucket solo si falta
try {
	await s3.send(new HeadBucketCommand({ Bucket: bucket }));
	console.log(`Bucket "${bucket}" ya existe.`);
} catch {
	await s3.send(new CreateBucketCommand({ Bucket: bucket }));
	console.log(`Bucket "${bucket}" creado.`);
}
