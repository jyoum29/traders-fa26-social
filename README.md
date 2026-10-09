# Traders Olympics

A live, local-network game and leaderboard platform for the Traders at MIT social.

## Run it

1. Install [Node.js 18 or newer](https://nodejs.org/).
2. Open a terminal in this folder and run:

   ```powershell
   npm install
   npm start
   ```

3. Open `http://localhost:3000` on the host computer.
4. Other computers on the same Wi-Fi can use the `LAN:` address printed in the terminal.

Keep the server terminal open during the event. Team setup and scores are saved to
`data/state.json`, so restarting the server does not erase the standings.

## Event flow

- Switch to **Developer**, open **Setup**, and add the teams.
- Players choose their team before the round begins.
- On each game tab, use the Developer-only start control. This starts the official
  timer for every team at the same moment.
- ZetaMac scores sync to every open leaderboard after each correct answer.
- Each ZetaMac runner receives 60 seconds followed by a five-second handoff.
- Two Sum awards 100 points the first time a team passes all four test cases.
- The Two Sum leaderboard shows each team's time, written lines, and submissions.
- The leaderboard's **Overall** tab totals both games; each game also has a live,
  visual team breakdown.

The Python runtime is served by the event computer, so gameplay does not depend on
internet access. Two Sum code drafts stay in that computer's browser.

## Notes

There are intentionally no accounts or permissions. The Player/Developer switch is
an interface convenience, not access control, as requested for this in-person event.
