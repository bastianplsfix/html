if (import.meta.main) {
  await main();
}

/** Build the isolated configuration used to verify a newly published package. */
export function createPublishedConsumerConfig(
  packageName: string,
  packageSpecifier: string,
): string {
  return `${
    JSON.stringify(
      {
        // Exact releases must be consumable immediately after publication.
        minimumDependencyAge: 0,
        compilerOptions: {
          jsx: "precompile",
          jsxImportSource: packageName,
          jsxPrecompileSkipElements: ["script", "style"],
        },
        imports: {
          [packageName]: packageSpecifier,
        },
      },
      null,
      2,
    )
  }\n`;
}

async function main(): Promise<void> {
  const config = JSON.parse(await Deno.readTextFile("deno.json")) as {
    readonly name: string;
    readonly version: string;
  };
  const packageSpecifier = `jsr:${config.name}@${config.version}`;
  const consumerSource = await Deno.readTextFile(
    new URL("./published_consumer.tsx", import.meta.url),
  );
  const tempRoot = Deno.env.get("SMOKE_TEMP_ROOT");
  if (!tempRoot) {
    throw new Error(
      "SMOKE_TEMP_ROOT must name the writable temporary directory.",
    );
  }

  const consumerDirectory = await Deno.makeTempDir({
    dir: tempRoot,
    prefix: "html-published-smoke-",
  });
  const consumerConfigPath = `${consumerDirectory}/deno.json`;
  const consumerSourcePath = `${consumerDirectory}/main.tsx`;

  try {
    await Deno.writeTextFile(
      consumerConfigPath,
      createPublishedConsumerConfig(config.name, packageSpecifier),
    );
    await Deno.writeTextFile(consumerSourcePath, consumerSource);

    await runPublishedConsumer(consumerConfigPath, consumerSourcePath);
    console.log(
      `Published TSX consumer passed for ${config.name}@${config.version}.`,
    );
  } finally {
    await Deno.remove(consumerDirectory, { recursive: true });
  }
}

async function runPublishedConsumer(
  configPath: string,
  sourcePath: string,
): Promise<void> {
  const attempts = 12;
  const decoder = new TextDecoder();

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const checkOutput = await new Deno.Command("deno", {
      args: [
        "check",
        "--reload",
        "--no-lock",
        `--config=${configPath}`,
        "--allow-import=jsr.io",
        sourcePath,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const checkFailure = decodeFailure(checkOutput, decoder);

    if (!checkOutput.success) {
      if (
        attempt === attempts ||
        !isRegistryPropagationFailure(checkFailure)
      ) {
        throw new Error(
          `Published TSX consumer type-check failed on attempt ${attempt}:\n${checkFailure}`,
        );
      }
      await waitForRegistry(attempt, attempts);
      continue;
    }

    const runOutput = await new Deno.Command("deno", {
      args: [
        "run",
        "--quiet",
        "--no-check",
        "--no-lock",
        `--config=${configPath}`,
        "--allow-import=jsr.io",
        sourcePath,
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    const stdout = decoder.decode(runOutput.stdout);
    const failure = decodeFailure(runOutput, decoder, stdout);

    if (runOutput.success && stdout.includes("published-tsx-consumer-ok")) {
      return;
    }

    if (attempt === attempts || !isRegistryPropagationFailure(failure)) {
      throw new Error(
        `Published TSX consumer execution failed on attempt ${attempt}:\n${failure}`,
      );
    }

    await waitForRegistry(attempt, attempts);
  }
}

function decodeFailure(
  output: Deno.CommandOutput,
  decoder: TextDecoder,
  decodedStdout = decoder.decode(output.stdout),
): string {
  return `${decodedStdout}\n${decoder.decode(output.stderr)}`.trim();
}

async function waitForRegistry(
  attempt: number,
  attempts: number,
): Promise<void> {
  console.error(
    `Published version is not available yet (attempt ${attempt}/${attempts}); retrying in 10 seconds.`,
  );
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}

function isRegistryPropagationFailure(output: string): boolean {
  return /(404|not found|could not find|failed to download|error sending request|temporar|timed out|connection|429|502|503|504)/iu
    .test(output);
}
