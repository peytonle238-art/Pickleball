# BNHS Pickleball Club — Member Experience & Practice Night Upgrades

This upgrade elevates **BNHS Pickleball Club** with a Member-first visual overhaul featuring an interactive **Digital Member ID Card with a scannable Personal QR Pass** and **Achievement Milestones**, paired with high-efficiency Officer tools for **Bulk CSV Roster Import**, **Smart Multi-Court Matchmaking**, and a **Live Multi-Court Practice Night Scoreboard**.

## User Review & Critical Decisions

> [!IMPORTANT]
> The plan below incorporates your confirmed priorities from our design review. Please review the architecture and visual direction and click **Proceed** when ready to build.

- **Confirmed Decision 1 — Member Portal Enhancements**: Add a **Digital Member ID Card** with a personal scannable QR code (for instant officer side-line check-in) and an **Achievement Showcase** unlocking milestones for win streaks, practice attendance, and match volume.
- **Confirmed Decision 2 — Officer Practice-Night Workflows**: Add **Bulk CSV/Paste Roster Import**, a **Smart Court Generator** that balances doubles pairings across Courts 1–6 by Elo or random rotation, and a **Live Multi-Court Scoreboard** to track and record multiple simultaneous games during practice nights.
- **Confirmed Decision 3 — Implementation Priority**: Prioritize the **Member Portal experience and visual polish first**, making the Digital Member ID Pass and Achievement Showcase prominent on both the **Overview** and **My Activity** tabs while keeping member views strictly read-only for official club records.

---

## 1. Overview & Core Concept

- **What It Does**:
  - **For Members (Primary Focus)**: Transforms the Member Portal into an engaging personal athlete hub. Every member gets an interactive, flip-capable **Byron Nelson Bobcats Digital Member ID Pass** displaying their live Elo tier, club rank, attendance rate, and a unique personal QR code (`BNHS-MEMBER|<memberId>|<name>`) that officers can scan at the courts. Beneath their pass, members can track unlocked and in-progress **Club Achievements** (such as *First Victory*, *3-Match Hot Streak*, *Iron Bobcat Attendance*, and *11-0 Golden Pickle*).
  - **For Officers**: Streamlines busy after-school practices. Officers can paste or upload a CSV spreadsheet to import dozens of members in seconds, auto-generate balanced doubles or singles court assignments from present players, and run a **Multi-Court Practice Scoreboard** (Courts 1–6) that updates Elo ratings in one tap as games finish.
