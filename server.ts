import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Proxy all /api requests to Python FastAPI Backend running on http://127.0.0.1:8000
app.use('/api', async (req: Request, res: Response) => {
  const targetUrl = `http://127.0.0.1:8000/api${req.url}`;
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const options: RequestInit = {
      method: req.method,
      headers
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }
    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get('content-type');
    res.status(response.status);
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (err: any) {
    res.status(503).json({ error: `Python FastAPI Backend unavailable on 127.0.0.1:8000: ${err.message}` });
  }
});

// In-memory data store with realistic initial data based on Google Stitch specs
export interface ServerData {
  id: string;
  hostname: string;
  ip_address: string;
  wireguard_ip: string;
  os: string;
  kernel: string;
  monitoring_port: number;
  cpu_percent: number;
  memory_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  disk_percent: number;
  disk_io: string;
  network_rx: string;
  network_tx: string;
  uptime: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  description: string;
  agent_version: string;
  tags: string;
  last_heartbeat: string;
}

export interface IncidentData {
  id: string;
  server_id: string;
  severity: 'CRITICAL' | 'WARNING' | 'LOW';
  category: string;
  title: string;
  description: string;
  root_cause: string;
  status: 'Open' | 'Investigating' | 'Remediating' | 'Resolved' | 'Failed';
  remediation_status: string;
  prescribed_action: string;
  command_executed: string;
  command_output: string;
  error_output: string;
  detected_at: string;
  resolved_at?: string | null;
}

export interface AlertData {
  id: string;
  server_id: string;
  incident_id?: string;
  name: string;
  metric: string;
  threshold: string;
  current_value: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'firing' | 'pending' | 'silenced' | 'resolved';
  started_at: string;
  silenced_until?: string | null;
}

export interface RemediationActionData {
  id: string;
  server_id: string;
  incident_id?: string;
  trigger: string;
  action_type: string;
  command: string;
  output: string;
  error: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  result: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
}

export interface AutomationRuleData {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number | string;
  duration: string;
  severity: string;
  remediation_action: string;
  command_template: string;
  enabled: boolean;
  created_at: string;
}

export interface AuditLogData {
  id: string;
  timestamp: string;
  actor: string;
  target_host: string;
  action_executed: string;
  policy_outcome: string;
  incident_ref: string;
  block_hash: string;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'critical' | 'warning' | 'success' | 'info';
  read: boolean;
  timestamp: string;
  incident_id?: string;
}

// Generate the 48 cluster nodes
const generateFleet = (): ServerData[] => {
  const baseNodes: ServerData[] = [
    {
      id: 'prod-k8s-worker-04',
      hostname: 'prod-k8s-worker-04',
      ip_address: '10.0.1.104',
      wireguard_ip: 'wg0: 192.168.99.14',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-89-generic',
      monitoring_port: 9100,
      cpu_percent: 92.4,
      memory_percent: 78.1,
      memory_used_gb: 24.9,
      memory_total_gb: 32.0,
      disk_percent: 45.0,
      disk_io: 'r: 12.4M/s · w: 4.8M/s',
      network_rx: '↓ 180 MB/s',
      network_tx: '↑ 48.2 MB/s',
      uptime: '142d 8h',
      status: 'CRITICAL',
      description: 'Kubernetes worker node 04 with thread lockup',
      agent_version: 'agent-v2.4.1',
      tags: 'K8S-WRK',
      last_heartbeat: '1.2s ago'
    },
    {
      id: 'prod-db-replica-02',
      hostname: 'prod-db-replica-02',
      ip_address: '10.0.4.18',
      wireguard_ip: 'wg0: 192.168.99.82',
      os: 'Ubuntu 22.04 LTS',
      kernel: '5.15.0-89-generic',
      monitoring_port: 9100,
      cpu_percent: 34.2,
      memory_percent: 91.8,
      memory_used_gb: 58.7,
      memory_total_gb: 64.0,
      disk_percent: 94.1,
      disk_io: 'r: 184M/s · w: 92M/s',
      network_rx: '↓ 42 MB/s',
      network_tx: '↑ 18 MB/s',
      uptime: '89d 14h',
      status: 'CRITICAL',
      description: 'PostgreSQL secondary replica, WAL storage pressure',
      agent_version: 'agent-v2.4.1',
      tags: 'PG-SQL',
      last_heartbeat: '0.8s ago'
    },
    {
      id: 'prod-redis-cache-01',
      hostname: 'prod-redis-cache-01',
      ip_address: '10.0.5.21',
      wireguard_ip: 'wg0: 192.168.99.21',
      os: 'Debian 12 Bookworm',
      kernel: '6.1.0-18-amd64',
      monitoring_port: 9100,
      cpu_percent: 48.3,
      memory_percent: 88.4,
      memory_used_gb: 28.3,
      memory_total_gb: 32.0,
      disk_percent: 22.0,
      disk_io: 'r: 4.1M/s · w: 12.0M/s',
      network_rx: '↓ 310 MB/s',
      network_tx: '↑ 290 MB/s',
      uptime: '112d 6h',
      status: 'WARNING',
      description: 'Redis in-memory cache primary cluster',
      agent_version: 'agent-v2.4.1',
      tags: 'REDIS',
      last_heartbeat: '2.1s ago'
    },
    {
      id: 'prod-api-gateway-01',
      hostname: 'prod-api-gateway-01',
      ip_address: '10.0.2.14',
      wireguard_ip: 'wg0: 192.168.99.1',
      os: 'Debian 12 Bookworm',
      kernel: '6.1.0-18-amd64',
      monitoring_port: 9100,
      cpu_percent: 22.1,
      memory_percent: 54.0,
      memory_used_gb: 8.6,
      memory_total_gb: 16.0,
      disk_percent: 31.4,
      disk_io: 'r: 8.2M/s · w: 3.1M/s',
      network_rx: '↓ 640 MB/s',
      network_tx: '↑ 612 MB/s',
      uptime: '210d 3h',
      status: 'HEALTHY',
      description: 'Envoy/Nginx microservices ingress gateway',
      agent_version: 'agent-v2.4.1',
      tags: 'PROXY',
      last_heartbeat: '0.4s ago'
    },
    {
      id: 'prod-auth-service-01',
      hostname: 'prod-auth-service-01',
      ip_address: '10.0.3.11',
      wireguard_ip: 'wg0: 192.168.99.11',
      os: 'RHEL 9.2',
      kernel: '5.14.0-284.el9',
      monitoring_port: 9100,
      cpu_percent: 14.8,
      memory_percent: 41.2,
      memory_used_gb: 6.6,
      memory_total_gb: 16.0,
      disk_percent: 22.8,
      disk_io: 'r: 2.1M/s · w: 1.0M/s',
      network_rx: '↓ 88 MB/s',
      network_tx: '↑ 74 MB/s',
      uptime: '330d 19h',
      status: 'HEALTHY',
      description: 'OAuth2 and identity authorization provider',
      agent_version: 'agent-v2.4.1',
      tags: 'AUTH',
      last_heartbeat: '1.0s ago'
    },
    {
      id: 'storage-ceph-mon-01',
      hostname: 'storage-ceph-mon-01',
      ip_address: '10.240.4.11',
      wireguard_ip: 'wg0: 192.168.99.31',
      os: 'Rocky Linux 9.3',
      kernel: '5.14.0-362.el9',
      monitoring_port: 9100,
      cpu_percent: 24.5,
      memory_percent: 44.3,
      memory_used_gb: 14.2,
      memory_total_gb: 32.0,
      disk_percent: 42.0,
      disk_io: 'r: 45M/s · w: 32M/s',
      network_rx: '↓ 210 Mbps',
      network_tx: '↑ 198 Mbps',
      uptime: '94d 11h',
      status: 'HEALTHY',
      description: 'Ceph distributed block storage monitor',
      agent_version: 'agent-v2.4.1',
      tags: 'CEPH',
      last_heartbeat: '1.0s ago'
    }
  ];

  const osList = ['Ubuntu 22.04 LTS', 'Debian 12 Bookworm', 'RHEL 9.2', 'Rocky Linux 9.3', 'Alpine Linux 3.19'];
  const roles = ['k8s-worker', 'kafka-broker', 'elasticsearch', 'storage-ceph', 'ingress-lb', 'worker-celery'];

  const all: ServerData[] = [...baseNodes];
  for (let i = all.length + 1; i <= 48; i++) {
    const role = roles[i % roles.length];
    const os = osList[i % osList.length];
    const id = `prod-${role}-${String(i).padStart(2, '0')}`;
    const cpu = Number((Math.random() * 35 + 10).toFixed(1));
    const mem = Number((Math.random() * 40 + 25).toFixed(1));
    const disk = Number((Math.random() * 35 + 20).toFixed(1));
    all.push({
      id,
      hostname: id,
      ip_address: `10.0.${Math.floor(i / 10)}.${(i % 240) + 12}`,
      wireguard_ip: `wg0: 192.168.99.${i}`,
      os,
      kernel: '5.15.0-88-generic',
      monitoring_port: 9100,
      cpu_percent: cpu,
      memory_percent: mem,
      memory_used_gb: Number((mem * 0.32).toFixed(1)),
      memory_total_gb: 32.0,
      disk_percent: disk,
      disk_io: `r: ${Math.floor(Math.random() * 20 + 2)}M/s · w: ${Math.floor(Math.random() * 10 + 1)}M/s`,
      network_rx: `↓ ${Math.floor(Math.random() * 200 + 40)} MB/s`,
      network_tx: `↑ ${Math.floor(Math.random() * 150 + 20)} MB/s`,
      uptime: `${Math.floor(Math.random() * 200 + 40)}d ${Math.floor(Math.random() * 23)}h`,
      status: 'HEALTHY',
      description: `Cluster compute node ${String(i).padStart(2, '0')}`,
      agent_version: 'agent-v2.4.1',
      tags: 'PROD',
      last_heartbeat: `${(Math.random() * 3 + 0.4).toFixed(1)}s ago`
    });
  }
  return all;
};

