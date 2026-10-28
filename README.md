# Satellite Communication – Producer Consumer Synchronization Simulator

An educational, browser-based simulator for the classical Operating Systems
**bounded-buffer Producer–Consumer problem**, using a satellite communication
scenario. Built for a college OS practical/demo.

---

## UI Redesign (SAT-SYNC)

The frontend is now a mission-control dashboard: sidebar navigation, KPI cards, a Satellite → Shared Buffer → Ground Station
diagram with animated packets and telemetry-style buffer slots, banner states (BUFFER FULL / EMPTY / UNSAFE SHARED ACCESS /
SYNCHRONIZED / COMMUNICATION CLOSED), live mutex + semaphore panel, communication-window ring, event timeline, occupancy chart,
visual Race Condition lanes, concept cards with satellite examples, an 8-step procedure, comparison badges, a results report
(with Print) and a Viva accordion. Responsive down to tablet (sidebar collapses behind a menu button).

Files: `index.html` (structure), `style.css` (theme), `script.js` (simulation logic, unchanged except one bug fix),
`ui.js` (dashboard layer: reads simulator state, never alters it), `producer_consumer.c` (untouched).
Bug fix: preset scenarios used speed/window values missing from the dropdowns, producing NaN timers; they are now added automatically.
Icons are emoji, so the project runs fully offline (Google Fonts is optional; a fallback font is used without internet).

---

## 1. Project Overview

The simulator lets a student run, step through, and observe the Producer–Consumer
problem with real (non-random, non-faked) simulation state: a bounded buffer that
genuinely fills and empties, a shared `count` variable that genuinely races when
unsynchronized, and live mutex/semaphore values when synchronized.

## 2. Real-World Mapping

| OS Concept            | Satellite Scenario                         |
|------------------------|---------------------------------------------|
| Producer               | 🛰 Satellite                                 |
| Consumer                | 📡 Ground Station                            |
| Shared bounded buffer  | Satellite's onboard data buffer              |
| Buffer item             | Sensor / data packet                         |
| Buffer full             | Satellite must wait                          |
| Buffer empty            | Ground station must wait                     |
| Race condition          | Both access the buffer/count simultaneously  |
| Mutex / semaphore       | Synchronization mechanism                    |
| Communication window    | Limited time satellite can talk to ground    |
| Packet waiting time     | Time a packet may sit in buffer before expiry|

## 3. Features

- Unsynchronized mode (demonstrates race conditions) and Synchronized mode (mutex + empty/full semaphores)
- Step-by-step mode with Next Step / Previous Step / Reset
- Realistic packet types, IDs, timestamps and waiting times
- Bounded buffer with configurable capacity (3 / 5 / 7 / 10)
- Buffer Full / Buffer Empty condition handling and messaging
- Dedicated Race Condition tab with a T0–T5 timeline demonstration and critical-section diagram
- Synchronization tab showing live mutex / empty / full values with explanations
- Limited Communication Window with countdown + progress bar
- Packet expiration based on a configurable maximum waiting time
- Live Event Log (clear / pause / auto-scroll)
- Live Statistics panel (produced, consumed, buffer full/empty events, race conditions, average/maximum waiting time, communication window used)
- 9 preset interactive scenarios
- Procedure tab (20-step experiment guide + "What to Observe")
- Concepts tab (12 student-friendly OS definitions)
- Comparison tab (Unsynchronized vs Synchronized table)
- Results tab with a generated summary and conclusion
- Companion C implementation (`producer_consumer.c`) with both unsynchronized and synchronized (pthread + semaphore) builds of the same scenario

## 4. Folder Structure

```
satellite-sync-simulator/
├── index.html              # Main app shell + all tab markup
├── style.css                # Dark navy academic theme
├── script.js
├── ui.js                 # All simulation logic and tab behaviour
├── producer_consumer.c       # C version (unsynchronized + synchronized)
└── README.md                 # This file
```

## 5. Installation Instructions

No installation or build step is required for the web simulator — it is plain
HTML/CSS/JavaScript with no dependencies or backend.

For the C program you need `gcc` and POSIX threads (`pthread`), available by
default on Linux and macOS; on Windows use WSL or MinGW with pthreads.

## 6. How to Run

### Web Simulator
1. Unzip the project.
2. Double-click `index.html`, or serve the folder with any static server, e.g.:
   ```
   npx serve satellite-sync-simulator
   ```
3. Open the shown local address in your browser.

### C Version
```bash
# Unsynchronized build (shows the race condition)
gcc -DUNSYNC -o psc_unsync producer_consumer.c -lpthread
./psc_unsync

# Synchronized build (mutex + semaphores)
gcc -o psc_sync producer_consumer.c -lpthread
./psc_sync
```

## 7. How to Use the Simulator

Use the top navigation tabs: **Simulator, Race Condition, Synchronization,
Procedure, Concepts, Comparison, Results.** In the Simulator tab, choose a mode
(Unsynchronized/Synchronized), set buffer capacity and speeds, then use
Start/Pause/Step/Stop/Reset, or pick a preset Scenario and click **Run Scenario**.

## 8. How to Demonstrate Buffer Full

Set a small buffer capacity (e.g. 3) with a fast production speed and slow
consumption speed, or run **Scenario 4: Buffer Full Demonstration**. Watch the
buffer badge turn 🔴 BUFFER FULL and the Satellite's status pill switch to
WAITING.

