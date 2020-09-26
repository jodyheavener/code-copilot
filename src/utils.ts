import fetch from 'node-fetch'
import picomatch from 'picomatch'
import { sign } from 'jsonwebtoken'
import { File } from 'gitdiff-parser'

export type Config = {
  intro?: string
  references: {
    [id: string]: string
  }
  rules: {
    reference: string | string[]
    pathMatches?: string | string[]
    newPathMatches?: string | string[]
    oldPathMatches?: string | string[]
    regexp?: string | string[]
    stringContains?: string | string[]
    fileAdded?: boolean
    fileDeleted?: boolean
    fileRenamed?: boolean
    fileModified?: boolean
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

export function makeArray(item: any) {
  if (Array.isArray(item)) {
    return item
  } else {
    return [item]
  }
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

    if (ruleSet.fileAdded) {
      meetsCriteria = file.type === 'add'
    }

    if (ruleSet.fileDeleted) {
      meetsCriteria = file.type === 'delete'
    }

    if (ruleSet.fileModified) {
      meetsCriteria = file.type === 'modify'
    }

    if (ruleSet.fileRenamed) {
      meetsCriteria = file.type === 'rename'
    }

    if (ruleSet.newPathMatches) {
      const newPathMatches = makeArray(ruleSet.newPathMatches)
      meetsCriteria = newPathMatches.some((filePath: string) =>
        picomatch(filePath)(file.newPath)
      )
    }

    if (ruleSet.oldPathMatches) {
      const oldPathMatches = makeArray(ruleSet.oldPathMatches)
      meetsCriteria = oldPathMatches.some((filePath: string) =>
        picomatch(filePath)(file.oldPath)
      )
    }

    if (ruleSet.pathMatches) {
      const pathMatches = makeArray(ruleSet.pathMatches)
      meetsCriteria = pathMatches.some(
        (filePath: string) =>
          picomatch(filePath)(file.oldPath) || picomatch(filePath)(file.newPath)
      )
    }

    if (ruleSet.stringContains) {
      const stringChecks = makeArray(ruleSet.pathMatches)
      meetsCriteria = stringChecks.some((stringCheck: string) =>
        file.hunks.some((hunk) =>
          hunk.changes
            .filter((change) => ['insert', 'normal'].includes(change.type))
            .some((change) => change.content.includes(stringCheck))
        )
      )
    }

    if (ruleSet.regexp) {
      const regexps = makeArray(ruleSet.regexp)
      meetsCriteria = regexps.some((regexp: string) =>
        file.hunks.some((hunk) =>
          hunk.changes
            .filter((change) => ['insert', 'normal'].includes(change.type))
            .some((change) => {
              const regex = RegExp(regexp)
              return regex.test(change.content)
            })
        )
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