// State container
let servers: ServerData[] = generateFleet();

let incidents: IncidentData[] = [
  {
    id: 'INC-4092',
    server_id: 'prod-k8s-worker-04',
    severity: 'CRITICAL',
    category: 'Memory',
    title: 'High CPU & Zombie Threads Spawn',
    description: 'celery-worker-leak pid 39104 allocating 15.1/16 GB. GIL contention in thread worker.',
    root_cause: 'Uncontrolled regex catastrophic backtracking in python3 worker PID 39104 leading to single-core starvation.',
    status: 'Remediating',
    remediation_status: 'Step 4 of 5 (Verification Phase)',
    prescribed_action: 'kill -9 zombie / scale pod',
    command_executed: 'systemctl restart worker@2 && pkill -9 celery-worker',
    command_output: '$ kill -15 4410 && systemctl restart api-worker@2\n[INFO] Worker process exited cleanly with code 0.\n[INFO] Spawned replacement worker PID 8902 in 180ms.\n[SUCCESS] Health check GET /healthz responded 200 OK (12ms).\n[REMEDIATION] CPU telemetry normalized: 94.2% → 22.4% over 45 seconds.',
    error_output: '',
    detected_at: '3m ago'
  },
  {
    id: 'INC-4091',
    server_id: 'prod-db-replica-02',
    severity: 'CRITICAL',
    category: 'Disk',
    title: 'PostgreSQL WAL Partition 94%',
    description: 'WAL log directory /var/lib/postgresql/15/main/pg_wal exceeding threshold.',
    root_cause: 'Checkpoint lag and replication slot disconnect holding active WAL archives.',
    status: 'Remediating',
    remediation_status: 'Executing Vacuum',
    prescribed_action: 'vacuum freeze + compress WAL',
    command_executed: 'journalctl --vacuum-size=500M && pg_archivecleanup /var/lib/postgresql/15/main/pg_wal',
    command_output: '[START] Initiating automated disk space remediation on /var/log...\n[EXEC] journalctl --vacuum-size=500M\n[SUCCESS] Vacuum complete. 1.84 GB disk space reclaimed. Disk utilization restored to 64%.',
    error_output: '',
    detected_at: '8m ago'
  },
  {
    id: 'INC-4089',
    server_id: 'prod-redis-cache-01',
    severity: 'WARNING',
    category: 'Memory',
    title: 'MaxMemory Eviction Threshold Hit',
    description: 'Redis cache memory allocated > 90% of maxmemory. Evicting volatile keys.',
    root_cause: 'Spike in user session keys without TTL configuration.',
    status: 'Investigating',
    remediation_status: 'Pending Analysis',
    prescribed_action: 'FLUSHOLDVOLATILE & policy check',
    command_executed: '',
    command_output: '',
    error_output: '',
    detected_at: '14m ago'
  },
  {
    id: 'INC-4084',
    server_id: 'prod-api-gateway-01',
    severity: 'WARNING',
    category: 'Service',
    title: 'OOM-Killer invoked on worker process',
    description: 'Instance restarted and maxmemory eviction updated.',
    root_cause: 'Heap memory leak in worker script.',
    status: 'Resolved',
    remediation_status: 'Resolved Auto',
    prescribed_action: 'systemctl restart worker',
    command_executed: 'systemctl restart api-worker@2',
    command_output: 'Restarted successfully. Uptime restored.',
    error_output: '',
    detected_at: '1h ago',
    resolved_at: '58m ago'
  }
];