- **Target Audience / Persona**: High school pickleball players checking their rank, badges, and digital pass on mobile phones at the courts, alongside student officers managing 20+ players across 6 courts after school.
- **Key Value**: Gives members an immediate, rewarding reason to check the portal before and after every practice while cutting officer setup and court-rotation time from 15 minutes down to under 30 seconds.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Member Digital ID Card & QR Pass**: On the Member Portal *Overview* or *My Activity* tab, the member taps **"Show Digital ID Pass"** (or views the embedded pass card) to display a high-contrast Bobcats athlete card with their monogram, Grade, Skill/DUPR tier, live Elo rating, and a crisp SVG QR code for instant court-side verification.
  2. **Member Achievement Showcase**: In *My Activity* (and summarized on *Overview*), the member views a clean grid of 8 athletic milestones computed automatically from their real match history and practice check-ins, complete with progress bars (e.g., `2 / 3 Wins for Hot Streak`) and unlock dates.
  3. **Officer Bulk CSV Roster Import**: In *Members & Attendance*, officers open the **Bulk Import Modal**, paste rows from Google Sheets/Excel (or upload a `.csv` file) with `Name, Grade, Skill Level, DUPR, Paddle`, preview parsed rows with live validation, and commit them to the roster in one click.
  4. **Officer Smart Court Generator & Multi-Court Scoreboard**: In *Score Match* (or directly from *Attendance*), officers switch between **Single Court Detailed Referee** and **Multi-Court Practice Night (Courts 1–6)**. Officers click **"Auto-Assign Courts from Present Players"** (choosing *Elo-Balanced Competitive* or *Social Mixer*) to populate up to 6 courts simultaneously, tap scores on any court, and click **"Finish & Record Court"** to save the match and rotate the next waiting players in.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-Craft Athletic Club Hub for Members (inspired by Apple Fitness+ and Nike Training Club) paired with a crisp Executive Court Console for Officers.
  - *Color Palette & Mood*:
    - `--club-primary`: Byron Nelson Royal Blue (`#1d4ed8` / `#1e3a8a`)
    - `--club-secondary`: Championship Gold (`#eab308` / `#f59e0b`)
    - Surface Hierarchy: Daylight-first cool alabaster (`#f4f7fb`) with pure white (`#ffffff`) cards in Light Mode; deep carbon court slate (`#070b14` / `#0f172a`) in Dark Mode.
    - Semantic Signals: Emerald (`#10b981`) for victories, verified check-ins, and unlocked achievements; Amber (`#f59e0b`) for active streaks and court-in-progress states; Crimson (`#ef4444`) for defeats or approaching deadlines.
  - *Typography & Hierarchy*:
    - Display Headers & Court Callouts: `Barlow Condensed` (`font-display`) bold/extrabold with tight tracking for athletic scoreboard energy.
    - UI & Editorial Copy: `Plus Jakarta Sans` (`font-sans`) for effortless readability at `12px`–`15px`.
    - Numeric Telemetry: `JetBrains Mono` (`font-mono-num` / `tabular-nums`) enforced on all Elo ratings, game scores, countdowns, and achievement progress counters.
  - *Component Styling & Zero-Pill Discipline*:
    - Single-elevation cards with crisp `1px` borders (`border-slate-200/80 dark:border-slate-800`).
    - All static metadata (dates, grades, court numbers, match formats) rendered as clean, unboxed inline typography separated by middle dots (`·`). Interactive filter controls use segmented button bars.

- **Interactive Feedback & Motion**:
  - Smooth spring transitions (`[0.16, 1, 0.3, 1]`) when switching tabs, flipping or expanding the Digital Member ID Pass modal, and rotating court assignments.
  - Instant visual progress bars on every achievement card and live Elo delta previews (`+16 Elo`) on the Multi-Court Scoreboard.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Dynamic Computed Achievements vs. Manually Granted Badges**
  - *Chosen Approach*: Compute achievements dynamically in real time from the member's verified `matches`, `attendance`, `elo`, and `streak` records.
  - *Why*: Guarantees 100% accuracy with zero manual officer maintenance—as soon as an officer saves a match or logs attendance, the member's achievements and progress bars update automatically while preserving strict read-only security for members.
  - *Alternatives Considered*: Manual officer badge assignment was passed over because it adds extra administrative work during busy practices.

- **Decision 2 — Dual-Mode Scorekeeper (Single Court Referee vs. Multi-Court Practice Grid)**
  - *Chosen Approach*: Add a segmented mode switcher at the top of the Scorekeeper view: **Single Court (Side-Out & Server Tracking)** and **Multi-Court Practice Night (Courts 1–6 + Smart Generator)**.
  - *Why*: Preserves the detailed USA Pickleball `0-0-2` server-side court diagram for featured ladder/tournament matches while giving officers a fast, bird's-eye 6-court grid for chaotic after-school open play.
  - *Alternatives Considered*: Replacing the single-court referee view would lose the side-out server tracking required for official matches.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   ClubDataState (localStorage + Firestore)                 │
│     members[] · matches[] · attendance[] · clubTournaments[] · tasks[]     │
└──────────────────┬──────────────────────────────────────┬──────────────────┘
                   │ (Read-Only + Profile Link)           │ (Full Officer PIN 9002)
                   ▼                                      ▼
