# Interactive & Aesthetic Upgrade Plan

## 1. Visual Aesthetic Direction: Broadcast Varsity Arena
We will elevate the platform's visual aesthetic into a crisp **Broadcast Varsity Arena** look while preserving clean editorial hierarchy and zero-clutter discipline:
- **Court-Inspired Architectural Surfaces**: Subtle pickleball court line geometry (non-volley "kitchen" zone proportions, crisp baseline dividers, and subtle grid hairlines) integrated into scoreboard headers, hero banners, and court cards.
- **Broadcast Scoreboard Typography & Tabular Precision**: High-contrast `Barlow Condensed` broadcast headers paired with `JetBrains Mono` (`tabular-nums`) for live scores, Elo deltas, win-probability meters, and countdowns.
- **Tactile Micro-Interactions**: Responsive button press states, smooth bar transitions, and interactive hover/touch feedback across desktop and mobile viewports without visual bloat.

---

## 2. Interactive Features & Aesthetic Upgrades

### A. Interactive Court Diagrams & Live Win-Probability Bar (`LiveScoreKeeper.tsx` & `ClubLadderView.tsx`)
- **Interactive Top-Down Pickleball Court Visualizer**:
  - Visualizes an authentic top-down pickleball court (left/right service boxes, non-volley kitchen zones, and net line) with live player positioning indicators showing who is serving and receiving based on the current score (even = right/deuce court, odd = left/ad court).
  - Clicking or tapping a side of the court directly awards the rally point or toggles server rotation, with visual rally pulse feedback on the court canvas.
- **Real-Time Live Win-Probability Bar**:
  - Dynamically calculates each side's live win probability combining pre-match Elo rating differential and real-time score leverage (e.g., 9–9 deuce pressure vs. 10–4 game point).
  - Displays a smooth split-color broadcast probability meter above the active scoreboard that shifts after every point scored.

### B. Live Spectator Ticker & Court Scoreboard Sound Effects (`LiveScoreKeeper.tsx` & `App.tsx`)
- **Broadcast Spectator Ticker**:
  - A sleek broadcast ticker bar at the top of the Live Scoreboard & Overview showing real-time active court scores, match-point alerts, active win streaks, and recent upsets across the club.
- **Synthesized Web Audio Scoreboard Sound Effects (Toggleable)**:
  - Built-in, zero-latency Web Audio API sound effects (crisp pickleball paddle pop on point scored, referee whistle on game point / match win, and horn chime on Elo tier promotion) with a one-tap **Mute / Sound On** toggle in the scoreboard header.

### C. Animated Elo Rank-Up Celebrations & Streak Milestones (`ClubLadderView.tsx`, `LiveScoreKeeper.tsx`, & `MemberPortalView.tsx`)
- **Post-Match Elo Delta & Rank-Up Overlay**:
  - When a Ranked match finishes, displays an animated broadcast summary card with a counting Elo ticker (`+18 ELO`), tier progression bar (e.g., `Silver II → Gold I`), and a celebratory banner when a player crosses an Elo threshold (1100, 1200, 1350, 1500) or hits a 3+, 5+, or 10+ win streak.

### D. Interactive 3D-Tilt Varsity Player Cards (`MemberPortalView.tsx` & `ClubLadderView.tsx`)
- **Interactive 3D Perspective Tilt & Holographic Foil Sheen**:
  - Upgraded Varsity Trading Card in the Member Portal (and clickable player modal on the Ladder) that responds to cursor movement on desktop and touch/gyro tilt on mobile with smooth 3D perspective rotation and a subtle varsity metallic sheen that shifts with the angle.
  - **Interactive Flip / Showcase Mode**: Tap or click the card to flip between the **Front (Varsity Rating, Tier Emblem, Top 3 Pinned Badges, Signature Playstyle)** and the **Back (Full Season Telemetry, Head-to-Head Nemesis, Recent 5-Match Form Strip, and Interactive Elo Sparkline)**.

### E. Weekly MVP Voting, Club Polls & Live Activity Feed with Reactions (`OverviewDashboard.tsx` & `MemberPortalView.tsx`)
- **Weekly MVP Voting & Interactive Club Polls**:
  - Members can vote for the **Player of the Week (Weekly MVP)** from top performers and participate in officer-created **Club Polls** (e.g., *"Next Friday Tournament Format"*, *"Practice Drill Focus"*), with live animated percentage bars synced via Firestore.
  - Officers can create new polls or reset Weekly MVP nominations directly from the dashboard.
- **Live Club Activity Feed with Player Reactions**:
  - An interactive feed of recent matches, streak milestones, challenges issued, and badge unlocks where members can tap quick athletic reactions (`🔥 Fire`, `👏 Clutch`, `⚡ Upset`, `👑 Goat`) that persist across sessions.
