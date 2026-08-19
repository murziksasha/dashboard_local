import { createBackup } from "../src/lib/backup";

const name = createBackup("cli");
console.log(`Backup created: ${name}`);
