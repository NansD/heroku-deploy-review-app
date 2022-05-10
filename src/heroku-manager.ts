import Heroku from 'heroku-client'
import core from '@actions/core'
import {parseInputs} from './parse-inputs'

const waitSeconds = async (secs: number) =>
  new Promise(resolve => setTimeout(resolve, secs * 1000))

export async function getAppDetails(id: string, heroku: Heroku) {
  const url = `/apps/${id}`
  core.debug(`Getting app details for app ID ${id} (${url})`)
  const appDetails = await heroku.get(url)
  core.info(
    `Got app details for app ID ${id} OK: ${JSON.stringify(appDetails)}`
  )
  return appDetails
}

export async function outputAppDetails(app: any) {
  core.startGroup('Output app details')
  core.debug(`App details: ${JSON.stringify(app)}`)
  const {id: appId, web_url: webUrl} = app
  core.info(`Review app ID: "${appId}"`)
  core.setOutput('app_id', appId)
  core.info(`Review app Web URL: "${webUrl}"`)
  core.setOutput('app_web_url', webUrl)
  core.endGroup()
}

export async function findReviewApp(
  herokuPipelineId: string,
  prNumber: number,
  heroku: Heroku
): Promise<any> {
  const apiUrl = `/pipelines/${herokuPipelineId}/review-apps`
  core.debug(`Listing review apps: "${apiUrl}"`)
  const reviewApps = await heroku.get(apiUrl)
  if (!Array.isArray(reviewApps)) {
    throw new Error(`Expected array of review apps, got ${typeof reviewApps}`)
  }
  core.info(
    `Listed ${reviewApps.length} review apps OK: ${reviewApps.length} apps found.`
  )
  core.debug(`Review apps: ${JSON.stringify(reviewApps)}`)

  core.debug(`Finding review app for PR #${prNumber}...`)
  const apps = reviewApps.filter(app => app.pr_number === prNumber)
  // in the case of multiple review apps for the same branch, take the latest one
  const app = apps.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )[0]
  if (app) {
    const {status} = app
    if ('errored' === status) {
      core.notice(
        `Found review app for PR #${prNumber} OK, but status is "${status}"`
      )
      return null
    }
    core.info(`Found review app for PR #${prNumber} OK: ${JSON.stringify(app)}`)
  } else {
    core.info(`No review app found for PR #${prNumber}`)
  }
  // when the app has just been created, heroku does not yet have the app ID
  // so we need to wait a bit before we can get the app details again
  if (!app.app) {
    await waitSeconds(5)
    return findReviewApp(herokuPipelineId, prNumber, heroku)
  }
  return app
}

async function checkBuildStatusForReviewApp(
  app: any,
  version: string,
  heroku: Heroku
) {
  core.debug(`Checking build status for app: ${JSON.stringify(app)}`)
  if ('pending' === app.status || 'creating' === app.status) {
    return false
  }
  if ('deleting' === app.status) {
    throw new Error(
      `Unexpected app status: "${app.status}" - ${app.message} (error status: ${app.error_status})`
    )
  }
  if (!app.app) {
    throw new Error(`Unexpected app status: "${app.status}"`)
  }
  const {
    app: {id: appId},
    status,
    error_status: errorStatus
  } = app

  core.debug(`Fetching latest builds for app ${appId}...`)
  const latestBuilds = await heroku.get(`/apps/${appId}/builds`)
  if (!Array.isArray(latestBuilds)) {
    throw new Error(`Expected array of builds, got ${typeof latestBuilds}`)
  }
  core.debug(
    `Fetched latest builds for pipeline ${appId} OK: ${latestBuilds.length} builds found.`
  )

  core.debug(`Finding build matching version ${version}...`)
  const build = await latestBuilds.find(
    aBuild => version === aBuild.source_blob.version
  )
  if (!build) {
    core.error(`Could not find build matching version ${version}.`)
    core.setFailed(
      `No existing build for app ID ${appId} matches version ${version}`
    )
    throw new Error(
      `Unexpected build status: "${status}" yet no matching build found`
    )
  }
  core.info(
    `Found build matching version ${version} OK: ${JSON.stringify(build)}`
  )

  switch (build.status) {
    case 'succeeded':
      return true
    case 'pending':
      return false
    default:
      throw new Error(
        `Unexpected build status: "${status}": ${
          errorStatus || 'no error provided'
        }`
      )
  }
}

export async function waitReviewAppUpdated(
  herokuPipelineId: string,
  prNumber: number,
  version: string,
  heroku: Heroku
) {
  core.startGroup('Ensure review app is up to date')

  let reviewApp
  let isFinished
  do {
    reviewApp = await findReviewApp(herokuPipelineId, prNumber, heroku)
    isFinished = await checkBuildStatusForReviewApp(reviewApp, version, heroku)
    await waitSeconds(5)
  } while (!isFinished)
  core.endGroup()

  return getAppDetails(reviewApp.app.id, heroku)
}

export async function createReviewApp(
  repo: {owner: string; repo: string},
  branch: string,
  version: string,
  herokuPipelineId: string,
  forkRepoId: string,
  prNumber: number,
  repoHtmlUrl: string,
  heroku: Heroku
) {
  const {octokit} = parseInputs()
  core.startGroup('Create review app')

  const archiveBody = {
    owner: repo.owner,
    repo: repo.repo,
    ref: version
  }
  core.debug(`Fetching archive: ${JSON.stringify(archiveBody)}`)
  const {url: archiveUrl} = await octokit.rest.repos.downloadTarballArchive(
    archiveBody
  )
  core.info(`Fetched archive OK: ${JSON.stringify(archiveUrl)}`)

  const body = {
    branch,
    pipeline: herokuPipelineId,
    source_blob: {
      url: archiveUrl,
      version
    },
    fork_repo_id: forkRepoId,
    pr_number: prNumber,
    environment: {
      GIT_REPO_URL: repoHtmlUrl
    }
  }
  core.debug(`Creating heroku review app: ${JSON.stringify(body)}`)
  const app = await heroku.post('/review-apps', {body})
  core.info(`Created review app OK: ${JSON.stringify(app)}`)
  core.endGroup()

  return app
}
