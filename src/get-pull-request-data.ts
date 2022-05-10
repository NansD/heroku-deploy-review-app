import github from '@actions/github'

const VALID_EVENT = 'pull_request'

export function getPullRequestData() {
  const {
    action,
    eventName,
    payload,
    issue: {number: issueNumber},
    repo
  } = github.context
  if (!payload.pull_request) {
    throw new Error('This action only works on pull requests')
  }
  const {
    pull_request: {
      head: {
        ref: branch,
        sha: version,
        repo: {id: repoId, fork: forkRepo, html_url: repoHtmlUrl}
      },
      number: prNumber
    }
  } = payload

  const {owner: repoOwner} = repo

  if (eventName !== VALID_EVENT) {
    throw new Error(`Unexpected github event trigger: ${eventName}`)
  }
  return {
    action,
    eventName,
    payload,
    issueNumber,
    repo,
    branch,
    version,
    repoId,
    forkRepo,
    repoHtmlUrl,
    prNumber,
    repoOwner
  }
}
