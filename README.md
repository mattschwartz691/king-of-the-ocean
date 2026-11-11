# Game Night

Two phone-friendly web games on one site. Open it and pick one:

**Play:** https://mattschwartz691.github.io/king-of-the-ocean/

## Ocean Game — King of the Ocean (`/ocean`)
A sawfish party brawler for 1–4 players. Drag to swim, tap to Saw Dash, knock the crown loose and hold it for 45 seconds.
Solo ladder against bots, or 2–4 players on the same Wi-Fi (one phone hosts, friends scan the QR code).

## Sluggy's Business (`/sluggy`)
Sluggy is a banana slug who is really into business (he pronounces it "bidness"). A quick blind-bidding strategy game, about 3–4 minutes:

- Every day three shops go up for auction on the garden board. Secretly split your cash between them; the highest bid wins the shop and pays.
- Shops pay you every day, +$1 for each neighbor you own, +$2 crown bonus for each shop type you lead, +$2 for the day's hot trend.
- Worms are very, very bad: unsold lots become worm holes, and on raid days the lower Early Bird bid gets their best shop shut down.
- Richest slug after 8 days wins; the final payday counts double.
- **Solo:** take down the five bosses of WormCo. **1v1:** slug vs slug on two phones (host shows a code/QR).

## Tech
Zero-build static site: vanilla JS modules + Canvas 2D; all art and audio are generated in code.
Multiplayer is peer-to-peer WebRTC via [PeerJS](https://peerjs.com) (its public broker is used only for the handshake).

Run locally: `python3 -m http.server` and open `http://localhost:8000`.
