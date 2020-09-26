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

    if (
      !url ||
      !installationId ||
      !config ||
      !config.references ||
      !config.rules
    ) {
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

    const introText = config.intro ? ` ${config.intro}` : ''
    const fileChangeCount = pluralize(parsedDiff.length, 'file', 'files')
    let body = `Code Copilot here! ✈️ Let's prepare your PR for a smooth landing.${introText}\r\r`
    body += `Based on the **${fileChangeCount}** changed in this PR I've put together these tips:\r`

    references.forEach((ref) => {
      body += `- ${ref}\r`
    })

    await context.github.issues.createComment(
      context.issue({
        body,
      })
    )
  })
}