## 9. How to Demonstrate Buffer Empty

Use a slow production speed and fast consumption speed, or run **Scenario 5:
Buffer Empty Demonstration**. Watch the badge turn 🔵 BUFFER EMPTY and the
Ground Station's status pill switch to WAITING.

## 10. How to Demonstrate Race Condition

Stay in Unsynchronized mode and either let the live simulation trigger a race
automatically (shown inline with a timeline), or go to the **Race Condition**
tab and click **Demonstrate Race Condition** for a controlled T0–T5 walk-through
showing the lost-update problem.

## 11. How to Demonstrate Synchronization

Switch to **SYNCHRONIZED** mode and open the **Synchronization** tab. Watch
`empty`, `full` and `mutex` update live as packets are produced/consumed; the
race-condition warning will no longer appear.

## 12. How to Use the Communication Window

Set a window duration (10/20/30/60s) before starting. Watch the countdown and
progress bar; when it reaches 0, the badge turns 🔴 CLOSED and the Ground
Station stops receiving packets even if the buffer still holds data.

## 13. How to Run Step-by-Step Mode

Instead of Start, use **Next Step** to perform exactly one produce/consume
operation at a time, and **Previous Step** to revert the last one. This is the
recommended mode for a teacher demonstration.

## 14. Expected Results

- Buffer count never exceeds capacity or goes below 0.
- Unsynchronized mode occasionally shows an inconsistent `count` vs real buffer size.
- Synchronized mode keeps `count`/semaphores always consistent with the buffer.
- Statistics and the event log update in real time and match the visible state.

## 15. Explanation of Each UI Component

| Component | Purpose |
|---|---|
| Mode toggle | Switch between Unsynchronized / Synchronized logic |
| Satellite / Ground Station panels | Show current producer/consumer action and status |
| Buffer slots | Visual bounded buffer; filled/empty/expired states |
| Communication Window | Countdown limiting when consumption can occur |
| Synchronization panel | Live mutex/empty/full values |
| Statistics panel | Aggregated counters and timing metrics |
| Event Log | Chronological record of every simulation event |

## 16. OS Concepts Demonstrated

Producer–Consumer problem, bounded buffer, shared resource, race condition,
critical section, mutual exclusion, semaphore, mutex, buffer full/empty
handling, and timing/communication-window constraints.

## 17. Troubleshooting

- **Nothing moves after Start:** check that the buffer isn't already full/empty blocking both sides — use Step to inspect state.
- **C program won't compile:** ensure `-lpthread` is included and a POSIX environment (Linux/macOS/WSL) is used.
- **Race condition never appears:** it is probabilistic in live-run mode; use the dedicated Race Condition tab demo for a guaranteed, controlled demonstration.

## 18. Viva Questions and Answers

1. **What is the Producer–Consumer problem?** Two processes share a bounded buffer: one produces data into it, the other consumes data from it, and both must be coordinated so the buffer is never over- or under-accessed.
2. **Who is the producer in this simulator?** The satellite, which generates sensor/data packets.
3. **Who is the consumer?** The ground station, which receives and processes packets.
4. **What is the buffer?** The satellite's onboard bounded storage that temporarily holds packets before they are transmitted.
5. **Why is the buffer bounded?** Because real memory/storage is limited; an unbounded buffer isn't realistic and hides synchronization problems.
6. **What happens when the buffer is full?** The producer (satellite) must stop and wait until a slot is freed.
7. **What happens when the buffer is empty?** The consumer (ground station) must stop and wait until a new packet arrives.
8. **What is a race condition?** An error where the final result depends on the unpredictable timing/order of two or more processes accessing shared data concurrently.
9. **Where does the race condition occur in this simulator?** On the shared `count` variable when both satellite and ground station read and write it without synchronization.
10. **What is a critical section?** The portion of code where a process accesses shared data; only one process should execute it at a time.
11. **What is a mutex?** A binary lock that enforces mutual exclusion over a critical section.
12. **What is a semaphore?** An integer counter with wait()/signal() operations used for signaling and resource counting between processes.
13. **What is the purpose of the empty semaphore?** It counts available (unused) buffer slots and makes the producer wait when it reaches zero.
14. **What is the purpose of the full semaphore?** It counts packets currently available and makes the consumer wait when it reaches zero.
15. **Why is synchronization required?** To prevent race conditions and keep the shared buffer state consistent when multiple processes access it concurrently.
16. **Why is sleep() not synchronization?** A delay only changes timing to make interleaving visible; it gives no guarantee that only one process touches shared data at a time, so a race condition can still happen.
17. **What is the communication window?** A limited period during which the satellite and ground station can exchange data; outside it, no transmission is possible even if the buffer has data.
18. **Why is packet waiting time included?** To illustrate that delayed data can become stale/less useful — a simulation parameter, not a real protocol rule.
19. **What happens if communication closes?** The ground station stops consuming; packets stay in the buffer, which can then fill up and block the satellite too.
20. **How does synchronization solve the problem?** By having the producer and consumer wait() on semaphores before accessing the buffer and lock()/unlock() a mutex around the actual read/write, guaranteeing mutual exclusion and no lost updates.

---

*Educational project — simulation state is real and computed locally; nothing is faked for display purposes.*
