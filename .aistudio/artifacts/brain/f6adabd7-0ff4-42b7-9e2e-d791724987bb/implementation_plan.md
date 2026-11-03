# BNHS Pickleball Club: Competitive Rivalry, Challenge Board & Achievement Suite

This plan introduces an interactive **Player Challenge Board**, a **Head-to-Head Rivalry & Win Probability Calculator**, and an expanded **Varsity Achievement & Milestone Streak Showcase** across both the Member Hub and Officer Command Console, synchronized in real time across all devices via Firestore.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following feature scope and placement decisions reflect your selections and are ready for your review before implementation:

- **Confirmed Decision 1 — Competitive & Fun Features**:
  1. **Player Challenge Board**: Members can call out rivals on the ladder with a proposed match format, target score, and callout note; opponents can accept or decline, and officers can resolve/score accepted challenges with one click.
  2. **Head-to-Head Rivalry & Win Probability Calculator**: Side-by-side matchup analyzer calculating exact Elo win probability percentages, projected Elo rating stakes (`+Win / -Loss`), all-time head-to-head record, and point differential between any two club members.
  3. **Achievement Badges & Milestone Streaks on Profiles**: Expanded varsity achievement system with streak tracking and tier progress visible both in the Member Hub and inside expandable player profiles on the Club Ladder.
- **Confirmed Decision 2 — Dual-Portal Integration**: All three capabilities will be available in **both the Member Hub and the Officer Command Console**, maintaining our clean **Varsity Athletic Editorial** design (flat surfaces, `1px` structural borders, tabular numerals, and zero pill/gradient clutter).

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the club website from a passive standings table into an active competitive arena where members can analyze matchups, call out rivals near their ladder rank, track head-to-head history, and unlock varsity milestones that automatically update as matches are logged.
- **Target Audience / Persona**:
  - **Club Members**: Sign in with their School ID to issue or accept ladder challenges, compare their stats and win odds against any rival, and track their personal achievement progress.
  - **Club Officers & President**: Monitor open challenges across the club, launch or record official scores for accepted callouts with a single click, and inspect player achievement milestones on the ladder.
- **Key Value**: Drives daily member engagement between practices while streamlining how officers organize competitive ladder matches at practice.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Issuing & Accepting a Ladder Challenge (Member Hub & Officer Console)**:
   - A signed-in member opens the **Challenge Board & Rivalry** section, picks an opponent from the roster, selects format (`Singles` or `Doubles`) and target score (`11`, `15`, or `21`), views the automatic **Elo Win Probability & Stakes Preview**, adds an optional callout note (e.g., *"Court 1 after school Thursday"*), and submits the challenge.
   - The challenge appears immediately on the **Live Club Challenge Board** with status `OPEN CALLOUT`.
   - When the challenged player signs in with their School ID, they see a highlighted incoming callout banner where they can click **Accept Challenge** (moving status to `ACCEPTED · READY FOR COURT`) or **Decline**.
   - Officers see all `OPEN` and `ACCEPTED` challenges in the Standings & Ladder view and can click **Record Official Result** to log the score, automatically updating both players' Elo ratings, streaks, and marking the challenge `COMPLETED`.
2. **Head-to-Head Rivalry & Win Probability Calculator**:
   - Any member or officer selects **Player A** and **Player B** (defaults to the signed-in member vs. their closest ladder rival).
   - The analyzer displays a flat varsity split-meter showing **Expected Win Probability (%)** derived from the club's K=32 Elo formula, **Projected Rating Stakes** (`+X Elo` for an upset vs. `+Y Elo` for the favorite), **All-Time Head-to-Head Record** (`Wins – Losses`), **Head-to-Head Points Scored**, and a list of their past meetings.
   - Includes a direct **Issue Challenge to This Rival** action button that pre-fills the Challenge Board.
3. **Profile Achievement Showcase & Milestone Streaks**:
   - Adds new competitive milestones (including **Rivalry Challenger**, **Giant Slayer / Upset Winner**, **Century Point Scorer**, **Undefeated Week**, alongside attendance and streak honors).
   - Clicking any player row on the **Official BNHS Elo Club Ladder** expands their varsity scouting card showing their unlocked honors, active streak status, recent match log, and quick Head-to-Head comparison trigger.

### Visual Identity & Theme

- **Aesthetic Direction**: **Varsity Athletic Editorial** — flat architectural surfaces, crisp `1px` borders (`border-slate-200 dark:border-slate-800`), `rounded-md` / `rounded-lg` geometry, and zero nested card sandwiches.
- **Color Palette & Mood**:
  - **60% Neutral Canvas**: Crisp light slate (`#F8FAFC`) and deep navy slate (`#020617`) in dark mode.
  - **30% Structural Surfaces**: Pure white (`#FFFFFF`) / slate-900 (`#0F172A`) containers with hairline dividers and scoreboard headers.
  - **10% Accent Budget**: Byron Nelson Royal Blue (`#1D4ED8`) for primary actions and Player A telemetry, Athletic Gold (`#EAB308`) for active streaks and challenge callouts, and Emerald (`#16A34A`) for completed/unlocked states.