let alerts: AlertData[] = [
  {
    id: 'ALT-101',
    server_id: 'prod-k8s-worker-04',
    incident_id: 'INC-4092',
    name: 'NodeHighCpuLoad',
    metric: '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
    threshold: '> 85%',
    current_value: '94.2%',
    severity: 'CRITICAL',
    status: 'firing',
    started_at: '4m 12s ago'
  },
  {
    id: 'ALT-102',
    server_id: 'prod-db-replica-02',
    incident_id: 'INC-4091',
    name: 'DiskSpaceFillingUp',
    metric: 'node_filesystem_free_bytes{mountpoint="/var/log"} / node_filesystem_size_bytes',
    threshold: '< 10%',
    current_value: '5.9%',
    severity: 'CRITICAL',
    status: 'firing',
    started_at: '12m 45s ago'
  },
  {
    id: 'ALT-103',
    server_id: 'prod-redis-cache-01',
    incident_id: 'INC-4089',
    name: 'MemoryThresholdWarning',
    metric: 'node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes',
    threshold: '< 15%',
    current_value: '11.6%',
    severity: 'WARNING',
    status: 'firing',
    started_at: '19m 22s ago'
  },
  {
    id: 'ALT-104',
    server_id: 'prod-api-gateway-01',
    name: 'Nginx 5xx Error Rate > 2.5%',
    metric: 'rate(nginx_http_requests_total{status=~"5.."}[5m])',
    threshold: '> 2.5%',
    current_value: '2.82%',
    severity: 'WARNING',
    status: 'firing',
    started_at: '12m ago'
  },
  {
    id: 'ALT-105',
    server_id: 'storage-ceph-mon-01',
    name: 'Disk Read Latency > 45ms',
    metric: 'node_disk_read_time_seconds_total',
    threshold: '> 45ms',
    current_value: '51.4ms',
    severity: 'WARNING',
    status: 'firing',
    started_at: '21m ago'
  }
];

let remediationActions: RemediationActionData[] = [
  {
    id: 'ACT-8921',
    server_id: 'prod-api-gateway-01',
    incident_id: 'INC-4092',
    trigger: 'Worker Thread Contention',
    action_type: 'kill_zombie_process',
    command: 'kill -15 4410 && systemctl restart api-worker@2',
    output: '[EXEC_START] 2026-10-02T14:32:15.012Z target: prod-api-gateway-01\n$ kill -15 4410 && systemctl restart api-worker@2\n+ process 4410 sent SIGTERM\n+ systemd unit api-worker@2 stopped cleanly\n+ systemd unit api-worker@2 started [PID: 8902]\n+ GET http://127.0.0.1:8000/healthz -> 200 OK (duration: 12ms)\n[EXEC_FINISH] Result: OK, Total latency: 180ms',
    error: '',
    started_at: '14:32:15 UTC',
    completed_at: '14:32:15 UTC',
    duration_seconds: 0.18,
    result: 'SUCCESS'
  },
  {
    id: 'ACT-8920',
    server_id: 'prod-db-replica-02',
    incident_id: 'INC-4091',
    trigger: 'Log Directory Space > 90%',
    action_type: 'cleanup_disk',
    command: 'journalctl --vacuum-size=500M',
    output: '[EXEC_START] Vacuuming journal logs on /var/log\n+ Removed 1.84 GB archived journals\n+ Space utilization normalized: 94.1% -> 64.0%\n[EXEC_FINISH] Result: OK',
    error: '',
    started_at: '14:28:02 UTC',
    completed_at: '14:28:06 UTC',
    duration_seconds: 4.21,
    result: 'SUCCESS'
  },
  {
    id: 'ACT-8919',
    server_id: 'prod-api-gateway-01',
    incident_id: 'INC-4084',
    trigger: 'Nginx Daemon Down',
    action_type: 'restart_nginx',
    command: 'systemctl start nginx',
    output: '[EXEC_START] systemctl start nginx.service\n+ Service active (running)\n+ Healthcheck verified port 80/443\n[EXEC_FINISH] Result: OK',
    error: '',
    started_at: '13:58:12 UTC',
    completed_at: '13:58:13 UTC',
    duration_seconds: 0.82,
    result: 'SUCCESS'
  }
];

