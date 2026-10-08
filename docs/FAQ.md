# FAQ

Short answers, with a link to the long one.

### What does it cost?

Nothing. openGym is open source under the AGPL: no subscription, no paid tier, no ads. If you'd like
to support it anyway, there's [Buy Me a Coffee](https://buymeacoffee.com/duartesantos).

### Do I need my own server?

No, there are three ways to use it:

- **Try it:** the [online demo](https://opengym.duarte-santos.ch/demo/) runs entirely in your
  browser with example data.
- **Phone only:** the Android app needs no server and no account; everything stays on the phone.
  See [MOBILE.md](MOBILE.md).
- **Your own instance:** `docker compose up` on any machine with Docker gives you sync between
  devices and profiles for friends and family. See [SELF_HOSTING.md](SELF_HOSTING.md).

### Is there an iPhone app?

Not in the App Store, and Apple doesn't allow installing apps from anywhere else. On an iPhone you can
self-host and add openGym to your home screen from Safari (it's a full PWA that works offline), or
build the native app onto your own phone with Xcode. Both are described in [MOBILE.md](MOBILE.md).
An App Store build is on the [roadmap](../ROADMAP.md).

### Why isn't it on the Play Store?

That's deliberate. The APK is signed, published with a `.sha256` next to every release, and the app
checks for updates itself. Get it from the
[latest release](https://github.com/DuarteSantos8/openGym/releases/latest).

### Where is my data?

On a self-hosted instance, in the `./data` folder next to `docker-compose.yml`: one JSON file per
profile plus the account list. Back up that folder and you've backed up everything. In the phone app
it's in the app's private storage. In guest mode it's only in that browser. You can export
everything as one file at any time under **Settings → Data**.

### Does the app send anything anywhere?

Your instance has no telemetry and phones home to nobody. On first start it downloads the exercise
images and animations from the upstream dataset, once. The AI coach, if an admin turns it on, sends
the training data it needs to the provider you configured; [AI_COACH.md](AI_COACH.md) lists exactly
what. Push notifications go through your browser's push service, as all web push does.

### Was openGym written with AI?

It's developed with [Claude Code](https://claude.com/claude-code), Anthropic's coding agent, and a
large share of the code, tests and docs is drafted that way. The maintainer decides what goes in,
reviews it, and tests every release on a staging instance and on real phones. The longer answer is in
the [README](../README.md#how-opengym-is-built).

### Does the app itself use AI?

Only if you turn it on. The default install calls no AI service. Two optional pieces exist: the
[AI coach](AI_COACH.md) (off until an admin enables it, runs with your own provider key, every
change needs your approval) and the [MCP server](../mcp/README.md), which lets an AI client on your
computer read your history. Neither is needed for anything else in the app.

### My passkey sign-in doesn't work.

Almost always one of two things:

1. You're opening it over plain `http://` on a LAN address. Passkeys only work over HTTPS (or on
   `localhost`). Use guest mode, turn on password sign-in, or put it behind HTTPS.
2. `RP_ID` and `ORIGIN` in `.env` don't match the address in your browser exactly.

[SELF_HOSTING.md](SELF_HOSTING.md#2-understand-the-passkey-requirement-important) explains both, and
its troubleshooting section covers the rarer cases.

### Can I use a password instead of a passkey?

Yes, if the instance allows it: set `PASSWORD_LOGIN=1`. It's off by default. See
[password sign-in](SELF_HOSTING.md#password-sign-in-optional).

### Can several people use one instance?

Yes. Everyone creates their own profile and sees only their own data. You can make signup
invite-only and give yourself an admin dashboard; see
[multiple users](SELF_HOSTING.md#4-multiple-users).

### How do I update?

`git pull && docker compose pull && docker compose up -d`. Your data is untouched. See
[updating](SELF_HOSTING.md#8-updating).

### I'm moving from another app. Can I bring my history?

FitNotes, Strong and Hevy work out of the box, Apple Health for body weight, and any CSV with a date,
an exercise and something measured. See [DATA_IMPORTS.md](DATA_IMPORTS.md).

### How does daily gym check-in work?

Open **Daily check-in** on Home and take or choose a still gym photo. Each local calendar date
counts once; replacing today's photo does not add another check-in. Only today's record can be
replaced or deleted, and deleting it lets you check in again that day. There is no backfill.
**Check-in history** is a monthly calendar: checked-in dates are highlighted and marked with
  a dot, today is outlined, and tapping a marked date opens its photo and date. Switch months
  to review older records; past photos remain read-only.

Honors unlock at **7, 30, 100 and 365 cumulative dates**, with no points. Consecutive days are
tracked separately: yesterday's streak remains while today is pending; missing a whole day
breaks that streak but not the cumulative total.
Each honor badge has a ring showing progress toward its milestone; completed badges light up
with a checkmark. Completion is capped at a full ring, and screen readers receive the counts.

Photos have **no automatic expiry** while their records remain. Clearing app storage, resetting
everything or deleting the profile still removes data. **Export with photos & videos (.zip)**
keeps the photos too; an ordinary JSON backup holds references, not image bytes. Upgrade the
API together with the app for photo sync: an older server cannot retain check-in photos.
The app does not verify the photo's location or authenticity, and no gym QR code is needed.

### Can openGym read exercise instructions aloud?

Yes. Use **Read instructions** below the media in an exercise detail, or below an exercise title during a workout. It reads the existing steps in the current language with a local device voice; pause then resume restarts the current step. The workout screen also has an optional **Auto narration** switch for that session only: it is off by default and reads each exercise ID at most once. Install or enable a local voice for the language in your device settings if the control says none is available. Narration stops when you close the entry, switch language, leave the page or put the app in the background; it does not promise lock-screen playback.

### Can I reuse the exercise images in my own project?

Not on openGym's say-so. The images and animations aren't covered by openGym's license and their
ownership is disputed; openGym only downloads them for your instance. Details in
[NOTICE.md](../NOTICE.md).

### Where do I ask something that isn't here?

The [Discord](https://discord.gg/e62jY6fwVb) for a quick answer,
[Discussions](https://github.com/DuarteSantos8/openGym/discussions) if the next person should be
able to find it, [Issues](https://github.com/DuarteSantos8/openGym/issues) for a bug.
