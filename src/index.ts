import { executeTasksWithMaxConcurrency } from './concurrentUtil.ts';
import { fatalError, finalSuccess, getGithubCommitHash, getInput, getProjectLocalPath, getRepoOwner, runningInGithubCI } from './githubUtil.ts';
import { findFilesAtPath, writeAppVersionFile } from './localFileUtil.ts';
import { putFile, putStageIndex } from './partnerServiceClient.ts';
import { findAppVersions } from './stageIndexUtil.ts';

try {
  // Get all params. These throw if not set or are invalid.
  const stageVersion = getGithubCommitHash(); // Env var GITHUB_SHA - can be a 7-character or 40-character alphanumeric. For testing purposes, "9999999" is good.
  const repoOwner = getRepoOwner(); // Env var GITHUB_REPOSITORY_OWNER - repo owner that must match provisioning on the partner service.
  const apiKey = getInput('api-key', true); // Env var INPUT_API_KEY - partner API key that must match provisioning on the partner service.
  const appName = getInput('app-name', true); // Env var INPUT_APP_NAME - name of the app that must match provisioning on the partner service.

  // Write version.txt file to the local dist path. This file will be uploaded with other files and can be used to verify the deployment.
  const localDistPath = `${getProjectLocalPath()}/dist/`;
  await writeAppVersionFile(stageVersion, localDistPath);
  
  // Create a set of task functions to upload files concurrently.
  const localFilepaths = await findFilesAtPath(localDistPath);
  const uploadTasks = localFilepaths.map((_, index) => () => _uploadOneFileTask(index));

  async function _uploadOneFileTask(localFilepathI:number):Promise<void> {
    const localFilepath = localFilepaths[localFilepathI];
    if (localFilepath === '') return; // Skip if already uploaded (marked as empty string).
    try {
      await putFile(repoOwner, apiKey, appName, stageVersion, localDistPath, localFilepath);
      localFilepaths[localFilepathI] = ''; // Mark as uploaded by setting to empty string.
      ++uploadCount;
    } catch (error) { // Failing to upload is treated as non-fatal.
      console.warn(`Failed to upload file ${localFilepath}: ${error.message}.`);
    }
  }

  // Upload files concurrently with retries on failure.
  let uploadCount = 0;
  const MAX_FAIL_COUNT = 3;
  const MAX_CONCURRENT_UPLOADS = 10;
  for (let failCount = 0; failCount < MAX_FAIL_COUNT; ++failCount) {
    if (failCount > 0) console.warn(`Retrying after failed uploads... (${failCount + 1}/${MAX_FAIL_COUNT})`);
    try {
      await executeTasksWithMaxConcurrency(uploadTasks, MAX_CONCURRENT_UPLOADS);
      if (uploadCount === localFilepaths.length) break; // If all files were uploaded successfully, exit the loop.
    } catch (error) {
      console.error(`Unexpected error while uploading files: ${error.message}.`); // The task function should have caught exception.
    }
  }
  if (uploadCount < localFilepaths.length) {
    if (uploadCount === 0) fatalError('Failed to upload any files. See previous warnings for details.');
    fatalError(`Failed to upload all files. Only ${uploadCount} of ${localFilepaths.length} files were uploaded successfully. See previous warnings for details.`);
  }

  // Update the stage index.
  const { productionVersion, rollbackVersion } = await findAppVersions(appName);
  await putStageIndex(repoOwner, apiKey, appName, stageVersion, productionVersion, rollbackVersion, false);
  
  const stageUrl = `https://decentapps.net/_${appName}/${stageVersion}/`;
  finalSuccess(`Successfully deployed ${uploadCount} files to ${stageUrl}.`);
} catch (error) {
  // For security reasons, don't show unexpected error details in Github CI output.
  const showErrorDetails = !runningInGithubCI() || error.name === 'ExpectedError';
  const errorMessage = showErrorDetails ? error.message : 'An unexpected error occurred.';
  fatalError(errorMessage);
}