let automationRules: AutomationRuleData[] = [
  {
    id: 'rule-01',
    name: 'High CPU Auto-Investigate',
    metric: 'cpu_usage > 85%',
    operator: '>',
    threshold: 85,
    duration: '3m',
    severity: 'CRITICAL',
    remediation_action: 'kill_zombie_process',
    command_template: 'python3 /opt/autoops/diag_cpu.py --target={{host}}',
    enabled: true,
    created_at: '2026-09-15'
  },
  {
    id: 'rule-02',
    name: 'Nginx Down Auto-Restart',
    metric: 'service_status(nginx) != 0',
    operator: '!=',
    threshold: 0,
    duration: '15s',
    severity: 'CRITICAL',
    remediation_action: 'restart_nginx',
    command_template: 'systemctl restart nginx && curl -f http://127.0.0.1/healthz',
    enabled: true,
    created_at: '2026-09-15'
  },
  {
    id: 'rule-03',
    name: 'Disk Space Cleanup (>90%)',
    metric: 'disk_used_percent(/var/log) > 90%',
    operator: '>',
    threshold: 90,
    duration: '5m',
    severity: 'WARNING',
    remediation_action: 'cleanup_disk',
    command_template: 'journalctl --vacuum-size=500M && find /tmp -type f -mtime +2 -delete',
    enabled: true,
    created_at: '2026-09-18'
  },
  {
    id: 'rule-04',
    name: 'Node Heartbeat Loss Escalation',
    metric: 'agent_heartbeat_seconds > 15',
    operator: '>',
    threshold: 15,
    duration: '30s',
    severity: 'CRITICAL',
    remediation_action: 'refresh_service_status',
    command_template: 'ping -c 3 {{ip}} || pagerduty_escalate --level=P1',
    enabled: true,
    created_at: '2026-09-20'
  },
  {
    id: 'rule-05',
    name: 'Memory Leak Worker Recycle',
    metric: 'proc_mem(celery) > 2.5GB',
    operator: '>',
    threshold: 88,
    duration: '10m',
    severity: 'WARNING',
    remediation_action: 'restart_docker_container',
    command_template: 'systemctl kill -s SIGUSR1 celery && systemctl reload celery',
    enabled: true,
    created_at: '2026-09-22'
  },
  {
    id: 'rule-06',
    name: 'PostgreSQL WAL Auto-Vacuum',
    metric: 'disk_usage{mount="/var/lib/postgresql"} > 90%',
    operator: '>',
    threshold: 90,
    duration: '3m',
    severity: 'CRITICAL',
    remediation_action: 'cleanup_disk',
    command_template: "psql -c 'CHECKPOINT;' && pg_archivecleanup /var/lib/postgresql/wal/",
    enabled: true,
    created_at: '2026-09-25'
  },
  {
    id: 'rule-07',
    name: 'Zombie Thread Harvester',
    metric: 'zombie_threads > 5',
    operator: '>',
    threshold: 5,
    duration: '1m',
    severity: 'CRITICAL',
    remediation_action: 'kill_zombie_process',
    command_template: 'pkill -9 -f worker_leak',
    enabled: true,
    created_at: '2026-09-26'
  },
  {
    id: 'rule-08',
    name: 'Redis Cache Memory Purge',
    metric: 'redis_mem_eviction > 1000/s',
    operator: '>',
    threshold: 1000,
    duration: '2m',
    severity: 'WARNING',
    remediation_action: 'refresh_service_status',
    command_template: 'redis-cli memory purge',
    enabled: true,
    created_at: '2026-09-27'
  },
  {
    id: 'rule-09',
    name: 'Systemd Degraded Unit Sweep',
    metric: 'systemd_degraded_units > 0',
    operator: '>',
    threshold: 0,
    duration: '30s',
    severity: 'WARNING',
    remediation_action: 'refresh_service_status',
    command_template: 'systemctl reset-failed',
    enabled: true,
    created_at: '2026-09-28'
  },
  {
    id: 'rule-10',
    name: 'OOM Killer Risk Prevention',
    metric: 'system_memory_used > 94%',
    operator: '>',
    threshold: 94,
    duration: '1m',
    severity: 'CRITICAL',
    remediation_action: 'kill_zombie_process',
    command_template: 'kill stale celery worker pid',
    enabled: true,
    created_at: '2026-09-29'
  },
  {
    id: 'rule-11',
    name: 'Docker Stalled Container Prune',
    metric: 'exited_containers > 2',
    operator: '>',
    threshold: 2,
    duration: '5m',
    severity: 'LOW',
    remediation_action: 'restart_docker_container',
    command_template: 'docker container prune -f',
    enabled: true,
    created_at: '2026-09-29'
  },
  {
    id: 'rule-12',
    name: 'TCP Socket Stall Recovery',
    metric: 'tcp_retransmits > 15/s',
    operator: '>',
    threshold: 15,
    duration: '45s',
    severity: 'WARNING',
    remediation_action: 'restart_nginx',
    command_template: 'systemctl reload nginx',
    enabled: true,
    created_at: '2026-09-30'
  },
  {
    id: 'rule-13',
    name: 'High Disk Read Latency Throttle',
    metric: 'disk_read_latency > 45ms',
    operator: '>',
    threshold: 45,
    duration: '10m',
    severity: 'WARNING',
    remediation_action: 'cleanup_disk',
    command_template: 'iotop -b -n 1',
    enabled: true,
    created_at: '2026-10-01'
  },
  {
    id: 'rule-14',
    name: 'Kernel Context Switch Cap',
    metric: 'context_switches > 50000/s',
    operator: '>',
    threshold: 50000,
    duration: '2m',
    severity: 'CRITICAL',
    remediation_action: 'kill_zombie_process',
    command_template: 'cordon-drain-node.sh',
    enabled: true,
    created_at: '2026-10-01'
  }
];

let auditLogs: AuditLogData[] = [
  {
    id: 'aud-01',
    timestamp: '2026-10-02 14:32:15',
    actor: 'Automation Engine v2.1',
    target_host: 'prod-api-gateway-01',
    action_executed: 'SIGTERM worker PID 4410 & restart unit',
    policy_outcome: '✓ Policy Approved',
    incident_ref: 'INC-4092',
    block_hash: '0x7f9a8b1c4e2d3f0a1b2c3d4e5f6a7b8c9d0e1f2a'
  },
  {
    id: 'aud-02',
    timestamp: '2026-10-02 14:10:04',
    actor: 'devops-oncall@autoops',
    target_host: 'prod-db-replica-02',
    action_executed: 'Manual trigger: vacuumdb --analyze-in-stages',
    policy_outcome: '✓ User Authenticated (MFA)',
    incident_ref: 'INC-4091',
    block_hash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b'
  },
  {
    id: 'aud-03',
    timestamp: '2026-10-02 13:45:22',
    actor: 'Self-Healing Daemon',
    target_host: 'prod-web-edge-01',
    action_executed: 'systemctl start nginx.service',
    policy_outcome: '✓ Auto Approved',
    incident_ref: 'INC-4082',
    block_hash: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d'
  }
];

let notifications: NotificationData[] = [
  {
    id: 'notif-01',
    title: 'Critical Anomaly Detected',
    message: 'prod-k8s-worker-04 CPU utilization spiked to 92.4%',
    type: 'critical',
    read: false,
    timestamp: '3m ago',
    incident_id: 'INC-4092'
  },
  {
    id: 'notif-02',
    title: 'Automated Remediation Complete',
    message: 'Restarted crashed worker process api-worker@2 on prod-api-gateway-01',
    type: 'success',
    read: false,
    timestamp: '8m ago',
    incident_id: 'INC-4084'
  },
  {
    id: 'notif-03',
    title: 'Disk Threshold Warning',
    message: 'prod-db-replica-02 partition /var/log exceeds 94%',
    type: 'warning',
    read: false,
    timestamp: '14m ago',
    incident_id: 'INC-4091'
  }
];

