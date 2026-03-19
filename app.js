const fileInput = document.getElementById("fileInput");
const loadSample = document.getElementById("loadSample");
const downloadJson = document.getElementById("downloadJson");
const board = document.getElementById("board");
const graphView = document.getElementById("graphView");
const errorBox = document.getElementById("error");
const tabs = document.getElementById("tabs");
const viewKanbanBtn = document.getElementById("viewKanban");
const viewGraphBtn = document.getElementById("viewGraph");

const goalEl = document.getElementById("goal");
const rootEl = document.getElementById("root");
const updatedEl = document.getElementById("updated");
const statsEl = document.getElementById("stats");

const statusOrder = ["todo", "doing", "in-progress", "blocked", "done"];
let loadedGraphs = [];
let activeIndex = -1;
let currentView = "kanban";
let lastKnownChange = 0;
let currentUsername = null;
const autoLoadUrl = "api/graphs";

const sampleData = {
  mikado_graph: {
    version: "1.0",
    goal: "Use Firebase as persistence to replace PostgreSQL",
    created_at: "2026-02-07T10:19:39.3312612+01:00",
    updated_at: "2026-02-07T10:19:39.3312612+01:00",
    nodes: {
      "migration-firebase": {
        id: "migration-firebase",
        description: "Use Firebase as persistence to replace PostgreSQL",
        status: "todo",
        depends_on: [
          "decider-produit-firebase",
          "modeler-donnees-et-migrations",
          "implementer-repositories-firebase",
          "config-env-secrets",
          "mettre-a-jour-tests",
          "mettre-a-jour-docs-et-compose"
        ],
        notes: "",
        created_at: "2026-02-07T10:19:39.3312612+01:00",
        updated_at: "2026-02-07T10:19:39.3312612+01:00"
      },
      "decider-produit-firebase": {
        id: "decider-produit-firebase",
        description: "Choose Firebase product and auth strategy",
        status: "todo",
        depends_on: [],
        notes: "",
        created_at: "2026-02-07T10:19:39.3312612+01:00",
        updated_at: "2026-02-07T10:19:39.3312612+01:00"
      }
    },
    root: "migration-firebase"
  }
};

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = "";
  errorBox.hidden = true;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function normalizeGraph(data) {
  if (!data) return null;
  if (data.mikado_graph) return data.mikado_graph;
  return data;
}

function normalizeGraphSafe(data, fileName) {
  const graph = normalizeGraph(data);
  if (!graph || !graph.nodes) {
    return { ok: false, error: `Missing mikado_graph.nodes in ${fileName}` };
  }
  return { ok: true, graph };
}

function setDownloadState(entry) {
  if (!downloadJson) return;
  if (!entry) {
    downloadJson.hidden = true;
    return;
  }

  downloadJson.hidden = false;
  downloadJson.textContent = entry.source === "server" ? "Download JSON" : "Download updated JSON";
}

