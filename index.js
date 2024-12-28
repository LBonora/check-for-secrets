#!/usr/bin/env node
const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const parameters = ["help", "git-cached"];

async function checkForSecrets() {
  var args = process.argv.slice(2);

  if (args.length <= 0 || args[0] === null) {
    console.log("No arguments were informed.\n");
    console.log("Use the parameter `help` to check avaliable options\n");
    process.exit(1);
  }

  if (!parameters.includes(args[0])) {
    console.log("Invalid argument.\n");
    console.log("Use the parameter `help` to check avaliable options\n");
    process.exit(1);
  }

  if (args[0].indexOf(parameters[0]) >= 0) {
    process.stdout.write("\n\nUsage:\n");
    process.stdout.write("help - show avaliable parameters\n");
    process.stdout.write(
      "git-cached - looks for the cached files and check for not allowed patterns\n"
    );
    process.stdout.write("\n\n");

    process.exit(0);
  }

  const checkForSecretsConfig = require("../check-for-secrets/checkforsecrets.config.json");
  const ignoredFiles = checkForSecretsConfig.ignoredFiles;
  const patterns = checkForSecretsConfig.patterns;

  let notAllowedFiles = [];

  if (args[0].indexOf(parameters[1]) >= 0) {
    try {
      let execReturn = await exec("git diff --cached --name-only");
      if (execReturn.stdout !== null) {
        let files = execReturn.stdout.split("\n");

        if (files.length === 0) {
          return notAllowedFiles;
        }

        for (let index = 0; index < files.length; index++) {
          const filePath = files[index];

          if (filePath === "") continue;

          if (ignoredFiles.includes(filePath)) {
            console.log("ignored files: ", filePath);
            continue;
          }

          const data = await fs.promises.readFile(filePath, "utf8");

          for (let index = 0; index < patterns.length; index++) {
            const regex = new RegExp(patterns[index], "i");
            let regexResult = regex.exec(data);

            if (regexResult != null && regexResult.length > 0) {
              for (let index = 0; index < regexResult.length; index++) {
                const patternFound = regexResult[index];
                notAllowedFiles.push(
                  filePath + " | string match: " + patternFound
                );
              }
            }
          }
        }

        return notAllowedFiles;
      }
    } catch (error) {
      process.stdout.write("Error when running git-cached validation.\n");
      if (process.stderr.find("usage: git diff [<options>]")) {
        process.stdout.write(
          "Invallid git diff cached command. Contact the creator for help.\n"
        );
        process.exit(1);
      }

      if (
        process.stderr.find("git: command not found") ||
        process.stderr.find(
          "'git' is not recognized as an internal or external command"
        )
      ) {
        process.stdout.write("Make sure git is installed in your system.\n");
        process.exit(1);
      }
    }
  }
}

(async () => {
  process.stdout.write("\n🟡 Checking for not allowed patterns\n");

  let notAllowedFiles = await checkForSecrets();

  if (notAllowedFiles != null && notAllowedFiles.length > 0) {
    process.stdout.write("\n\n🔴 Files with not allowed patterns:\n");
    for (let index = 0; index < notAllowedFiles.length; index++) {
      const matchedFile = notAllowedFiles[index];
      console.log(matchedFile);
    }

    process.stdout.write("\n");
    process.stdout.write("All the files must be checked and fixed!\n\n");
    process.exit(1);
  }

  if (notAllowedFiles != null && notAllowedFiles.length === 0) {
    process.stdout.write("\n\n🟡 No git cached files found\n\n");
    process.exit(0);
  }

  process.stdout.write("\n\n🟢 No bad patterns found\n\n");
  process.exit(0);
})();
