// main.ts
import path3 from "path";

// ../common/concurrentUtil.ts
async function executeTasksWithMaxConcurrency(taskFunctionArray, maxConcurrency) {
  let remainingToCompleteCount = taskFunctionArray.length;
  const taskFunctions = [...taskFunctionArray];
  return new Promise((resolve, reject) => {
    function _startNextTask(taskFunction) {
      taskFunction().then(() => {
        if (--remainingToCompleteCount === 0) {
          resolve();
          return;
        }
        if (taskFunctions && taskFunctions.length) {
          const nextTaskFunction = taskFunctions.pop();
          if (nextTaskFunction) _startNextTask(nextTaskFunction);
        }
      }).catch((err) => reject(err));
    }
    const firstBatchCount = Math.min(maxConcurrency, taskFunctionArray.length);
    for (let i = 0; i < firstBatchCount; ++i) {
      const nextTaskFunction = taskFunctions.pop();
      if (nextTaskFunction) _startNextTask(nextTaskFunction);
    }
  }).catch((err) => {
    throw err;
  });
}

// ../common/commitHashUtil.ts
function _isValidShortCommitHash(commitHash) {
  return /^[0-9a-f]{7}$/i.test(commitHash);
}
function _isValidLongCommitHash(commitHash) {
  return /^[0-9a-f]{40}$/i.test(commitHash);
}
function isValidCommitHash(commitHash) {
  return _isValidShortCommitHash(commitHash) || _isValidLongCommitHash(commitHash);
}
function shortCommitHash(commitHash) {
  return commitHash.length > 7 ? commitHash.slice(0, 7) : commitHash;
}

// ../common/ExpectedError.ts
var ExpectedError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ExpectedError";
  }
};
var ExpectedError_default = ExpectedError;

// ../common/githubUtil.ts
function error(message) {
  console.error(`::error::${message}`);
}
function warning(message) {
  console.warn(`::warning::${message}`);
}
function notice(message) {
  console.log(`::notice::${message}`);
}
function finalSuccess(message) {
  notice(`\u2705 ${message}`);
}
function info(message) {
  console.log(message);
}
function fatalError(message) {
  error(message);
  process.exit(1);
}
function startGroup(name) {
  console.log(`::group::${name}`);
}
function endGroup() {
  console.log(`::endgroup::`);
}
function getInput(name, required = false) {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  const value = process.env[key];
  if (required && !value) fatalError(`Input ${name} is required.`);
  return value || "";
}
function getGithubCommitHash() {
  const commitSha = process.env.GITHUB_SHA;
  if (!commitSha) throw new ExpectedError_default("GITHUB_SHA environment variable is not set.");
  if (!isValidCommitHash(commitSha)) throw new ExpectedError_default("GITHUB_SHA environment variable is invalid.");
  return shortCommitHash(commitSha);
}
function getRepoOwner() {
  const repoOwner = process.env.GITHUB_REPOSITORY_OWNER;
  if (!repoOwner) throw new ExpectedError_default("GITHUB_REPOSITORY_OWNER environment variable is not set.");
  return repoOwner;
}
function getProjectLocalPath() {
  const localPath = process.env.GITHUB_WORKSPACE;
  if (!localPath) throw new ExpectedError_default("GITHUB_WORKSPACE environment variable is not set.");
  return localPath;
}
function runningInGithubCI() {
  return process.env.GITHUB_ACTIONS === "true";
}

