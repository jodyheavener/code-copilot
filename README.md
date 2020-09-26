# Code Copilot

> A GitHub App to prepare your PRs for a smooth landing

Code Copilot watches for new Pull Requests to open and uses rules you've defined to make suggestions on the PR.

## Usage

Start by [installing](https://github.com/apps/code-copilot/installations/new) Code Copilot in your repo.

Next, in your repo, create the file `.github/copilot.yml`. This will hold your diff matching rules and the tips Copilot will produce. There are currently three main configuration options:

#### `intro`

Optional. This is a message that gets appended to the intro of every Copilot PR comment. Markdown supported.

#### `references`

Required. This is an object containing all the tips Copilot can output within its PR comment. You'll reference these in your rules below.

The key should be a unique ID, and the value is a string (Markdown supported).

#### `rules`

Required. This is an array of objects containing rule sets that, when matched against the PR diff, add tips to Copilot's PR comment.

Each object must contain a `reference` key with a value set to an existing reference defined above. Beyond that you can add any of the following rule key/values to the object to build the rule set:

- `newPathMatches` (`string` or `string[]`, glob supported) - A file's new path, during a rename, matches this pattern
- `oldPathMatches` (`string` or `string[]`, glob supported) - A file's old path, during a rename, matches this pattern
- `pathMatches` (`string` or `string[]`, glob supported) - A file's path (new or old) matches this path
- `regexp` (`string` or `string[]`) - A content diff matches this regular expression (excludes deletions)
- `stringContains` (`string` or `string[]`) - A content diff contains this exact string (excludes deletions)
- `fileAdded` (`boolean`) - Any file was added
- `fileDeleted` (`boolean`) - Any file was deleted
- `fileRenamed` (`boolean`) - Any file was renamed
- `fileModified` (`boolean`) - Any file was modified

Note that multiple rules in the same object act as _AND_, while rule values supporting arrays execute their comparisons as _OR_. So you could write "The diff contains a new file path and it matches this regexp or that regexp".

**Example:**

```yml
---
intro: 'Merging requires at least one approving review and green CI.'
references:
  stored-procedures: 'Check out our docs for [stored procedures](#).'
  new-files: 'Ensure that any new files are fully tested. More info about our test process [here](#).'
  no-inline-styles: "It looks like you've added inline styles. Please use Tailwind classes or move them to a separate stylesheet."
  remove-from-s3: 'After merging you should also remove any static assets from our S3 bucket.'
rules:
- newPathMatches: "lib/db/**"
  reference: stored-procedures
- newPathMatches: "**/*.{html,jsx,tsx,js,ts}"
  reference: new-files
- regexp: 'style=".*"'
  reference: no-inline-styles
- oldPathMatches: "public/*.{png,jpg,svg}"
  reference: remove-from-s3
```

🎉 Done! Once installed and configured Code Copilot will now monitor for any new PRs to open and make suggestions according to the rules you've defined.

## Development

```sh
# Install dependencies
yarn

# Compile
yarn build

# Run
yarn start
```

## License

[ISC](LICENSE) © 2020 Jody Heavener <j.heavener@gmail.com>
