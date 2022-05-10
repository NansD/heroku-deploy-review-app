# Heroku Review Application

Create a Heroku review app when a PR is raised by someone with write or admin access

## Usage

```yaml
# in .github/workflows/review-app.yml
name: Heroku Review App
on:
  pull_request:
    types: [opened, reopened, synchronize, labeled, closed]
  pull_request_target:
    types: [opened, reopened, synchronize, labeled, closed]

jobs:
  heroku-review-application:
    name: Heroku Review App
    runs-on: ubuntu-latest
    steps:
      - name: Heroku Review Application
        uses: matmar10/pr-heroku-review-app@master
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          github_label: Review App
          should_comment_pull_request: true
          heroku_api_token: ${{ secrets.HEROKU_API_TOKEN }}
          heroku_pipeline_id: b3db2bf0-081c-49a5-afa8-4f6a2443ad75
```

## Available Configuration

### Inputs

- **github_token** - Github API access token; needs scope to add label to issue
- **github_label** - Text of what label should be added to each PR. If this label is added, it triggers a new build
- **should_comment_pull_request** - If true, a comment will be added to the PR when the review app is deployed
- **heroku_api_token** - Heroku API Token; generate this under your personal settings in Heroku
- **heroku_pipeline_id** - Pipeline ID configured to use review apps. You can get this from the URL in your browser.

# Acknowledgments

Thanks to [@matmar10](https://github.com/matmar10) for his [iteration](https://github.com/matmar10/heroku-review-app) on Michael's version. I've added the following features:
- ability to add a comment to the PR when the review app is deployed
- ability not to wait for the review app to be deployed (this helps saving github action minutes!)

Thanks to [Michael Heap](https://github.com/mheap) for his [original rough implementation](https://github.com/mheap/github-action-pr-heroku-review-app) from which this version is inspired.
