import {
  createReviewApp,
  findReviewApp,
  getAppDetails,
  outputAppDetails,
  waitReviewAppUpdated
} from './heroku-manager'
import core from '@actions/core'
import {getPullRequestData} from './get-pull-request-data'
import github from '@actions/github'
import {parseInputs} from './parse-inputs'
async function run(): Promise<void> {
  try {
    const {
      octokit,
      heroku,
      herokuPipelineId,
      prLabel,
      shouldCommentPR,
      shouldWaitForBuild
    } = parseInputs()
    const {
      action,
      issueNumber,
      repo,
      branch,
      version,
      repoId,
      forkRepo,
      repoHtmlUrl,
      prNumber,
      repoOwner
    } = getPullRequestData()

    const sourceUrl = `${repoHtmlUrl}/tarball/${version}`
    const forkRepoId = forkRepo ? repoId : undefined

    core.debug(
      `Deploy info: ${JSON.stringify({
        branch,
        version,
        repoId,
        forkRepo,
        forkRepoId,
        repoHtmlUrl,
        prNumber,
        issueNumber,
        repoOwner,
        sourceUrl
      })}`
    )

    if (forkRepo) {
      core.notice('No secrets are available for PRs in forked repos.')
      return
    }

    if ('labeled' === action) {
      core.startGroup('PR labelled')
      core.debug('Checking PR label...')
      const {
        payload: {
          label: {name: newLabelAddedName}
        }
      } = github.context
      if (newLabelAddedName === prLabel) {
        core.info(
          `Checked PR label: "${newLabelAddedName}", so need to create review app...`
        )
        await createReviewApp(
          repo,
          branch,
          version,
          herokuPipelineId,
          forkRepoId,
          prNumber,
          repoHtmlUrl,
          heroku
        )

        let updatedApp
        core.debug(`should_wait_for_build: ${shouldWaitForBuild}`)
        if (shouldWaitForBuild) {
          updatedApp = await waitReviewAppUpdated(
            herokuPipelineId,
            prNumber,
            version,
            heroku
          )
        } else {
          const reviewApp = await findReviewApp(
            herokuPipelineId,
            prNumber,
            heroku
          )
          updatedApp = await getAppDetails(reviewApp.app.id, heroku)
        }
        outputAppDetails(updatedApp)
      } else {
        core.info(
          `Checked PR label OK: "${newLabelAddedName}", no action required.`
        )
      }
      core.endGroup()
      return
    }

    const app = await findReviewApp(herokuPipelineId, prNumber, heroku)

    // Only people that can close PRs are maintainers or the author
    // hence can safely delete review app without being collaborator
    if ('closed' === action) {
      core.debug('PR closed, deleting review app...')
      if (app) {
        await heroku.delete(`/review-apps/${app.id}`)
        core.info('PR closed, deleted review app OK')
        core.endGroup()
      } else {
        core.error(`Could not find review app for PR #${prNumber}`)
        core.setFailed(
          `Action "closed", yet no existing review app for PR #${prNumber}`
        )
      }
      return
    }

    // as we can't update an existing review app, we need to delete and create a new one
    if (app) {
      core.debug('A review app already exists. Delete the old one...')
      await heroku.delete(`/review-apps/${app.id}`)
      core.debug('Review app deleted OK, now build a new one...')
    }
    await createReviewApp(
      repo,
      branch,
      version,
      herokuPipelineId,
      forkRepoId,
      prNumber,
      repoHtmlUrl,
      heroku
    )

    core.debug(`should_wait_for_build: ${shouldWaitForBuild}`)
    let updatedApp
    if (shouldWaitForBuild) {
      await waitReviewAppUpdated(herokuPipelineId, prNumber, version, heroku)
    } else {
      const reviewApp = await findReviewApp(herokuPipelineId, prNumber, heroku)
      updatedApp = await getAppDetails(reviewApp.app.id, heroku)
    }
    outputAppDetails(updatedApp)

    if (prLabel) {
      core.startGroup('Label PR')
      core.debug(`Adding label "${prLabel}" to PR...`)
      await octokit.rest.issues.addLabels({
        ...repo,
        labels: [prLabel],
        issue_number: prNumber
      })
      core.info(`Added label "${prLabel}" to PR... OK`)
      core.endGroup()
    } else {
      core.debug('No label specified; will not label PR')
    }

    if (shouldCommentPR) {
      core.startGroup('Comment on PR')
      core.debug('Adding comment to PR...')
      if (shouldWaitForBuild) {
        await octokit.rest.issues.createComment({
          ...repo,
          issue_number: prNumber,
          body: `Review app deployed to ${updatedApp.web_url}`
        })
      } else {
        await octokit.rest.issues.createComment({
          ...repo,
          issue_number: prNumber,
          body: `Review app is being deployed to ${updatedApp.web_url}`
        })
      }
      core.info('Added comment to PR... OK')
      core.endGroup()
    } else {
      core.debug(
        'should_comment_pull_request is not set; will not comment on PR'
      )
    }
  } catch (err) {
    core.error(err as any)
    core.setFailed((err as any).message)
  }
}

run()
