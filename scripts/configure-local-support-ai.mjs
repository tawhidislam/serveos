import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const env = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
if (!['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('This setup is for local Supabase only.');
const project = readFileSync('supabase/config.toml', 'utf8').match(/^project_id\s*=\s*"([a-z0-9_-]+)"/m)?.[1];
if (!project) throw new Error('Missing local project ID');
const path = 'supabase/functions/.env.local';
let contents = existsSync(path) ? readFileSync(path, 'utf8') : 'GEMINI_API_KEY=\nGEMINI_SUPPORT_MODEL=gemini-3.8-flash\n';
if (!/^GEMINI_API_KEY=/m.test(contents)) contents += '\nGEMINI_API_KEY=\n';
if (!/^GEMINI_SUPPORT_MODEL=/m.test(contents)) contents += 'GEMINI_SUPPORT_MODEL=gemini-3.8-flash\n';
let token = contents.match(/^SUPPORT_AI_WORKER_SECRET=([a-f0-9]{64})$/m)?.[1];
if (!token) { token = randomBytes(32).toString('hex'); contents = contents.replace(/^SUPPORT_AI_WORKER_SECRET=.*\n?/gm, '') + `\nSUPPORT_AI_WORKER_SECRET=${token}\n`; }
writeFileSync(path, contents, { mode: 0o600 });
const url = `http://supabase_kong_${project}:8000/functions/v1/support-ai-auto`;
const sql = `DO $$ DECLARE record_id uuid; BEGIN
SELECT id INTO record_id FROM vault.secrets WHERE name='support_ai_worker_token';
IF record_id IS NULL THEN PERFORM vault.create_secret('${token}','support_ai_worker_token'); ELSE PERFORM vault.update_secret(record_id,'${token}'); END IF;
SELECT id INTO record_id FROM vault.secrets WHERE name='support_ai_worker_url';
IF record_id IS NULL THEN PERFORM vault.create_secret('${url}','support_ai_worker_url'); ELSE PERFORM vault.update_secret(record_id,'${url}'); END IF;
END $$;`;
execFileSync('docker', ['exec', '-i', `supabase_db_${project}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, stdio: ['pipe', 'ignore', 'pipe'] });
console.log('Local support worker connection configured. Secrets were not printed.');
console.log('Set GEMINI_API_KEY in supabase/functions/.env.local, then serve functions with that env file.');
