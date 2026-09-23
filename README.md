# Pemberani Tournament · Edition 2.0

Live scores, fixtures, standings and bracket for the Pemberani Badminton Club tournament.
Static site for GitHub Pages, with Firebase Realtime Database for live scoring.

| Page | Who uses it |
| --- | --- |
| `index.html` | Everyone: live courts, fixtures, standings, bracket, format, hall of fame |
| `score.html` | Umpires and committee: tap-to-score console (sign-in required) |
| `index-edition1.html` | Edition 1 site, kept as a read-only archive |

## Files

```
index.html            public site
score.html            scorer console
css/style.css         all styling
js/config.js          ← pairs, fixtures, rules, knockout draw. Edit this one.
js/firebase-config.js Firebase web config
js/store.js           Firebase / demo data layer
js/logic.js           scoring rules, standings, bracket
js/app.js             public site behaviour
js/score.js           scorer console behaviour
database.rules.json   Firebase security rules (paste into the console)
assets/               web-sized images
```

## Try it without Firebase

Add `?demo` to any URL, for example `index.html?demo` and `score.html?demo`.
Scores are kept in that browser only. Open both pages in two tabs and score on one:
the other updates instantly.

To preview locally, run this from the project folder and open http://localhost:8765/?demo:

```bash
python3 -m http.server 8765
```

(Opening the HTML file directly with `file://` won't work, because browsers block ES modules there.)

## Firebase setup (one time, about 10 minutes)

The site reuses your existing Firebase project **pemberani-badminton**. The config is already in
`js/firebase-config.js`. Edition 2 data lives under `/pt2`, so Edition 1 data under `/tournament` is untouched.

1. **Turn on sign-in.** In the [Firebase console](https://console.firebase.google.com/project/pemberani-badminton) go to
   **Build → Authentication → Get started → Sign-in method** and enable **Email/Password**.
2. **Create scorer accounts.** Under **Authentication → Users → Add user**, add one account per umpire
   (or one shared `scorer@…` account). Copy each user's **User UID**.
3. **Mark them as admins.** Go to **Build → Realtime Database → Data**. At the root, add a child named
   `admins`. Under it, add each UID as a key with the value `true`:
   ```
   admins
     ├─ Xy12AbC...  : true
     └─ Pq98ZyX...  : true
   ```
4. **Lock the database.** Go to **Realtime Database → Rules**, replace everything with the contents of
   `database.rules.json`, and click **Publish**.
   - Anyone can *read* `/pt2`, so spectators see live scores.
   - Only signed-in users listed in `/admins` can *write*.
   - `/tournament` (Edition 1) becomes read-only.
5. **Authorise your domain.** Under **Authentication → Settings → Authorized domains**, add
   `<your-github-username>.github.io`.
6. **Stop public sign-ups (recommended).** Under **Authentication → Settings → User actions**, untick
   **Enable create (sign-up)**. Only accounts you add yourself will exist. The admin list already blocks
   strangers, so this is a second layer of protection.

> The old site checked a passcode in the browser. Anyone could read that passcode in the page source and write to the
> database directly. The new rules are enforced on Firebase's servers, so nobody outside the admin list can change a score.

## Deploy to GitHub Pages

Upload everything **except** the large originals (`*.png` in the root, `pemberani_medals.pdf`, `Certificates/`).
The site only needs `index.html`, `score.html`, `index-edition1.html`, `logo.png` (used by the archive page), `css/`,
`js/`, `assets/`. Then turn on **Settings → Pages → Deploy from branch → main / root**.

## On the day

- **Umpires** open `score.html` on their phones, sign in, and pick their court. Each court's list shows
  only its own group's matches, in order. Tap **Start**, choose who serves first, then tap a team's panel
  for every rally. The console tracks the server and service court, calls game point, match point and the
  interval at 11, and stops the game automatically at 21 (no deuce in groups; deuce up to 30 in knockouts).
  **Undo** reverses the last rally, even after the match has ended. The screen stays awake while a match is live.
- **Venue screen:** open `index.html?tv` on a laptop plugged into a TV, or tap **TV mode** on the site.
- **Knockouts fill themselves** once all 8 matches in both groups are done. If a tie needs a committee
  decision, use **Committee tools → Knockout draw overrides** in the scorer console.
- **Wrong result?** Go to **Committee tools → Correct a result** to reset a match so it can be rescored.

## Changing things

Everything lives in `js/config.js`:

- `startsAt`: set the first-serve time, for example `'2026-10-04T08:00:00+08:00'`. This turns on the hero countdown
  and approximate start times in the fixtures list.
- `GROUP_ORDER`: the 8 group matchups and their order of play, using the poster's pair numbers (1–6).
- `RULES`: points per game, deuce and cap, best-of for each stage.
- `KNOCKOUT`: who meets whom, and which court each knockout match is on.