- **Typography & Hierarchy**:
  - **Display Headers**: `Barlow Condensed` bold uppercase with tight tracking for scoreboard headers, matchup titles, and section kickers.
  - **Body Copy**: `Plus Jakarta Sans` for clean scannability.
  - **Data & Telemetry**: `JetBrains Mono` (`font-mono-num tabular-nums`) for all Elo ratings, win probabilities (`64% vs 36%`), point differentials, and dates.
- **Interactive Feedback & Motion**: Instant `<150ms` tab transitions, horizontal probability split bar with smooth width transitions, and toast confirmation when challenges are issued, accepted, or settled.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Real-Time Challenge Persistence in Global Club Workspace**
  - *Chosen Approach*: Store the `challenges` list directly inside the synchronized `ClubDataState` payload in Firestore (`clubWorkspaces/bnhs_global_club`).
  - *Why*: Ensures every challenge issued or accepted by a student on their phone appears instantaneously on every other member's and officer's device without requiring additional Firestore collection rules or extra network listeners.
  - *Alternatives Considered*: Separate `localStorage`-only challenges (rejected because rivals on different devices wouldn't see callouts).
- **Decision 2: Exact Elo-Driven Win Probability & Upset Detection**
  - *Chosen Approach*: Compute win probability using the exact logistic curve $P(A) = \frac{1}{1 + 10^{(R_B - R_A)/400}}$ paired with the club's $K=32$ stakes engine, and automatically detect "Giant Slayer" upsets when a lower-rated player defeats an opponent rated $50+$ Elo higher.
  - *Why*: Gives players authentic, mathematically grounded pre-match stakes that match the actual Elo points awarded when the match is recorded.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│             Firestore Real-Time Sync (clubWorkspaces/bnhs_global_club)  │
│  ClubDataState: members, matches, attendance, tournaments, challenges   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              ▼                                           ▼
┌───────────────────────────────────────┐   ┌─────────────────────────────┐
│        Member Hub Portal              │   │   Officer Command Console   │
│  - School ID Account Context          │   │  - Overview Challenge Feed  │
│  - My Activity & Varsity Badges       │   │  - Standings & Rivalry Hub  │
│  - Standings, Rivalry & Callout Board │   │  - 1-Click Challenge Settle │
└─────────────────┬─────────────────────┘   └──────────────┬──────────────┘
                  │                                        │
                  └───────────────────┬────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 Shared Competitive & Analytics Engine                   │
│  ┌─────────────────────────┐ ┌───────────────────┐ ┌─────────────────┐  │
│  │ Head-to-Head & Win Odds │ │ Challenge Board   │ │ Varsity Badge & │  │
│  │ Calculator              │ │ Lifecycle Handler │ │ Streak Engine   │  │
│  │ - Logistic Elo %        │ │ - Issue Callout   │ │ - 10 Milestones │  │
│  │ - H2H W-L & Pt Diff     │ │ - Accept/Decline  │ │ - Upset & Point │  │
│  │ - Projected ±Elo Stakes │ │ - Officer Resolve │ │   Tracking      │  │
│  └─────────────────────────┘ └───────────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **`LadderChallenge` Entity**:
  - `id`: Unique challenge identifier (`chal-...`)
  - `challengerId`: Member ID of the player issuing the callout
  - `opponentId`: Member ID of the challenged rival
  - `format`: `'singles' | 'doubles'`
  - `targetScore`: `11 | 15 | 21`
  - `message`: Optional callout note (up to 120 chars, e.g., court/time preference)
  - `createdAt`: ISO date string (`YYYY-MM-DD`)
  - `status`: `'open' | 'accepted' | 'completed' | 'declined'`
  - `completedMatchId`: Optional link to the official `MatchRecord` once resolved
  - `winnerMemberId`: Optional member ID of the winner once completed
- **Head-to-Head Summary Computation**:
  - Dynamically scans `data.matches` where `playerA` and `playerB` stood on opposite sides (`team1Ids` vs `team2Ids`), aggregating wins, losses, total points scored, average margin, and chronological match history.

### Interactive Component & State Mapping

- **Challenge Creation Flow**: Validates that `challengerId !== opponentId`, prevents duplicate open challenges between the same pair, appends the new `LadderChallenge` to `data.challenges`, and syncs to Firestore.
- **Challenge Response Flow**: Signed-in opponent (or any officer) can transition an `'open'` challenge to `'accepted'` or `'declined'`; challenger or officer can cancel an open challenge.
- **Officer Quick-Settle Flow**: In `LadderStatsView`, officers can click **Record Score** on any `'open'` or `'accepted'` challenge, enter the final score (`11–8`), and submit—which simultaneously creates the `MatchRecord`, updates both players' Elo ratings and win streaks, and transitions the challenge to `'completed'`.