// ../common/localFileUtil.ts
import { opendir, stat, mkdir } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import path from "path";
async function findFilesAtPath(localPath) {
  const filepaths = [];
  async function _findFilesAtPathHelper(currentPath) {
    const dir = await opendir(currentPath);
    for await (const dirEntry of dir) {
      const fullPath = path.join(currentPath, dirEntry.name);
      if (dirEntry.isDirectory()) {
        await _findFilesAtPathHelper(fullPath);
      } else {
        filepaths.push(fullPath);
      }
    }
  }
  await _findFilesAtPathHelper(localPath);
  return filepaths;
}
async function doesDirectoryExist(dirPath) {
  try {
    const stats = await stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
async function _put(localFilePath, data) {
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(localFilePath);
    writeStream.write(data);
    writeStream.end();
    writeStream.on("finish", () => resolve());
    writeStream.on("error", (err) => reject(err));
  }).catch((err) => {
    throw err;
  });
}
async function putText(localFilePath, text) {
  return _put(localFilePath, text);
}
async function writeAppVersionFile(version, localPath) {
  const localFilePath = path.join(localPath, "version.txt");
  return await putText(localFilePath, version);
}

// ../common/httpUtil.ts
import * as https from "node:https";
import { createReadStream as createReadStream2 } from "fs";
import { stat as stat2 } from "fs/promises";
async function httpsRequestWithBodyFromFile(options, filePath) {
  const fileStats = await stat2(filePath);
  return new Promise((resolve, reject) => {
    if (!options.headers) options.headers = {};
    options.headers["Content-Length"] = fileStats.size;
    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", async () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: responseData });
        } else {
          reject(new ExpectedError_default(`Request to ${options.hostname} failed with status code: ${res.statusCode}. Response: ${responseData}`));
        }
      });
    });
    req.on("error", (err) => reject(err));
    const inputReadStream = createReadStream2(filePath);
    inputReadStream.pipe(req);
    inputReadStream.on("end", () => req.end());
    inputReadStream.on("error", (err) => {
      req.destroy();
      reject(err);
    });
  }).catch((err) => {
    throw err;
  });
}
async function httpsRequestWithBodyFromText(options, text) {
  return new Promise((resolve, reject) => {
    if (!options.headers) options.headers = {};
    options.headers["Content-Length"] = Buffer.byteLength(text);
    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", async () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: responseData });
        } else {
          reject(new ExpectedError_default(`Request to ${options.hostname} failed with status code: ${res.statusCode}. Response: ${responseData}`));
        }
      });
    });
    req.on("error", (err) => reject(err));
    req.write(text);
    req.end();
  }).catch((err) => {
    throw err;
  });
}

// ../common/toolVersionUtil.ts
var VERSION = "1.0";
var DECENT_TOOLS_VERSION = `v${VERSION} Decent Tools`;

// ../common/stageIndexUtil.ts
function _parseStageIndexFormat(htmlText) {
  const versionPrefix = `<!-- v`;
  const versionPrefixStartPos = htmlText.indexOf(versionPrefix);
  if (versionPrefixStartPos === -1) return null;
  const versionStartPos = versionPrefixStartPos + versionPrefix.length;
  const versionEndPos = htmlText.indexOf(" ", versionStartPos);
  if (versionEndPos === -1) return null;
  return htmlText.substring(versionStartPos, versionEndPos);
}
function _parseVariableValue(html, variableName) {
  const variablePrefix = ` ${variableName}='`;
  const variablePrefixStartPos = html.indexOf(variablePrefix);
  if (variablePrefixStartPos === -1) return null;
  const valueStartPos = variablePrefixStartPos + variablePrefix.length;
  const valueEndPos = html.indexOf(`'`, valueStartPos);
  if (valueEndPos === -1) return null;
  return html.substring(valueStartPos, valueEndPos);
}
function _findSupportedStageIndexFormat(htmlText) {
  const version = _parseStageIndexFormat(htmlText);
  if (!version) throw Error(`Failed to parse stage index format version.`);
  if (version !== VERSION) throw Error(`Unsupported stage index format version ${version}.`);
  return version;
}
function _createEmptyVarsObject() {
  return { productionVersion: "", rollbackVersion: "", stageVersion: "" };
}
function createStageIndex(appName, stageVersion, productionVersion, rollbackVersion) {
  const stageIndexUrl = `/_${appName}/${stageVersion}/`;
  return `<!DOCTYPE html><html><head><title>Stage Index for ${appName}</title><script>
<!-- ${DECENT_TOOLS_VERSION}. Hand-edit at your own risk! -->
const productionVersion='${productionVersion}';
const rollbackVersion='${rollbackVersion}';
const stageVersion='${stageVersion}';
window.location.href='${stageIndexUrl}';
</script></head><body></body></html>`;
}
async function findAppVersions(appName) {
  const url = `https://decentapps.net/_${appName}/index.html`;
  const response = await fetch(url);
  if (!response.ok) return _createEmptyVarsObject();
  const htmlText = await response.text();
  try {
    _findSupportedStageIndexFormat(htmlText);
  } catch (error2) {
    warning(`Could not retrieve app versions from existing stage index at ${url}: ${error2.message}.`);
    return _createEmptyVarsObject();
  }
  const productionVersion = _parseVariableValue(htmlText, "productionVersion") ?? "";
  const rollbackVersion = _parseVariableValue(htmlText, "rollbackVersion") ?? "";
  const stageVersion = _parseVariableValue(htmlText, "stageVersion") ?? "";
  return { stageVersion, productionVersion, rollbackVersion };
}

