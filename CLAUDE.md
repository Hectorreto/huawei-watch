# huawei-watch

A minimal app for a Huawei Watch GT 6 Pro: a black screen showing a number that starts at 0 and goes up by 1 on every tap. The main goal is finding out whether a self-built app can be installed on this watch at all; the GT 6 series is a Lite Wearable (HarmonyOS on LiteOS, JS FA apps). Available to test with: a Windows PC (this one), a Mac, an Android phone and an iPhone.

- **App:** `Counter/` is the DevEco Studio project (Lite Wearable, JS FA). Its page is `Counter/entry/src/main/js/MainAbility/pages/index/`.
- **Tools:** DevEco Studio 6.1.1 at `E:\Programs\Huawei\DevEco Studio`, with its bundled SDK 6.1.1(24). See `docs/create-and-preview-the-app.md`.

## Conventions

- Commit messages, the README and user-facing conversation are in Spanish. Code, comments and the docs in `docs/` are in English.
- One concern per commit. Do not push or open a PR unless asked.
- Check `git diff --ignore-cr-at-eol --stat` before committing so a line-ending change does not turn a small edit into a whole-file diff.

## Verifying changes

For now, in DevEco Studio's Previewer: open `index.hml`, click Previewer and tap the watch screen (see `docs/create-and-preview-the-app.md`). Installing on the real watch does not work yet; once it does, check every change on the watch too. Before reporting a bug as new, check `docs/known-issues.md`.

## Docs

`docs/` holds lessons learned the hard way, including approaches that already failed. Read the matching doc BEFORE starting the task. When you learn something new, add or update a doc (in English) and its line here.

How to write them:

- One doc per task, named for what you do (`build-and-install-on-the-watch.md`), short enough to read whole.
- Record what did not work and why, not only what did, so it is not tried again.
- Describe the current state; when something changes, update the doc instead of appending history.
- Each line below says when to read the doc: `task or symptom → doc`.

- Creating the DevEco project, its settings, or checking the app in the Previewer → `docs/create-and-preview-the-app.md`
- Choosing the toolchain, signing an app or installing it on the Watch GT 6 Pro (Android, iPhone, Gadgetbridge) → `docs/choose-a-development-path.md`
- Something looks wrong and you need to know whether it is already known or unfinished → `docs/known-issues.md`