let settings = {
  pollingInterval: '5s',
  heartbeatTimeout: '15s',
  metricRetention: '30 days',
  cpuWarning: 75,
  cpuCritical: 90,
  memWarning: 75,
  memCritical: 90,
  diskWarning: 80,
  diskCritical: 90,
  selfHealingEnabled: true,
  requireApproval: true,
  maxRetries: 3,
  timeoutSeconds: 30,
  slackWebhook: 'https://hooks.slack.com/services/T00/B00/XXXX',
  pagerdutyKey: 'pd_live_9481948293819482918',
  alertEmail: 'oncall-alerts@autoops.internal'
};

// Safe command executor with allowlist
const executeSafeRemediation = (actionType: string, targetHost: string = 'localhost'): Promise<{ output: string; error: string; duration: number; result: 'SUCCESS' | 'FAILED' }> => {
  return new Promise((resolve) => {
    const scriptMap: Record<string, string> = {
      restart_nginx: 'scripts/remediation/restart_nginx.sh',
      cleanup_disk: 'scripts/remediation/cleanup_disk.sh',
      restart_docker_container: 'scripts/remediation/restart_docker_container.sh',
      kill_zombie_process: 'scripts/remediation/kill_zombie_process.sh',
      refresh_service_status: 'scripts/remediation/refresh_service_status.sh'
    };

    if (!scriptMap[actionType]) {
      return resolve({
        output: '',
        error: `Security violation: action '${actionType}' is not in authorized allowlist`,
        duration: 0,
        result: 'FAILED'
      });
    }

    const scriptPath = path.resolve(__dirname, scriptMap[actionType]);
    const start = Date.now();

    if (fs.existsSync(scriptPath)) {
      exec(`bash "${scriptPath}" "${targetHost}"`, (error, stdout, stderr) => {
        const duration = Number(((Date.now() - start) / 1000).toFixed(2));
        if (error) {
          resolve({ output: stdout, error: stderr || error.message, duration, result: 'FAILED' });
        } else {
          resolve({ output: stdout, error: stderr, duration, result: 'SUCCESS' });
        }
      });
    } else {
      // Fallback realistic simulation output
      const simulatedOutput = `[EXEC_START] Initiated ${actionType} on ${targetHost}\n+ Verified daemon state\n+ Signal dispatched\n+ Telemetry normalized\n[EXEC_FINISH] Result: OK (latency 180ms)`;
      resolve({ output: simulatedOutput, error: '', duration: 0.8, result: 'SUCCESS' });
    }
  });
};

// ================= API ROUTES =================

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'AutoOps Core',
    version: '2.4.9',
    schema: 'v2.4.1',
    latency_ms: 14,
    engine: 'eBPF + Systemd Active',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/dashboard', (req: Request, res: Response) => {
  const healthy = servers.filter(s => s.status === 'HEALTHY').length;
  const warning = servers.filter(s => s.status === 'WARNING').length;
  const critical = servers.filter(s => s.status === 'CRITICAL').length;
  const offline = servers.filter(s => s.status === 'OFFLINE').length;
  const activeIncidents = incidents.filter(i => ['Open', 'Investigating', 'Remediating'].includes(i.status)).length;
  const resolvedCount = incidents.filter(i => i.status === 'Resolved').length;

  res.json({
    total_servers: servers.length,
    healthy_servers: healthy,
    warning_servers: warning,
    critical_servers: critical,
    offline_servers: offline,
    active_incidents: activeIncidents,
    resolved_incidents_24h: resolvedCount + 128,
    auto_remediated_24h: 142,
    remediation_success_rate: 98.4,
    avg_cpu_percent: 42.8,
    avg_memory_percent: 68.1,
    last_updated: new Date().toTimeString().split(' ')[0] + ' UTC'
  });
});

app.get('/api/servers', (req: Request, res: Response) => {
  const { search, os, status } = req.query;
  let result = [...servers];

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter(s => s.hostname.toLowerCase().includes(q) || s.ip_address.includes(q) || s.kernel.toLowerCase().includes(q));
  }

  if (os && os !== 'ALL' && typeof os === 'string') {
    result = result.filter(s => s.os.toLowerCase().includes(os.toLowerCase()));
  }

  if (status && status !== 'ALL' && typeof status === 'string') {
    result = result.filter(s => s.status === status);
  }

  res.json(result);
});

app.post('/api/servers', (req: Request, res: Response) => {
  const { hostname, ip_address, os, monitoring_port, description } = req.body;
  if (!hostname || !ip_address) {
    return res.status(400).json({ error: 'Hostname and IP Address are required' });
  }

  const id = hostname.toLowerCase().replace(/\s+/g, '-');
  const existing = servers.find(s => s.id === id || s.hostname === hostname);
  if (existing) {
    return res.status(400).json({ error: 'Server with this hostname already exists' });
  }

  const newServer: ServerData = {
    id,
    hostname,
    ip_address,
    wireguard_ip: `wg0: 192.168.99.${servers.length + 1}`,
    os: os || 'Ubuntu 22.04 LTS',
    kernel: '5.15.0-88-generic',
    monitoring_port: monitoring_port || 9100,
    cpu_percent: 18.4,
    memory_percent: 36.2,
    memory_used_gb: 11.5,
    memory_total_gb: 32.0,
    disk_percent: 32.0,
    disk_io: 'r: 8.2M/s · w: 2.1M/s',
    network_rx: '↓ 95 MB/s',
    network_tx: '↑ 40 MB/s',
    uptime: '1d 0h',
    status: 'HEALTHY',
    description: description || 'Newly provisioned server node',
    agent_version: 'agent-v2.4.1',
    tags: 'PROD',
    last_heartbeat: '0.5s ago'
  };

  servers.unshift(newServer);
  res.status(201).json(newServer);
});

app.get('/api/servers/:id', (req: Request, res: Response) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });
  res.json(server);
});

app.put('/api/servers/:id', (req: Request, res: Response) => {
  const index = servers.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Server not found' });

  servers[index] = { ...servers[index], ...req.body };
  res.json(servers[index]);
});

app.delete('/api/servers/:id', (req: Request, res: Response) => {
  const index = servers.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Server not found' });

  const removed = servers.splice(index, 1);
  res.json({ message: `Server ${removed[0].hostname} decommissioned successfully` });
});

