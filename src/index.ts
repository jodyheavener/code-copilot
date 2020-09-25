import { Application } from 'probot'
import gitDiffParser from 'gitdiff-parser'
import {
  Config,
  downloadUrl,
  generateAccessToken,
  getMatchedReferences,
  pluralize,
} from './utils'

export = (app: Application) => {
  app.on('pull_request.opened', async (context) => {
    const { url } = context.payload.pull_request
    const { id: installationId } = context.payload.installation
    const config = (await context.config('copilot.yml')) as Config

    if (!url || !installationId || !config) {
      return
    }

    const accessToken = await generateAccessToken(installationId)
    const diffString = await downloadUrl(url, accessToken)
    const parsedDiff = gitDiffParser.parse(diffString)
    const matchedReferences = getMatchedReferences(parsedDiff, config.rules)

    const references = Object.values(matchedReferences)
      .flatMap((ref) => ref)
      .filter((ref) => !!config.references[ref])
      .map((ref) => config.references[ref])

    if (!references.length) {
      return
    }

    let body = `✈️ Let's prepare your PR for a smooth landing. Based on the ${pluralize(
      parsedDiff.length,
      'file',
      'files'
    )} changes in this PR you should keep the following in mind:\r\r`

    references.forEach((ref) => {
      if (typeof ref === 'string') {
        body += `- ${ref}\r`
      } else {
        body += `- [${ref.title}](${ref.url})\r`
      }
    })

    await context.github.issues.createComment(
      context.issue({
        body,
      })
    )
  })
}
