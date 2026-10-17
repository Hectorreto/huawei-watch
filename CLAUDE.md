# huawei-watch

The project is just starting. As soon as its shape is clear (what it builds, for which watch and OS, language, tools and their paths), replace this paragraph with a short summary and a list of the main folders.

## Conventions

- Commit messages, the README and user-facing conversation are in Spanish. Code, comments and the docs in `docs/` are in English.
- One concern per commit. Do not push or open a PR unless asked.
- Check `git diff --ignore-cr-at-eol --stat` before committing so a line-ending change does not turn a small edit into a whole-file diff.

## Verifying changes

Not defined yet. Once there is a way to build and run the project (emulator, real watch, tests), write it here and in a `docs/` note, and verify every change that way before reporting it as done. Before reporting a bug as new, check `docs/known-issues.md`.

## Docs

`docs/` holds lessons learned the hard way, including approaches that already failed. Read the matching doc BEFORE starting the task. When you learn something new, add or update a doc (in English) and its line here.

How to write them:

- One doc per task, named for what you do (`build-and-install-on-the-watch.md`), short enough to read whole.
- Record what did not work and why, not only what did, so it is not tried again.
- Describe the current state; when something changes, update the doc instead of appending history.
- Each line below says when to read the doc: `task or symptom → doc`.

- Something looks wrong and you need to know whether it is already known or unfinished → `docs/known-issues.md`