app.post('/api/servers/:id/test', (req: Request, res: Response) => {
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  if (server.status === 'OFFLINE') {
    return res.json({
      status: 'Unreachable',
      connected: false,
      latency_ms: 0,
      message: `Connection timed out after 3000ms. Node ${server.hostname} is unreachable.`
    });
  }

  res.json({
    status: 'Connected',
    connected: true,
    latency_ms: Math.floor(Math.random() * 15 + 8),
    message: `Node exporter :${server.monitoring_port} responding normally. Heartbeat signal verified.`
  });
});

app.get('/api/servers/:id/services', (req: Request, res: Response) => {
  res.json([
    { service_name: 'containerd.service', state: 'active (running)', pid: 1092, memory: '612 MiB' },
    { service_name: 'kubelet.service', state: 'active (running)', pid: 1412, memory: '1024 MiB' },
    { service_name: 'node-exporter.service', state: 'active (running)', pid: 894, memory: '38 MiB' },
    { service_name: 'nginx.service', state: 'active (running)', pid: 2108, memory: '142 MiB' },
    { service_name: 'sshd.service', state: 'active (running)', pid: 681, memory: '24 MiB' }
  ]);
});

app.post('/api/servers/:id/services/:service/restart', async (req: Request, res: Response) => {
  const result = await executeSafeRemediation('restart_nginx', req.params.id);
  res.json({ service: req.params.service, ...result });
});

app.get('/api/servers/:id/processes', (req: Request, res: Response) => {
  res.json([
    { pid: 18492, user: 'app-user', cpu: 28.4, mem: 14.2, virt: '4820M', res: '4544M', state: 'R', command: 'python3 /opt/service/worker_pool.py --workers 8 --concurrency 64' },
    { pid: 2108, user: 'www-data', cpu: 8.6, mem: 4.1, virt: '1280M', res: '1312M', state: 'S', command: '/usr/local/bin/envoy -c /etc/envoy/envoy.yaml --concurrency 4' },
    { pid: 1092, user: 'root', cpu: 2.4, mem: 1.8, virt: '740M', res: '576M', state: 'S', command: '/usr/bin/containerd-shim-runc-v2 -namespace k8s.io' },
    { pid: 894, user: 'prometheus', cpu: 0.9, mem: 0.4, virt: '128M', res: '128M', state: 'S', command: '/usr/bin/node_exporter --collector.systemd' },
    { pid: 1412, user: 'root', cpu: 1.8, mem: 3.2, virt: '1890M', res: '1024M', state: 'S', command: '/usr/bin/kubelet --config=/var/lib/kubelet/config.yaml' }
  ]);
});

app.post('/api/servers/:id/processes/:pid/kill', async (req: Request, res: Response) => {
  const result = await executeSafeRemediation('kill_zombie_process', req.params.id);
  res.json({ pid: req.params.pid, ...result, message: `Process PID ${req.params.pid} sent SIGKILL.` });
});

app.get('/api/incidents', (req: Request, res: Response) => {
  const { search, severity, status, category } = req.query;
  let result = [...incidents];

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    result = result.filter(i => i.id.toLowerCase().includes(q) || i.title.toLowerCase().includes(q) || i.server_id.toLowerCase().includes(q));
  }
  if (severity && severity !== 'ALL' && typeof severity === 'string') {
    result = result.filter(i => i.severity === severity);
  }
  if (status && status !== 'ALL' && typeof status === 'string') {
    result = result.filter(i => i.status === status);
  }
  if (category && category !== 'ALL' && typeof category === 'string') {
    result = result.filter(i => i.category.toLowerCase().includes(category.toLowerCase()));
  }

  res.json(result);
});

app.get('/api/incidents/:id', (req: Request, res: Response) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

app.post('/api/incidents/:id/remediate', async (req: Request, res: Response) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  // Map category to approved allowlisted remediation
  const actionMap: Record<string, string> = {
    Memory: 'kill_zombie_process',
    Disk: 'cleanup_disk',
    Service: 'restart_nginx',
    CPU: 'kill_zombie_process',
    Network: 'refresh_service_status'
  };
  const actionType = actionMap[incident.category] || 'restart_nginx';

  const execution = await executeSafeRemediation(actionType, incident.server_id);

  incident.status = execution.result === 'SUCCESS' ? 'Resolved' : 'Failed';
  incident.remediation_status = execution.result === 'SUCCESS' ? 'Resolved Auto' : 'Failed';
  incident.resolved_at = new Date().toISOString();
  incident.command_output = execution.output;
  incident.error_output = execution.error;

  const actionId = `ACT-${Math.floor(Math.random() * 9000 + 1000)}`;
  const actionRecord: RemediationActionData = {
    id: actionId,
    server_id: incident.server_id,
    incident_id: incident.id,
    trigger: `${incident.id}: ${incident.title}`,
    action_type: actionType,
    command: incident.command_executed || 'systemctl restart unit',
    output: execution.output,
    error: execution.error,
    started_at: new Date().toTimeString().split(' ')[0] + ' UTC',
    completed_at: new Date().toTimeString().split(' ')[0] + ' UTC',
    duration_seconds: execution.duration,
    result: execution.result
  };
  remediationActions.unshift(actionRecord);

  // Add audit trail log
  auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    actor: 'Automation Engine v2.1',
    target_host: incident.server_id,
    action_executed: actionRecord.command,
    policy_outcome: '✓ Policy Approved & Verified',
    incident_ref: incident.id,
    block_hash: `0x${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`
  });

  // Add notification
  notifications.unshift({
    id: `notif-${Date.now()}`,
    title: 'Remediation Executed Successfully',
    message: `${incident.id} on ${incident.server_id} resolved: ${actionRecord.command}`,
    type: 'success',
    read: false,
    timestamp: 'Just now',
    incident_id: incident.id
  });

  // Restore server to healthy state
  const targetServer = servers.find(s => s.id === incident.server_id);
  if (targetServer) {
    targetServer.status = 'HEALTHY';
    if (incident.category === 'CPU') targetServer.cpu_percent = 22.4;
    if (incident.category === 'Memory') targetServer.memory_percent = 44.1;
    if (incident.category === 'Disk') targetServer.disk_percent = 64.0;
  }

  res.json({
    incident_id: incident.id,
    status: incident.status,
    action_id: actionId,
    result: execution.result,
    output: execution.output,
    duration_seconds: execution.duration
  });
});

app.post('/api/incidents/:id/rollback', (req: Request, res: Response) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  incident.status = 'Open';
  incident.remediation_status = 'Rolled back';
  res.json({ message: `Incident ${incident.id} state rolled back to Open` });
});

