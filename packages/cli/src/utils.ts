import { execSync } from "node:child_process";
import path from "node:path";
import { confirm, outro, text } from "@clack/prompts";
import chalk from "chalk";
import dedent from "dedent";
import type { Config } from "./types.js";

export async function getApiKey(name: string, key: string) {
  if (key in process.env) {
    return process.env[key];
  }
  return (async () => {
    let apiKey: string | symbol;
    do {
      apiKey = await text({
        message: dedent`
          ${chalk.bold(`Please provide your ${name} API key.`)}

          To skip this message, set ${chalk.bold(key)} env variable, and run again. 
          
          You can do it in three ways:
          - by creating an ${chalk.bold(".env.local")} file (make sure to ${chalk.bold(".gitignore")} it)
            ${chalk.gray(`\`\`\`
              ${key}=<your-key>
              \`\`\`
            `)}
          - by passing it inline:
            ${chalk.gray(`\`\`\`
              ${key}=<your-key> npx cali
              \`\`\`
            `)}
          - by setting it as an env variable in your shell (e.g. in ~/.zshrc or ~/.bashrc):
            ${chalk.gray(`\`\`\`
              export ${key}=<your-key>
              \`\`\`
            `)},
          `,
        validate: (value) =>
          value.length > 0 ? undefined : `Please provide a valid ${key}.`,
      });
    } while (typeof apiKey === "undefined");

    if (typeof apiKey === "symbol") {
      outro(chalk.gray("Bye!"));
      process.exit(0);
    }

    const save = await confirm({
      message: "Do you want to save it for future runs in .env.local?",
    });

    if (save) {
      execSync(`echo "${key}=${apiKey}" >> .env.local`);
      execSync(`echo ".env.local" >> .gitignore`);
    }

    return apiKey;
  })();
}

export const configPath = path.join(process.cwd(), "languine.config.mjs");

export async function getConfig() {
  let config: Config;
  try {
    const configModule = await import(configPath);
    config = configModule.default;
  } catch (error) {
    console.error(error);
    outro(
      chalk.red(
        "Could not find languine.config.mjs. Run 'languine init' first.",
      ),
    );
    process.exit(1);
  }

  return config;
}

export function extractChangedKeys(diff: string) {
  const addedKeys = new Set<string>();
  const removedKeys = new Set<string>();

  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const match = line.match(/['"]([\w_.]+)['"]/);
      if (match) addedKeys.add(match[1]);
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      const match = line.match(/['"]([\w_.]+)['"]/);
      if (match) removedKeys.add(match[1]);
    }
  }

  // Remove keys that appear in both added and removed (these are modifications)
  for (const key of addedKeys) {
    if (removedKeys.has(key)) {
      addedKeys.delete(key);
      removedKeys.delete(key);
    }
  }

  return {
    addedKeys: Array.from(addedKeys),
    removedKeys: Array.from(removedKeys),
  };
}
