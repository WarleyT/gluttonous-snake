import { copyFile, mkdir } from "node:fs/promises";

const files = ["index.html", "styles.css", "game.js"];

await mkdir("public", { recursive: true });
await Promise.all(files.map((file) => copyFile(file, `public/${file}`)));

console.log(`Prepared Cloudflare assets: ${files.join(", ")}`);