function downloadGraph(entry) {
  if (!entry || !entry.graph) return;
  const payload = JSON.stringify({ mikado_graph: entry.graph }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${entry.name}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function persistStatusChange(entry, nodeId, status) {
  if (!entry || entry.source !== "server") return true;

  try {
    const response = await fetch(
      `/api/graphs/${encodeURIComponent(entry.name)}/nodes/${encodeURIComponent(nodeId)}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      }
    );

    if (!response.ok) {
      showError(`Failed to update ${nodeId} (${response.status})`);
      return false;
    }

    const payload = await response.json();
    if (payload && payload.graph) {
      entry.graph = payload.graph;
    }
    return true;
  } catch (error) {
    showError(`Failed to update ${nodeId}: ${error.message || "network error"}`);
    return false;
  }
}

function getActiveEntry() {
  if (activeIndex < 0) return null;
  return loadedGraphs[activeIndex] || null;
}

function isNodeBlocked(node, nodeMap) {
  return node.depends_on.some((dep) => nodeMap.get(dep)?.status !== "done");
}

async function updateNodeStatus(nodeId, status) {
  const entry = getActiveEntry();
  if (!entry || !entry.graph || !entry.graph.nodes) return;

  const node = entry.graph.nodes[nodeId];
  if (!node || node.status === status) return;

  const didPersist = await persistStatusChange(entry, nodeId, status);
  if (!didPersist) return;

  const now = new Date().toISOString();
  node.status = status;
  node.updated_at = now;
  entry.graph.updated_at = now;
  renderCurrentView(entry.graph);
}

function buildColumns(nodes) {
  const statusSet = new Set(nodes.map((node) => node.status || "todo"));
  const ordered = statusOrder.filter((status) => statusSet.has(status));
  const extras = [...statusSet].filter((status) => !statusOrder.includes(status));
  extras.sort();
  return [...ordered, ...extras];
}

function updateSummary(graph, stats) {
  goalEl.textContent = graph.goal || "-";
  rootEl.textContent = graph.root || "-";
  updatedEl.textContent = formatDate(graph.updated_at || graph.created_at);
  const phaseLabel = graph.phase === "development" ? "DEV" : "DESIGN";
  statsEl.textContent = `${phaseLabel} | ${stats.totals} nodes, ${stats.done} done, ${stats.blocked} blocked, ${stats.ready} ready`;
}

function resetSummary() {
  goalEl.textContent = "-";
  rootEl.textContent = "-";
  updatedEl.textContent = "-";
  statsEl.textContent = "-";
}

function renderTabs() {
  tabs.innerHTML = "";
  if (loadedGraphs.length <= 1) {
    tabs.hidden = true;
    return;
  }

  loadedGraphs.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === activeIndex ? "tab active" : "tab";
    button.textContent = entry.name;
    button.addEventListener("click", () => selectGraph(index));
    tabs.appendChild(button);
  });

  tabs.hidden = false;
}

function renderCurrentView(graph) {
  const entry = getActiveEntry();
  if (currentView === "graph") {
    board.innerHTML = "";
    renderGraphD3(graph);
  } else {
    graphView.innerHTML = "";
    renderBoard(graph, entry);
  }
}

function selectGraph(index) {
  if (!loadedGraphs[index]) return;
  activeIndex = index;
  renderTabs();
  setDownloadState(loadedGraphs[index]);
  renderCurrentView(loadedGraphs[index].graph);
}

function renderBoard(graph, entry) {
  if (!graph || !graph.nodes) {
    showError("Invalid JSON: missing mikado_graph.nodes");
    return;
  }

  const nodeEntries = Object.values(graph.nodes);
  const nodes = nodeEntries.map((node) => ({
    ...node,
    status: node.status || "todo",
    depends_on: Array.isArray(node.depends_on) ? node.depends_on : []
  }));

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const columns = buildColumns(nodes);

  const totals = nodes.length;
  const doneCount = nodes.filter((node) => node.status === "done").length;
  const blockedCount = nodes.filter((node) => {
    return isNodeBlocked(node, nodeMap);
  }).length;
  const readyCount = nodes.filter((node) => {
    if (node.status === "done") return false;
    return !isNodeBlocked(node, nodeMap);
  }).length;

  updateSummary(graph, {
    totals,
    done: doneCount,
    blocked: blockedCount,
    ready: readyCount
  });

  board.innerHTML = "";

  columns.forEach((status) => {
    const column = document.createElement("div");
    column.className = "column";

    const header = document.createElement("div");
    header.className = "column-header";

    const title = document.createElement("div");
    title.className = "column-title";
    title.textContent = status.replace(/-/g, " ");

    const count = document.createElement("div");
    count.className = "column-count";

    const items = nodes.filter((node) => node.status === status);
    count.textContent = `${items.length} items`;

    header.append(title, count);
    column.appendChild(header);

    items.forEach((node, index) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.animationDelay = `${index * 0.05}s`;

      const cardTitle = document.createElement("div");
      cardTitle.className = "card-title";
      cardTitle.textContent = node.id;

      const cardDesc = document.createElement("div");
      cardDesc.className = "card-desc";
      cardDesc.textContent = node.description || "";

      const tagList = document.createElement("div");
      tagList.className = "tag-list";

      if (node.depends_on.length === 0) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = "no deps";
        tagList.appendChild(tag);
      } else {
        node.depends_on.forEach((dep) => {
          const depNode = nodeMap.get(dep);
          const isMet = depNode && depNode.status === "done";
          const tag = document.createElement("span");
          tag.className = isMet ? "tag" : "tag blocked";
          tag.textContent = dep;
          tagList.appendChild(tag);
        });
      }

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = formatDate(node.updated_at || node.created_at);

      const actions = document.createElement("div");
      actions.className = "status-actions";

      if (isNodeBlocked(node, nodeMap)) {
        const blockedNote = document.createElement("span");
        blockedNote.className = "status-blocked";
        blockedNote.textContent = "blocked by deps";
        actions.appendChild(blockedNote);
      } else {
        statusOrder.forEach((statusOption) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className =
            statusOption === node.status ? "status-button active" : "status-button";
          button.textContent = statusOption.replace(/-/g, " ");
          button.addEventListener("click", () => updateNodeStatus(node.id, statusOption));
          actions.appendChild(button);
        });
      }

      card.append(cardTitle, cardDesc, tagList, meta, actions);

      // Assignee display
      if (node.assignee) {
        const assigneeDiv = document.createElement("div");
        assigneeDiv.className = "card-assignee";
        if (node.assignee && node.assignee === currentUsername) {
          assigneeDiv.classList.add("card-assignee-me");
          assigneeDiv.textContent = `@${node.assignee} (me)`;
        } else {
          assigneeDiv.textContent = `@${node.assignee}`;
        }
        card.appendChild(assigneeDiv);
      }

      // Assign/Unassign buttons (only for server-loaded graphs in development phase)
      if (entry && entry.source === "server" && graph.phase === "development") {
        const isActionable = !isNodeBlocked(node, nodeMap) && node.status !== "done";
        if (isActionable) {
          if (!node.assignee) {
            const takeBtn = document.createElement("button");
            takeBtn.type = "button";
            takeBtn.className = "assign-button assign-take";
            takeBtn.textContent = "Take";
            takeBtn.addEventListener("click", () => assignNode(entry, node.id));
            card.appendChild(takeBtn);
          } else if (node.assignee && node.assignee === currentUsername) {
            const releaseBtn = document.createElement("button");
            releaseBtn.type = "button";
            releaseBtn.className = "assign-button assign-release";
            releaseBtn.textContent = "Release";
            releaseBtn.addEventListener("click", () => unassignNode(entry, node.id));
            card.appendChild(releaseBtn);
          }
        }
      }

      // Card styling based on assignee
      if (node.assignee && node.assignee === currentUsername) {
        card.classList.add("card-mine");
      } else if (node.assignee) {
        card.classList.add("card-assigned");
      }

      column.appendChild(card);
    });

    board.appendChild(column);
  });
}

async function assignNode(entry, nodeId) {
  try {
    const response = await fetch(
      `/api/graphs/${encodeURIComponent(entry.name)}/nodes/${encodeURIComponent(nodeId)}/assign`,
      { method: "POST", headers: { "Content-Type": "application/json" } }
    );
    if (!response.ok) {
      const err = await response.json();
      showError(`Failed to assign: ${err.error || response.status}`);
      return;
    }
    const payload = await response.json();
    if (payload.graph) entry.graph = payload.graph;
    renderCurrentView(entry.graph);
  } catch (error) {
    showError(`Failed to assign: ${error.message}`);
  }
}

async function unassignNode(entry, nodeId) {
  try {
    const response = await fetch(
      `/api/graphs/${encodeURIComponent(entry.name)}/nodes/${encodeURIComponent(nodeId)}/unassign`,
      { method: "POST", headers: { "Content-Type": "application/json" } }
    );
    if (!response.ok) {
      const err = await response.json();
      showError(`Failed to unassign: ${err.error || response.status}`);
      return;
    }
    const payload = await response.json();
    if (payload.graph) entry.graph = payload.graph;
    renderCurrentView(entry.graph);
  } catch (error) {
    showError(`Failed to unassign: ${error.message}`);
  }
}

async function tryAutoLoad() {
  try {
    const response = await fetch(autoLoadUrl, { cache: "no-store" });
    if (!response.ok) return;

    const payload = await response.json();
    const graphs = Array.isArray(payload.graphs) ? payload.graphs : [];
    const errors = Array.isArray(payload.errors) ? payload.errors : [];

    if (graphs.length === 0) {
      if (errors.length > 0) {
        showError("No valid mikado_graph JSON found in auto-load.");
      }
      return;
    }

    loadedGraphs = graphs.map((entry) => ({ ...entry, source: "server" }));
    activeIndex = 0;
    renderTabs();
    setDownloadState(loadedGraphs[0]);
    renderCurrentView(loadedGraphs[0].graph);

    if (errors.length > 0) {
      showError(`Some files were skipped: ${errors.map((item) => item.file).join(", ")}`);
    }
  } catch (error) {
    // Auto-load is optional, fallback to manual selection.
  }
}

function readFileAsJson(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        resolve({ ok: true, file, data: parsed });
      } catch (error) {
        resolve({ ok: false, file, error: "Invalid JSON" });
      }
    };
    reader.onerror = () => resolve({ ok: false, file, error: "Read error" });
    reader.readAsText(file);
  });
}

async function handleFiles(fileList) {
  clearError();
  resetSummary();
  setDownloadState(null);
  loadedGraphs = [];
  activeIndex = -1;
  board.innerHTML = "";

  const files = Array.from(fileList || []).filter((file) => file.name.endsWith(".json"));
  if (files.length === 0) {
    showError("No JSON files selected.");
    renderTabs();
    return;
  }

  const results = await Promise.all(files.map(readFileAsJson));
  const invalidFiles = results.filter((result) => !result.ok).map((result) => result.file.name);

  const validGraphs = [];
  const invalidGraphs = [];

  results
    .filter((result) => result.ok)
    .forEach((result) => {
      const normalized = normalizeGraphSafe(result.data, result.file.name);
      if (normalized.ok) {
        validGraphs.push({
          name: result.file.name.replace(/\.json$/i, ""),
          graph: normalized.graph,
          source: "local"
        });
      } else {
        invalidGraphs.push(result.file.name);
      }
    });

  if (invalidFiles.length || invalidGraphs.length) {
    const allInvalid = [...new Set([...invalidFiles, ...invalidGraphs])];
    showError(`Some files were skipped: ${allInvalid.join(", ")}`);
  }

  if (validGraphs.length === 0) {
    showError("No valid mikado_graph JSON found.");
    renderTabs();
    return;
  }

  loadedGraphs = validGraphs;
  activeIndex = 0;
  renderTabs();
  setDownloadState(loadedGraphs[0]);
  renderCurrentView(loadedGraphs[0].graph);
}

fileInput.addEventListener("change", (event) => {
  handleFiles(event.target.files);
});

loadSample.addEventListener("click", () => {
  clearError();
  loadedGraphs = [{ name: "sample", graph: normalizeGraph(sampleData), source: "local" }];
  activeIndex = 0;
  renderTabs();
  setDownloadState(loadedGraphs[0]);
  renderCurrentView(loadedGraphs[0].graph);
});

if (downloadJson) {
  downloadJson.addEventListener("click", () => downloadGraph(getActiveEntry()));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function buildNodeHtml(node, isRoot, isLeaf) {
  let marker = "";
  if (isRoot) {
    marker = '<div class="graph-root-marker">goal</div>';
  } else if (isLeaf) {
    marker = '<div class="graph-leaf-marker">leaf</div>';
  }

  const statusText = node.status.replace(/-/g, " ");
  return `
    <div class="graph-node" data-status="${escapeHtml(node.status)}">
      ${marker}
      <div class="graph-node-id">${escapeHtml(node.id)}</div>
      <div class="graph-node-desc">${escapeHtml(node.description || "")}</div>
      <span class="graph-node-status" data-status="${escapeHtml(node.status)}">${escapeHtml(statusText)}</span>
    </div>
  `;
}

function measureNodeHeights(nodes, graph, nodeWidth) {
  const rootId = graph.root;
  const measurer = document.createElement("div");
  measurer.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;";
  document.body.appendChild(measurer);

  const heights = new Map();

  nodes.forEach((node) => {
    const isRoot = node.id === rootId;
    const isLeaf = node.depends_on.length === 0;
    const wrapper = document.createElement("div");
    wrapper.style.width = nodeWidth + "px";
    wrapper.innerHTML = buildNodeHtml(node, isRoot, isLeaf);
    measurer.appendChild(wrapper);
    heights.set(node.id, wrapper.firstElementChild.offsetHeight);
    measurer.removeChild(wrapper);
  });

  document.body.removeChild(measurer);
  return heights;
}

function buildDagreGraph(graph) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60, marginx: 30, marginy: 30 });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 220;

  const nodes = Object.values(graph.nodes).map((node) => ({
    ...node,
    status: node.status || "todo",
    depends_on: Array.isArray(node.depends_on) ? node.depends_on : []
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const heights = measureNodeHeights(nodes, graph, nodeWidth);

  nodes.forEach((node) => {
    const h = heights.get(node.id) || 90;
    g.setNode(node.id, { width: nodeWidth, height: h, node });
  });

  // Edges: dependency → dependent (dep is source, node is target)
  nodes.forEach((node) => {
    node.depends_on.forEach((depId) => {
      if (nodeMap.has(depId)) {
        g.setEdge(depId, node.id);
      }
    });
  });

  dagre.layout(g);
  return { dagreG: g, nodeMap, nodeWidth };
}

function renderEdges(container, dagreG, nodeMap) {
  const lineGen = d3.line()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(d3.curveBasis);

  dagreG.edges().forEach((e) => {
    const edge = dagreG.edge(e);
    const depNode = nodeMap.get(e.v);
    const isDone = depNode && depNode.status === "done";

    const markerId = isDone ? "arrow-done" : "arrow-unmet";

    container.append("path")
      .attr("d", lineGen(edge.points))
      .attr("fill", "none")
      .attr("stroke", isDone ? "rgba(31,122,122,0.4)" : "rgba(224,92,43,0.3)")
      .attr("stroke-width", isDone ? 2 : 1.5)
      .attr("stroke-dasharray", isDone ? null : "6 4")
      .attr("marker-end", `url(#${markerId})`);
  });
}

function renderNodes(container, dagreG, graph, nodeWidth) {
  const rootId = graph.root;
  let index = 0;

  dagreG.nodes().forEach((nodeId) => {
    const dagNode = dagreG.node(nodeId);
    const node = dagNode.node;
    const isRoot = node.id === rootId;
    const isLeaf = node.depends_on.length === 0;
    const h = dagNode.height;

    const fo = container.append("foreignObject")
      .attr("x", dagNode.x - nodeWidth / 2)
      .attr("y", dagNode.y - h / 2)
      .attr("width", nodeWidth)
      .attr("height", h)
      .style("opacity", 0);

    fo.html(buildNodeHtml(node, isRoot, isLeaf));

    fo.transition()
      .delay(index * 40)
      .duration(300)
      .style("opacity", 1);

    index++;
  });
}

function renderGraphD3(graph) {
  if (!graph || !graph.nodes) return;

  graphView.innerHTML = "";

  const { dagreG, nodeMap, nodeWidth } = buildDagreGraph(graph);
  const graphData = dagreG.graph();
  const svgWidth = graphData.width || 800;
  const svgHeight = graphData.height || 600;

  // Compute stats
  const nodes = Object.values(graph.nodes).map((n) => ({
    ...n,
    status: n.status || "todo",
    depends_on: Array.isArray(n.depends_on) ? n.depends_on : []
  }));
  const nMap = new Map(nodes.map((n) => [n.id, n]));
  const totals = nodes.length;
  const done = nodes.filter((n) => n.status === "done").length;
  const blocked = nodes.filter((n) => isNodeBlocked(n, nMap)).length;
  const ready = nodes.filter((n) => n.status !== "done" && !isNodeBlocked(n, nMap)).length;
  updateSummary(graph, { totals, done, blocked, ready });

  const containerWidth = graphView.clientWidth || 800;
  const containerHeight = Math.max(500, window.innerHeight - graphView.getBoundingClientRect().top - 40);

  const svg = d3.select(graphView)
    .append("svg")
    .attr("class", "graph-d3-svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight);

  // Arrow markers
  const defs = svg.append("defs");

  defs.append("marker")
    .attr("id", "arrow-done")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 10)
    .attr("refY", 5)
    .attr("markerWidth", 8)
    .attr("markerHeight", 8)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 Z")
    .attr("fill", "rgba(31,122,122,0.6)");

  defs.append("marker")
    .attr("id", "arrow-unmet")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 10)
    .attr("refY", 5)
    .attr("markerWidth", 8)
    .attr("markerHeight", 8)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 Z")
    .attr("fill", "rgba(224,92,43,0.5)");

  // Zoom group
  const zoomGroup = svg.append("g");

  const zoom = d3.zoom()
    .scaleExtent([0.3, 2])
    .on("zoom", (event) => {
      zoomGroup.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Render edges first (behind nodes)
  const edgeGroup = zoomGroup.append("g").attr("class", "edges");
  renderEdges(edgeGroup, dagreG, nodeMap);

  // Render nodes on top
  const nodeGroup = zoomGroup.append("g").attr("class", "nodes");
  renderNodes(nodeGroup, dagreG, graph, nodeWidth);

  // Fit to view
  const padding = 40;
  const scaleX = (containerWidth - padding * 2) / svgWidth;
  const scaleY = (containerHeight - padding * 2) / svgHeight;
  const scale = Math.min(scaleX, scaleY, 1);
  const tx = (containerWidth - svgWidth * scale) / 2;
  const ty = (containerHeight - svgHeight * scale) / 2;

  svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
}

function setView(view) {
  currentView = view;
  viewKanbanBtn.classList.toggle("active", view === "kanban");
  viewGraphBtn.classList.toggle("active", view === "graph");
  board.hidden = view !== "kanban";
  graphView.hidden = view !== "graph";

  const entry = getActiveEntry();
  if (entry && entry.graph) {
    if (view === "kanban") {
      renderBoard(entry.graph);
    } else {
      renderGraphD3(entry.graph);
    }
  }
}

viewKanbanBtn.addEventListener("click", () => setView("kanban"));
viewGraphBtn.addEventListener("click", () => setView("graph"));

async function reloadActiveGraph() {
  try {
    const response = await fetch(autoLoadUrl, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const graphs = Array.isArray(payload.graphs) ? payload.graphs : [];
    loadedGraphs = graphs.map((e) => ({ ...e, source: "server" }));
    const entry = getActiveEntry();
    if (entry && entry.graph) {
      renderCurrentView(entry.graph);
    }
  } catch {
    // silent
  }
}

// Auto-refresh: poll for file changes every 3 seconds
let autoRefreshInterval = null;
function startAutoRefresh() {
  if (autoRefreshInterval) return;
  autoRefreshInterval = setInterval(async () => {
    try {
      const resp = await fetch("/api/last-change", { cache: "no-store" });
      if (!resp.ok) return;
      const { timestamp } = await resp.json();
      if (timestamp > lastKnownChange) {
        lastKnownChange = timestamp;
        await reloadActiveGraph();
      }
    } catch {
      // silent
    }
  }, 3000);
}

window.addEventListener("DOMContentLoaded", () => {
  fetch("/api/me").then((r) => r.json()).then((data) => {
    currentUsername = data.username || null;
  }).catch(() => {});

  tryAutoLoad().then(() => {
    lastKnownChange = Date.now();
    startAutoRefresh();
  });
});
