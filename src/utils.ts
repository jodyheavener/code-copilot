import fetch from 'node-fetch'
import picomatch from 'picomatch'
import { sign } from 'jsonwebtoken'
import { File } from 'gitdiff-parser'

export type Config = {
  references: {
    [id: string]:
      | {
          title: string
          url: string
        }
      | string
  }
  rules: {
    reference: string | string[]
    pathMatches?: string
    newPathMatches?: string
    oldPathMatches?: string
    newFile?: boolean
    regexp?: string
    stringMatches?: string
    stringContains?: string
  }[]
}

export type ReferenceMatch = { file: string; references: string[] }
export type MergedReferences = { [fileName: string]: string[] }

export function generateJsonWebToken() {
  return sign(
    {
      iss: process.env.APP_ID!,
    },
    process.env.PRIVATE_KEY!,
    {
      expiresIn: '10 minutes',
      algorithm: 'RS256',
    }
  )
}

export function generateAccessToken(installationId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const request = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
          method: 'post',
          headers: {
            Authorization: `Bearer ${generateJsonWebToken()}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )

      const { token, message } = await request.json()

      if (token) {
        resolve(token)
      } else {
        reject(message || 'There was an error generating an access token')
      }
    } catch (error) {
      reject(error)
    }
  })
}

export async function downloadUrl(
  url: string,
  accessToken: string
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const request = await fetch(url, {
        method: 'get',
        redirect: 'follow',
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/vnd.github.v3.diff',
        },
      })

      const data = await request.text()
      resolve(data)
    } catch (error) {
      reject(error)
    }
  })
}

export function getMatchedReferences(
  files: File[],
  rules: Config['rules']
): MergedReferences {
  return files
    .flatMap((file) => matchReferences(file, rules))
    .reduce((acc: MergedReferences, curr: ReferenceMatch) => {
      if (acc[curr.file]) {
        acc[curr.file].push(...curr.references)
      } else {
        acc[curr.file] = curr.references
      }
      return acc
    }, {})
}

export function matchReferences(
  file: File,
  rules: Config['rules'] = []
): ReferenceMatch[] {
  const references: ReferenceMatch[] = []

  rules.forEach((ruleSet) => {
    let meetsCriteria = false

    if (ruleSet.newFile) {
      meetsCriteria = file.type === 'add'
    }

    if (ruleSet.newPathMatches) {
      meetsCriteria = picomatch(ruleSet.newPathMatches)(file.newPath)
    }

    if (ruleSet.oldPathMatches) {
      meetsCriteria = picomatch(ruleSet.oldPathMatches)(file.oldPath)
    }

    if (ruleSet.pathMatches) {
      meetsCriteria =
        picomatch(ruleSet.pathMatches)(file.oldPath) ||
        picomatch(ruleSet.pathMatches)(file.newPath)
    }

    if (ruleSet.stringContains) {
      meetsCriteria = file.hunks.some((hunk) =>
        hunk.changes.some((change) =>
          change.content.includes(ruleSet.stringContains!)
        )
      )
    }

    if (ruleSet.regexp) {
      meetsCriteria = file.hunks.some((hunk) =>
        hunk.changes.some((change) => {
          const regex = RegExp(ruleSet.regexp!)
          return regex.test(change.content)
        })
      )
    }

    if (meetsCriteria) {
      references.push({
        file: file.newPath || file.oldPath,
        references: Array.isArray(ruleSet.reference)
          ? ruleSet.reference
          : [ruleSet.reference],
      })
    }
  })

  return references
}

export function pluralize(count: number, singular: string, plural: string) {
  if (count === 0) {
    return `${count} ${singular}`
  } else {
    return `${count} ${plural}`
  }
}
