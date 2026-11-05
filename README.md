# Pemberani Tournament · Edition 3.0

Campaign site, live scores, fixtures, standings and bracket for the Pemberani Badminton Club tournament.
Static site for GitHub Pages, with Firebase Realtime Database for live scoring. No build step and no frameworks:
plain HTML, CSS and JavaScript modules.

**Edition 3.0:** Saturday 5 December 2026 · 10 AM – 5 PM · Andalas Sports Complex · Courts C4 and C5.

Both Edition 3.0 pages have an **EN / BM** switch at the top. The choice is remembered on that phone, and phones set to Malay open in BM.

| Page | Who uses it |
| --- | --- |
| `index.html` | Everyone: the Edition 3.0 campaign (hero, statement, champions, format, line-up, live match centre, standings, bracket, prizes) |
| `live.html` | Match day: fast page with live courts, fixtures, standings, bracket and pairs. No intro animation. Share this on the day |
| `score.html` | Umpires and committee: tap-to-score console (sign-in required) |
| `edition2/` | Edition 2.0 site and e-certificates, kept as an archive (`cert.html` in the root redirects there) |
| `family-scoreboard.html` | Thursday Family Night live scoreboard (currently #2, Diwali Edition) |
| `family-night-1.html` | Family Night #1 (8 Oct 2026), read-only archive |

## Files

```
index.html            Edition 3.0 campaign page
live.html             Edition 3.0 match centre
score.html            scorer console
css/e3.css            Edition 3.0 styling
css/style.css         scorer console base styling
js/config.js          ← dates, pairs, groups, rules, prizes, photos. Edit this one.
js/e3/site.js         campaign page wiring
js/e3/live.js         match centre, standings, bracket, pair cards (shared by both pages)
js/e3/motion.js       scroll animations, nav, cursor, countdown
js/e3/i18n.js         EN / BM text (static page text and live labels)
js/logic.js           scoring rules, standings, bracket
js/store.js           Firebase / demo data layer
js/score.js           scorer console behaviour
js/firebase-config.js Firebase web config
assets/e3/            Edition 3.0 photos and the link-preview image (og.jpg)
```

## Try it without Firebase

- `index.html?demo` or `live.html?demo`: empty tournament. Scores are kept in this browser only.
- `index.html?demo=sim`: fills in simulated results (all group matches, quarter-finals, a live semi-final)
  so you can see standings, bracket and scoreboards working. Clear site data to reset.
- Open `score.html?demo` in another tab and score a rally: the other tab updates instantly.

To preview locally, run this from the project folder and open http://localhost:8765/?demo=sim:

```bash
python3 -m http.server 8765
```

## Before the day: what to update in `js/config.js`

1. **The draw.** Replace each placeholder pair with the real one, then set `DRAW_CONFIRMED = true`:
   ```js
   { id: 'g1p1', name: 'Pok & Daus', players: ['Pok', 'Daus'] },
   ```
   Keep the `id`s as they are (`g1p1`…`g1p6` for Group A, `g2p1`…`g2p6` for Group B). Pair 1–6 order follows the
   group poster, which decides the order of play (`GROUP_ORDER`).
2. **Knockout rules.** The captain said "15 points, best of 3". The config assumes win by 2, capped at 21
   (`knockout: { bestOf: 3, target: 15, deuce: true, cap: 21 }`). Change `cap` or `deuce` if the captain decides otherwise.
3. **Prize amounts.** Update the Rewards text in `index.html` (English) and the `pz.cash` line in `js/e3/i18n.js` (BM).
4. **Photos.** Upload them to `assets/e3/` using these names, then list them in `PHOTOS`:

   | File | Where it shows | Best shape |
   | --- | --- | --- |
   | `hero.jpg` | Full-screen opening, behind the title | Landscape, action, subject on the right |
   | `story-1.jpg`, `story-2.jpg`, `story-3.jpg` | Behind "This is not just a game" lines | Landscape or portrait, dramatic |
   | `champions-e2.jpg` | Defending champions (Pok & Daus) | Portrait (4:5) |
   | `gallery-01.jpg` … `gallery-16.jpg` | Drag-to-scroll gallery (set `GALLERY_COUNT`) | Any |

   Example: `export const PHOTOS = ['hero', 'champions-e2'];` and `export const GALLERY_COUNT = 9;`
   Phone photos are fine. Keep each under about 500 KB (long side about 2000 px). The site greys and darkens them to fit the look.

## Firebase: one change needed for Edition 3.0

Edition 3.0 stores scores under `/pt3`, so Edition 2.0 results under `/pt2` stay untouched.
In the [Firebase console](https://console.firebase.google.com/project/pemberani-badminton) go to
**Realtime Database → Rules** and add a `pt3` block next to the existing `pt2` block, with the same rules:

```json
"pt3": {
  ".read": true,
  ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
}
```

Click **Publish**. Scorer accounts and the `admins` list from Edition 2.0 keep working.

If Firebase can't be reached, the pages fall back to demo mode and show a yellow "Demo" badge, so a broken connection is visible.

## On the day

- **Share `live.html`** in the WhatsApp group. It loads fast and goes straight to the scores.
- **Umpires** open `score.html`, sign in, and pick their court (**C4 · Group A** or **C5 · Group B**). Tap **Start**,
  choose who serves, then tap a team's panel for every rally. Groups stop at 21; knockouts are best of three to 15.
  **Undo** reverses the last rally, even after a match has ended.
- **Knockouts fill themselves** once both groups are done (top 4 cross over: A1 v B4, B2 v A3, B1 v A4, A2 v B3).
  For a tie that needs a committee decision, use **Committee tools → Knockout draw overrides**.
- **Wrong result?** **Committee tools → Correct a result** resets a match so it can be rescored.

## Design notes

- Scroll animations use CSS `position: sticky` and one small scroll handler, with no animation library, so it stays smooth on cheaper phones.
- Visitors with "Reduce Motion" switched on get gentle fades instead of movement, and the statement lines are shown one after another.
- Any new text needs a BM version: add a `data-i18n` key in the HTML and the translation in `js/e3/i18n.js`.

## Thursday Family Night

`family-scoreboard.html` is the link that gets shared, so it always holds the latest night.
When a night is over, copy it to `family-night-N.html`, make the inputs read-only, and build the next one in its place.

- **Night #2 · Diwali (5 Nov 2026):** 15 rounds = every possible 2-vs-2 match-up of the 5 players exactly once.
  Three sets of five; each player sits out once per set and never twice in a row. After round 10 every pair has
  partnered twice (a fair place to stop); after round 15, three times. Scores are stored under
  `familyNight/scores/n2r0` … `n2r14`. Night #1 used `r0` … `r9` in the same node, so no rule changes are needed.
