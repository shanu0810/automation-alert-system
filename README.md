# AutoOps

### Autonomous Linux Server Monitoring & Self-Healing Platform

AutoOps combines eBPF kernel telemetry, Prometheus metric scraping, and autonomous systemd remediation to detect Linux server anomalies, restart failing services, vacuum exhausted partitions, and clear resource bottlenecks before outages breach SLAs.

---

## 1. System Architecture

```text
Linux Server (eBPF / Node Exporter)
                ↓
    Prometheus Scrape Engine (:9090)
                ↓
    AutoOps Backend API (:8000 / :3000)
                ↓
    Incident & Anomaly Detection
                ↓
       Automation Engine
                ↓
    Safe Remediation Allowlist
    (/scripts/remediation/*.sh)
                ↓
    Health Verification Probe
                ↓
       SQLite Database
                ↓
  AutoOps Tactical Dashboard
```

---

## 2. Key Capabilities & Implemented Workflows

1. **Overview Dashboard**:
   - 8 Enterprise KPI counters (Total Servers, Healthy, Warning, Critical, Active Incidents, Auto-Remediated, Avg CPU, Avg Memory).
   - Cluster topology segmented bar (48 nodes).
   - Cluster telemetry multi-curve stream (CPU Load %, RAM Commit GiB, Disk I/O MB/s) with 1h, 6h, 24h, 7d filters.
   - Live Self-Healing Pipeline stream.
   - Active Incidents Table with instant inspection.
   - Fleet Telemetry Matrix.

2. **Servers Fleet Management**:
   - Real-time search, OS filter (Ubuntu, Debian, RHEL, Rocky, Alpine), Status filter (Healthy, Warning, Critical, Offline).
   - Functional CSV Export (`autoops_fleet_export.csv`).
   - Provision Node modal with input validation and enrollment token generation.
   - Deep-Dive Inspector Panel for selected node with:
     - Live connection testing (ping with latency and error handling).
     - Systemd unit table with restart buttons.
     - Metrics & load averages (1m, 5m, 15m).
     - Live top/htop processes with functional `SIGKILL (KILL -9)`.
     - Node logs and direct SSH connection strings.

3. **Incidents & Autonomous Remediation**:
   - KPI counters: Open, Investigating, Remediating, Resolved, MTTR.
   - Filter bar: Severity, Category, Target Server, Status.
   - Interactive Slide-over Investigation Drawer:
     - Resource exhaustion progress bar and offending entity PID.
     - Autonomous Execution Stepper (Anomaly -> Policy -> Authorization -> Execution -> Verification).
     - Monospace Terminal execution log with copy-to-clipboard.
     - Functional **Remediate Now** button with confirmation dialog.
     - Rollback and Post-Mortem Markdown export (`PostMortem_<ID>.md`).

4. **Active Alerts & Firing Rules**:
   - Status tabs: Firing, Pending, Silenced, Resolved.
   - Alert cards with "AUTO-HEALING ACTIVE" animation.
   - Mute / Silence All window modal with duration options.
   - PromQL rule preview with dry-run simulation engine.

5. **Autonomous Remediation Command Center**:
   - Master Kill Switch (ACTIVE / SUSPENDED) that updates backend state.
   - Success rate metrics (98.4%) and resolution duration.
   - Remediation action history with stdout diff modal.

6. **Telemetry Log Aggregator**:
   - Lucene / Regex filter search.
   - Pause / Resume Live Tail toggle.
   - Structured JSON stack trace drawer.

7. **Prometheus Explorer**:
   - PromQL query console with syntax verification.
   - 4 Grafana-style dark telemetry charts with threshold indicators.

8. **Automation Rules Engine**:
   - Create, edit, toggle enable/disable, and delete rules with confirmation.
   - Rule builder modal with allowlisted remediation scripts.

9. **Cryptographic Audit Trail**:
   - SHA-256 block ledger recording every automated and manual action.

10. **Simulation Lab**:
    - Direct UI controls to inject real scenarios:
      - `⚡ CPU Spike`: Triggers thread lockup, raises Critical Alert.
      - `⚡ Memory Spike`: Triggers memory leak, recycles worker container.
      - `⚡ Disk Critical`: Drives partition >95%, executes journalctl vacuum, recovers space.
      - `⚡ Nginx Failure`: Stops service, detects failure, triggers `systemctl restart nginx`, marks resolved.
      - `⚡ Server Down`: Simulates heartbeat timeout, marks node OFFLINE.
      - `⚡ Network Spike`: Simulates TCP SYN flood.
      - `↺ Reset Steady State`: Restores all 48 nodes to healthy baseline.

---

## 3. Security Allowlist Architecture

To prevent arbitrary command execution, AutoOps enforces a strict security allowlist:
- `restart_nginx` → `scripts/remediation/restart_nginx.sh`
- `cleanup_disk` → `scripts/remediation/cleanup_disk.sh`
- `restart_docker_container` → `scripts/remediation/restart_docker_container.sh`
- `kill_zombie_process` → `scripts/remediation/kill_zombie_process.sh`
- `refresh_service_status` → `scripts/remediation/refresh_service_status.sh`

Any unapproved command payload sent to `/api/incidents/:id/remediate` is rejected before execution.

---

## 4. How to Run

### Option A: Local Development (Full-Stack Dev Server)

```bash
# 1. Install dependencies
npm install

# 2. Start Full-Stack Server (Express API + Vite Dev Server on Port 3000)
npm run dev

# 3. Access Dashboard
http://localhost:3000
```

### Option B: Python FastAPI Standalone Backend

```bash
# 1. Install Python requirements
pip install -r backend/requirements.txt

# 2. Run FastAPI Backend
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Access Swagger Docs
http://localhost:8000/docs
```

### Option C: Docker Compose (Full Production Stack)

```bash
docker compose up --build
```

**Services:**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger Documentation: `http://localhost:8000/docs`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- Node Exporter: `http://localhost:9100`

---

## 5. Automated Tests

```bash
# Run Backend Test Suite
python3 -m unittest backend/test_main.py

# Run TypeScript Lint & Typecheck
npm run lint
```