// ../common/partnerServiceClient.ts
var API_HOSTNAME = "partner.decentapps.net";
async function putFile(repoOwner, partnerApiKey, appName, version, localRootPath, localFilepath) {
  const filePath = localFilepath.replace(localRootPath, "");
  const options = {
    hostname: API_HOSTNAME,
    path: `/api/deployment/${appName}/${version}/${filePath}`,
    port: 443,
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "Authorization": `Bearer ${partnerApiKey}`,
      "x-repo-owner": repoOwner,
      "Accept": "application/json"
    }
  };
  const result = await httpsRequestWithBodyFromFile(options, localFilepath);
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new ExpectedError_default(`Failed to upload file to partner service. Status code: ${result.statusCode}. Response: ${result.body}`);
  }
}
async function putStageIndex(repoOwner, partnerApiKey, appName, stageVersion, productionVersion, rollbackVersion, updateRoute) {
  const path4 = updateRoute ? `/api/deployment/${appName}/index.html?updateRoute=true` : `/api/deployment/${appName}/index.html`;
  const options = {
    hostname: API_HOSTNAME,
    path: path4,
    port: 443,
    method: "PUT",
    headers: {
      "Content-Type": "text/html",
      "Authorization": `Bearer ${partnerApiKey}`,
      "x-repo-owner": repoOwner,
      "Accept": "application/json"
    }
  };
  const stageIndexText = createStageIndex(appName, stageVersion, productionVersion, rollbackVersion);
  const result = await httpsRequestWithBodyFromText(options, stageIndexText);
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`Failed to upload file to partner service. Status code: ${result.statusCode}. Response: ${result.body}`);
  }
}

// ../common/actionVersionUtil.ts
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path2 from "path";
var actionScriptUrl = fileURLToPath(import.meta.url);
var actionPath = path2.dirname(actionScriptUrl);
async function fetchLatestActionVersion(actionName) {
  const response = await fetch(`https://raw.githubusercontent.com/DecentAppsNet/${actionName}/refs/heads/main/version.txt`);
  if (!response.ok) throw new Error(`Failed to fetch action version: ${response.statusText}`);
  return (await response.text()).trim();
}
async function fetchLocalActionVersion() {
  try {
    const localFilepath = path2.join(actionPath, "version.txt");
    const versionContent = await readFile(localFilepath, "utf8");
    return versionContent.trim();
  } catch (error2) {
    throw new Error(`Failed to read local action version: ${error2.message}`);
  }
}