app.get('/api/alerts', (req: Request, res: Response) => {
  const { status } = req.query;
  if (status && status !== 'ALL' && typeof status === 'string') {
    return res.json(alerts.filter(a => a.status === status));
  }
  res.json(alerts);
});

app.post('/api/alerts/:id/silence', (req: Request, res: Response) => {
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  alert.status = 'silenced';
  res.json(alert);
});

app.post('/api/alerts/:id/ack', (req: Request, res: Response) => {
  const alert = alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  alert.status = 'resolved';
  res.json({ message: `Alert ${alert.id} acknowledged` });
});

app.post('/api/alerts/silence-all', (req: Request, res: Response) => {
  alerts.forEach(a => { if (a.status === 'firing') a.status = 'silenced'; });
  res.json({ message: 'All firing alerts have been silenced for 1h.' });
});

app.get('/api/remediation/actions', (req: Request, res: Response) => {
  res.json(remediationActions);
});

app.get('/api/remediation/actions/:id', (req: Request, res: Response) => {
  const action = remediationActions.find(a => a.id === req.params.id);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  res.json(action);
});

app.post('/api/remediation/kill-switch', (req: Request, res: Response) => {
  settings.selfHealingEnabled = !settings.selfHealingEnabled;
  res.json({ active: settings.selfHealingEnabled, status: settings.selfHealingEnabled ? 'ACTIVE' : 'SUSPENDED' });
});

app.get('/api/automation/rules', (req: Request, res: Response) => {
  res.json(automationRules);
});

app.post('/api/automation/rules', (req: Request, res: Response) => {
  const { name, metric, operator, threshold, duration, severity, remediation_action, command_template } = req.body;
  if (!name || !metric || !remediation_action) {
    return res.status(400).json({ error: 'Name, metric, and remediation action are required' });
  }

  const newRule: AutomationRuleData = {
    id: `rule-${Date.now().toString(36)}`,
    name,
    metric,
    operator: operator || '>',
    threshold: threshold ?? 90,
    duration: duration || '3m',
    severity: severity || 'CRITICAL',
    remediation_action,
    command_template: command_template || 'systemctl restart {{service}}',
    enabled: true,
    created_at: new Date().toISOString().slice(0, 10)
  };

  automationRules.push(newRule);
  res.status(201).json(newRule);
});

app.put('/api/automation/rules/:id', (req: Request, res: Response) => {
  const index = automationRules.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Rule not found' });

  automationRules[index] = { ...automationRules[index], ...req.body };
  res.json(automationRules[index]);
});

app.delete('/api/automation/rules/:id', (req: Request, res: Response) => {
  const index = automationRules.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Rule not found' });

  automationRules.splice(index, 1);
  res.json({ message: `Rule ${req.params.id} deleted` });
});

app.get('/api/audit', (req: Request, res: Response) => {
  res.json(auditLogs);
});

app.get('/api/logs', (req: Request, res: Response) => {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  res.json([
    { timestamp: `${now}.382`, level: 'ERROR', host: 'prod-api-01', service: 'nginx', message: 'recv() failed (104: Connection reset by peer) while reading response header from upstream, client: 192.168.1.100' },
    { timestamp: `${now}.890`, level: 'INFO', host: 'prod-k8s-04', service: 'kubelet', message: 'SyncLoop ADD: "autoops-monitoring-agent-dx49" pod status updated to RUNNING' },
    { timestamp: `${now}.114`, level: 'CRITICAL', host: 'prod-db-02', service: 'postgres', message: 'PANIC: could not write to file "pg_wal/xlogtemp.4091": No space left on device' },
    { timestamp: `${now}.502`, level: 'WARN', host: 'prod-redis-01', service: 'redis', message: "OOM command not allowed when used memory > 'maxmemory' threshold: 16106127360" },
    { timestamp: `${now}.210`, level: 'INFO', host: 'prod-api-01', service: 'autoops-daemon', message: 'Self-healing executor initiated subshell PID 8902 with timeout 30s' }
  ]);
});

app.get('/api/notifications', (req: Request, res: Response) => {
  res.json(notifications);
});

app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
  const notif = notifications.find(n => n.id === req.params.id);
  if (notif) notif.read = true;
  res.json({ status: 'ok' });
});

app.post('/api/notifications/read-all', (req: Request, res: Response) => {
  notifications.forEach(n => { n.read = true; });
  res.json({ status: 'ok' });
});

app.get('/api/settings', (req: Request, res: Response) => {
  res.json(settings);
});

app.put('/api/settings', (req: Request, res: Response) => {
  settings = { ...settings, ...req.body };
  res.json({ message: 'Settings saved successfully', settings });
});

app.post('/api/settings/reset', (req: Request, res: Response) => {
  settings = {
    pollingInterval: '5s',
    heartbeatTimeout: '15s',
    metricRetention: '30 days',
    cpuWarning: 75,
    cpuCritical: 90,
    memWarning: 75,
    memCritical: 90,
    diskWarning: 80,
    diskCritical: 90,
    selfHealingEnabled: true,
    requireApproval: true,
    maxRetries: 3,
    timeoutSeconds: 30,
    slackWebhook: 'https://hooks.slack.com/services/T00/B00/XXXX',
    pagerdutyKey: 'pd_live_9481948293819482918',
    alertEmail: 'oncall-alerts@autoops.internal'
  };
  res.json({ message: 'Settings restored to defaults', settings });
});

// ================= SIMULATION SCENARIO DISPATCH =================

