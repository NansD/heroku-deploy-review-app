import Heroku from 'heroku-client'
import core from '@actions/core'
import {getInputWithDefaultValue} from './helpers/get-input-with-default-value'
import github from '@actions/github'
import {notEmpty} from './helpers/type-guards'

function checkParams(
  githubToken: string | undefined,
  herokuApiToken: string | undefined,
  herokuPipelineId: string | undefined
): void {
  if (
    notEmpty(githubToken) &&
    notEmpty(herokuApiToken) &&
    notEmpty(herokuPipelineId)
  ) {
    return
  }
  core.error(
    'Missing required input, please check you have set a value for each of the following inputs : github_token, heroku_api_token, heroku_pipeline_id'
  )
  throw new Error(
    'Missing required input, please check you have set a value for each of the following inputs : github_token, heroku_api_token, heroku_pipeline_id'
  )
}

export function parseInputs() {
  const githubToken = getInputWithDefaultValue('github_token', {
    required: true
  })
  const herokuApiToken = getInputWithDefaultValue('heroku_api_token', {
    required: true
  })
  const herokuPipelineId = getInputWithDefaultValue('heroku_pipeline_id', {
    required: true
  })
  checkParams(githubToken, herokuApiToken, herokuPipelineId)
  const prLabel = getInputWithDefaultValue('github_label', {
    required: false,
    default: false
  })
  const shouldCommentPR = getInputWithDefaultValue(
    'should_comment_pull_request',
    {
      required: false,
      default: false
    }
  )
  const shouldWaitForBuild = getInputWithDefaultValue('should_wait_for_build', {
    required: false,
    default: true
  })

  const octokit = github.getOctokit(githubToken as string)
  const heroku = new Heroku({token: herokuApiToken})
  return {
    octokit,
    heroku,
    herokuPipelineId: herokuPipelineId as string,
    prLabel,
    shouldCommentPR,
    shouldWaitForBuild
  }
}