// main.ts
async function deployAction() {
  try {
    startGroup("Checking action version");
    info(`fetch local action version`);
    const localActionVersion = await fetchLocalActionVersion();
    info("fetch latest action version");
    const latestActionVersion = await fetchLatestActionVersion("deploy");
    if (localActionVersion !== latestActionVersion) {
      warning(`Local action version ${localActionVersion} does not match latest action version ${latestActionVersion}. Consider updating your action.`);
    } else {
      info(`Local action version ${localActionVersion} matches latest action version.`);
    }
    endGroup();
    startGroup("Collecting inputs");
    info("commit hash");
    const stageVersion = getGithubCommitHash();
    info("repo owner");
    const repoOwner = getRepoOwner();
    info("Decent API key");
    const apiKey = getInput("api-key", true);
    info("app name");
    const appName = getInput("app-name", true);
    info("project local path");
    const projectLocalPath = getProjectLocalPath();
    endGroup();
    startGroup("Preparing local dist path and version file");
    info("check for dist directory");
    const localDistPath = path3.join(projectLocalPath, "dist");
    if (!await doesDirectoryExist(localDistPath)) fatalError(`Local dist directory missing. Your Github workflow (e.g., .github/workflows/deploy.yml) should check out your project and build/copy to the ./dist folder all files meant for deployment.`);
    info("write version file");
    await writeAppVersionFile(stageVersion, localDistPath);
    endGroup();
    startGroup("Preparing files for upload");
    async function _uploadOneFileTask(localFilepathI) {
      const localFilepath = localFilepaths[localFilepathI];
      if (localFilepath === "") return;
      try {
        info(`upload ${localFilepath}`);
        await putFile(repoOwner, apiKey, appName, stageVersion, localDistPath, localFilepath);
        localFilepaths[localFilepathI] = "";
        ++uploadCount;
      } catch (error2) {
        console.warn(`Failed to upload file ${localFilepath}: ${error2.message}.`);
      }
    }
    info("find files at local dist path");
    const localFilepaths = await findFilesAtPath(localDistPath);
    if (localFilepaths.length === 1) warning("No files found in ./dist directory besides version.txt. Is your project building to ./dist?");
    info("prepare upload tasks");
    const uploadTasks = localFilepaths.map((_, index) => () => _uploadOneFileTask(index));
    endGroup();
    startGroup(`Uploading ${uploadTasks.length} files`);
    let uploadCount = 0;
    const MAX_FAIL_COUNT = 3;
    const MAX_CONCURRENT_UPLOADS = 10;
    for (let failCount = 0; failCount < MAX_FAIL_COUNT; ++failCount) {
      if (failCount > 0) console.warn(`Retrying after failed uploads... (${failCount + 1}/${MAX_FAIL_COUNT})`);
      try {
        await executeTasksWithMaxConcurrency(uploadTasks, MAX_CONCURRENT_UPLOADS);
        if (uploadCount === localFilepaths.length) break;
      } catch (error2) {
        error2(`Unexpected error while uploading files: ${error2.message}.`);
      }
    }
    if (uploadCount < localFilepaths.length) {
      if (uploadCount === 0) fatalError("Failed to upload any files. See previous warnings for details.");
      fatalError(`Failed to upload all files. Only ${uploadCount} of ${localFilepaths.length} files were uploaded successfully. See previous warnings for details.`);
    }
    endGroup();
    startGroup("Updating stage index");
    info("fetch app versions");
    const { productionVersion, rollbackVersion } = await findAppVersions(appName);
    info(`uploading new stage index - stage version=${stageVersion}, production version=${productionVersion}, rollback version=${rollbackVersion}`);
    await putStageIndex(repoOwner, apiKey, appName, stageVersion, productionVersion, rollbackVersion, false);
    endGroup();
    const stageUrl = `https://decentapps.net/_${appName}/${stageVersion}/`;
    finalSuccess(`Successfully deployed ${uploadCount} files to ${stageUrl}.`);
  } catch (error2) {
    const showErrorDetails = !runningInGithubCI() || error2.name === "ExpectedError";
    const errorMessage = showErrorDetails ? error2.message : "An unexpected error occurred.";
    fatalError(errorMessage);
  }
}
deployAction();