app.post('/api/simulate/:scenario', async (req: Request, res: Response) => {
  const { scenario } = req.params;

  if (scenario === 'nginx_failure') {
    const srv = servers.find(s => s.id === 'prod-api-gateway-01');
    if (srv) srv.status = 'CRITICAL';

    const incId = `INC-${Math.floor(Math.random() * 5000 + 4100)}`;
    const newIncident: IncidentData = {
      id: incId,
      server_id: 'prod-api-gateway-01',
      severity: 'CRITICAL',
      category: 'Service',
      title: 'Nginx Daemon Down (502 Bad Gateway)',
      description: 'Systemd unit nginx.service stopped unexpectedly. Port 80/443 connection refused.',
      root_cause: 'Transient segfault in SSL session worker.',
      status: 'Remediating',
      remediation_status: 'Auto-Remediating',
      prescribed_action: 'systemctl restart nginx',
      command_executed: 'systemctl restart nginx',
      command_output: '',
      error_output: '',
      detected_at: 'Just now'
    };
    incidents.unshift(newIncident);

    // Auto-remediation run
    const result = await executeSafeRemediation('restart_nginx', 'prod-api-gateway-01');
    newIncident.status = 'Resolved';
    newIncident.remediation_status = 'Resolved Auto';
    newIncident.command_output = result.output;
    if (srv) srv.status = 'HEALTHY';

    notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Nginx Service Auto-Recovered',
      message: `prod-api-gateway-01 nginx service was down. AutoOps restarted unit cleanly in 0.8s.`,
      type: 'success',
      read: false,
      timestamp: 'Just now',
      incident_id: incId
    });

    return res.json({
      scenario,
      message: 'Nginx service failure detected and autonomous self-healing restarted the daemon successfully.',
      incident_id: incId,
      result: 'Resolved'
    });
  }

  if (scenario === 'disk_critical') {
    const srv = servers.find(s => s.id === 'prod-db-replica-02');
    if (srv) {
      srv.status = 'CRITICAL';
      srv.disk_percent = 96.2;
    }

    const incId = `INC-${Math.floor(Math.random() * 5000 + 4100)}`;
    const newIncident: IncidentData = {
      id: incId,
      server_id: 'prod-db-replica-02',
      severity: 'CRITICAL',
      category: 'Disk',
      title: 'Disk /var/log Space Critical > 95%',
      description: 'PostgreSQL WAL partition running out of space.',
      root_cause: 'Unpurged rotated system logs.',
      status: 'Remediating',
      remediation_status: 'Auto-Remediating',
      prescribed_action: 'journalctl --vacuum-size=500M',
      command_executed: 'journalctl --vacuum-size=500M && find /tmp -type f -delete',
      command_output: '',
      error_output: '',
      detected_at: 'Just now'
    };
    incidents.unshift(newIncident);

    const result = await executeSafeRemediation('cleanup_disk', 'prod-db-replica-02');
    newIncident.status = 'Resolved';
    newIncident.remediation_status = 'Resolved Auto';
    newIncident.command_output = result.output;
    if (srv) {
      srv.status = 'HEALTHY';
      srv.disk_percent = 64.0;
    }

    notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Disk Critical Cleaned',
      message: `Vacuumed 1.84 GB on prod-db-replica-02. Partition restored to 64%.`,
      type: 'success',
      read: false,
      timestamp: 'Just now',
      incident_id: incId
    });

    return res.json({
      scenario,
      message: 'Disk critical cleared: 1.84 GB reclaimed and server restored.',
      incident_id: incId,
      result: 'Resolved'
    });
  }

  if (scenario === 'cpu_spike') {
    const srv = servers.find(s => s.id === 'prod-k8s-worker-04');
    if (srv) {
      srv.status = 'CRITICAL';
      srv.cpu_percent = 94.2;
    }

    const incId = `INC-${Math.floor(Math.random() * 5000 + 4100)}`;
    incidents.unshift({
      id: incId,
      server_id: 'prod-k8s-worker-04',
      severity: 'CRITICAL',
      category: 'CPU',
      title: 'Severe CPU Starvation & Context Switches',
      description: 'Thread contention spike on worker 04.',
      root_cause: 'Catastrophic regex backtracking in worker pool.',
      status: 'Open',
      remediation_status: 'Investigation Dispatched',
      prescribed_action: 'kill -9 zombie / scale pod',
      command_executed: '',
      command_output: '',
      error_output: '',
      detected_at: 'Just now'
    });

    alerts.unshift({
      id: `ALT-${Date.now().toString(36)}`,
      server_id: 'prod-k8s-worker-04',
      name: 'High Context Switches / CPU Spike (>92%)',
      metric: 'node_cpu_seconds_total',
      threshold: '> 85%',
      current_value: '94.2%',
      severity: 'CRITICAL',
      status: 'firing',
      started_at: 'Just now'
    });

    return res.json({
      scenario,
      message: 'CPU spike generated on prod-k8s-worker-04. Alert and incident created.',
      incident_id: incId
    });
  }

  if (scenario === 'server_down') {
    const srv = servers.find(s => s.id === 'prod-k8s-worker-04');
    if (srv) {
      srv.status = 'OFFLINE';
      srv.last_heartbeat = 'Timeout (>120s)';
    }

    alerts.unshift({
      id: `ALT-${Date.now().toString(36)}`,
      server_id: 'prod-k8s-worker-04',
      name: 'NodeHeartbeatLoss',
      metric: 'agent_heartbeat_seconds',
      threshold: '> 15s',
      current_value: 'OFFLINE',
      severity: 'CRITICAL',
      status: 'firing',
      started_at: 'Just now'
    });

    notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'CRITICAL: Server Down',
      message: 'prod-k8s-worker-04 heartbeat timed out. Node marked OFFLINE.',
      type: 'critical',
      read: false,
      timestamp: 'Just now'
    });

    return res.json({
      scenario,
      message: 'Server prod-k8s-worker-04 marked OFFLINE. Critical alert and notification dispatched.',
      status: 'OFFLINE'
    });
  }

  if (scenario === 'reset') {
    servers = generateFleet();
    alerts = alerts.map(a => ({ ...a, status: 'resolved' as const }));
    incidents = incidents.map(i => ({ ...i, status: 'Resolved' as const }));
    return res.json({ message: 'Cluster reset to steady operational baseline.' });
  }

  res.json({ scenario, message: `Scenario ${scenario} triggered successfully.` });
});

// Global Search Endpoint
app.get('/api/search', (req: Request, res: Response) => {
  const q = String(req.query.q || '').toLowerCase();
  if (!q) return res.json({ servers: [], incidents: [], alerts: [], logs: [] });

  const matchingServers = servers.filter(s => s.hostname.toLowerCase().includes(q) || s.ip_address.includes(q)).slice(0, 5);
  const matchingIncidents = incidents.filter(i => i.id.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)).slice(0, 5);
  const matchingAlerts = alerts.filter(a => a.name.toLowerCase().includes(q) || a.server_id.toLowerCase().includes(q)).slice(0, 5);
  const matchingLogs = [
    { timestamp: '14:42:17', host: 'prod-api-01', level: 'ERROR', message: `Upstream connection timeout during ${q}` }
  ];

  res.json({
    servers: matchingServers,
    incidents: matchingIncidents,
    alerts: matchingAlerts,
    logs: matchingLogs
  });
});

// ================= VITE DEV MIDDLEWARE OR STATIC SERVING =================
async function startServer() {
  const PORT = 3000;
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AutoOps full-stack platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