┌─────────────────────────────────────────┐  ┌───────────────────────────────┐
│        MEMBER ATHLETE PORTAL            │  │    OFFICER COMMAND CONSOLE    │
├─────────────────────────────────────────┤  ├───────────────────────────────┤
│ ┌─────────────────────────────────────┐ │  │ ┌───────────────────────────┐ │
│ │ Digital Member ID Pass & QR Modal   │ │  │ │ Bulk CSV Roster Importer  │ │
│ │ • Personal SVG QR (BNHS-MEMBER|...) │ │  │ │ • Paste / File CSV Parser │ │
│ │ • Live Rank, Elo Tier & Attendance  │ │  │ │ • Live Preview & Commit   │ │
│ └─────────────────────────────────────┘ │  │ └───────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │  │ ┌───────────────────────────┐ │
│ │ Achievement & Milestone Engine      │ │  │ │ Smart Court Generator &   │ │
│ │ • Streak, Attendance & Match Goals  │ │  │ │ Multi-Court Scoreboard    │ │
│ │ • Progress Bars & Unlock Status     │ │  │ │ • Elo-Balanced / Mixer    │ │
│ └─────────────────────────────────────┘ │  │ │ • 6-Court Live Score Grid │ │
│ ┌─────────────────────────────────────┐ │  │ │ • 1-Tap Save to History   │ │
│ │ Overview & My Activity Views        │ │  │ └───────────────────────────┘ │
│ └─────────────────────────────────────┘ │  └───────────────────────────────┘
└─────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Computed Member Achievements**: Derived via a pure helper that evaluates each member's match list, win streak, attendance sessions, and Elo rating across 8 milestones:
    1. *First Court Check-In* (Attend 1+ practice session)
    2. *Dedicated Bobcat* (Attend 5+ practice sessions or maintain 80%+ attendance across 3+ sessions)
    3. *First Official Win* (Win 1+ recorded club match)
    4. *On Fire Streak* (Reach a 3+ match win streak)
    5. *Unstoppable Force* (Reach a 5+ match win streak)
    6. *Club Veteran* (Compete in 10+ official club matches)
    7. *Varsity Contender* (Reach 1,250+ Club Elo rating)
    8. *Golden Pickle* (Win a game by 7+ points or shutout 11–0)
  - **Multi-Court Practice State**: Stored in local state (and persisted in `localStorage` so court assignments survive tab switches during practice) with up to 6 active court slots (`courtNumber`, `format`, `team1Ids`, `team2Ids`, `team1Score`, `team2Score`, `targetScore`, `status`).

- **Interactive Component & State Mapping**:
  - **Digital Member ID Card (`MemberPortalView`)**:
    - Clicking **"Digital ID Pass"** opens a high-contrast pass modal (or expands the pass view) rendering a deterministic SVG QR matrix encoding `BNHS-MEMBER|<member.id>|<member.name>`, member stats, and season verification status.
    - Officers scanning a `BNHS-MEMBER|...` token in the Attendance QR Scanner automatically mark that specific member present for the active practice session.
  - **Bulk CSV Importer (`MembersAttendanceView`)**:
    - Parses comma- or tab-separated lines (`Name, Grade, SkillLevel, DUPR, Paddle`), normalizes grade (`9`–`12`) and skill level (`Beginner`, `Intermediate`, `Advanced`), skips duplicates by name, and appends new `Member` records with initial `1200` Elo.
  - **Smart Court Generator & Multi-Court Scoreboard (`LiveScoreKeeper`)**:
    - Filters available players (either from today's present attendance list or full roster), sorts by Elo (for *Competitive Elo Balance*) or shuffles (for *Social Mixer*), pairs players into 4-player doubles courts (or 2-player singles courts), and lists any remaining players in the **Next Up Queue**.
    - Officers increment/decrement scores directly on each court card and click **"Record Match"** to compute the Elo delta, save the `MatchRecord` to history, and clear the court for the next group.
