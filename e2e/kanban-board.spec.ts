import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

// Snapshot all YAML fixture directories at import time
const fixtureGraphs = ["simple-graph", "second-graph"];
const originalFixtures: Record<string, Record<string, string>> = {};

for (const graphName of fixtureGraphs) {
  const graphDir = path.join(FIXTURES_DIR, graphName);
  if (fs.existsSync(graphDir) && fs.statSync(graphDir).isDirectory()) {
    originalFixtures[graphName] = {};
    for (const file of fs.readdirSync(graphDir).filter((f) => f.endsWith(".yaml"))) {
      originalFixtures[graphName][file] = fs.readFileSync(path.join(graphDir, file), "utf-8");
    }
  }
}

function restoreFixtures() {
  for (const [graphName, files] of Object.entries(originalFixtures)) {
    const graphDir = path.join(FIXTURES_DIR, graphName);
    if (!fs.existsSync(graphDir)) {
      fs.mkdirSync(graphDir, { recursive: true });
    }
    // Remove any extra files
    for (const existing of fs.readdirSync(graphDir)) {
      if (!files[existing]) {
        fs.unlinkSync(path.join(graphDir, existing));
      }
    }
    // Write original files
    for (const [file, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(graphDir, file), content, "utf-8");
    }
  }
}

test.beforeEach(async () => {
  restoreFixtures();
});

test.afterAll(async () => {
  restoreFixtures();
});

// ---------------------------------------------------------------------------
// HIGH PRIORITY: Auto-load — board displays columns with correct cards
// ---------------------------------------------------------------------------

test("auto-load displays board with columns and cards", async ({ page }) => {
  await page.goto("/");

  // Wait for cards to render
  await expect(page.locator(".card")).not.toHaveCount(0);

  // We have 2 graphs (simple-graph + second-graph), first alphabetically is "second-graph"
  // Columns should be present: the active graph's statuses
  const columns = page.locator(".column");
  await expect(columns).not.toHaveCount(0);

  // Column headers should show status names
  const headers = page.locator(".column-title");
  const headerTexts = await headers.allTextContents();
  // At least "todo" and "done" should appear
  expect(headerTexts.some((h) => h.includes("todo"))).toBe(true);
  expect(headerTexts.some((h) => h.includes("done"))).toBe(true);
});

test("auto-load displays correct number of cards for active graph", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  // First graph alphabetically is "second-graph" (2 nodes: migrate-db, backup-data)
  const cards = page.locator(".card");
  await expect(cards).toHaveCount(2);
});

// ---------------------------------------------------------------------------
// HIGH PRIORITY: Summary / stats correctness
// ---------------------------------------------------------------------------

test("summary shows correct stats for active graph", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  // "second-graph" is active first (alphabetical): 2 nodes, 1 done, 0 blocked (migrate-db deps are met), 1 ready
  const stats = page.locator("#stats");
  await expect(stats).toContainText("2 nodes");
  await expect(stats).toContainText("1 done");
});

test("goal is displayed in summary", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  const goal = page.locator("#goal");
  await expect(goal).toContainText("Migrate database");
});

// ---------------------------------------------------------------------------
// HIGH PRIORITY: Multi-graph tabs
// ---------------------------------------------------------------------------

test("tabs appear when multiple graphs are loaded", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  const tabsSection = page.locator("#tabs");
  await expect(tabsSection).toBeVisible();

  const tabButtons = tabsSection.locator("button.tab");
  await expect(tabButtons).toHaveCount(2);
});

test("switching tabs loads the other graph", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  // Initially "second-graph" is active (alphabetical)
  await expect(page.locator("#goal")).toContainText("Migrate database");

  // Click the "simple-graph" tab
  await page.locator("button.tab", { hasText: "simple-graph" }).click();

  // Now "simple-graph" should be active with 4 nodes
  await expect(page.locator("#goal")).toContainText("Deliver feature X");
  const cards = page.locator(".card");
  await expect(cards).toHaveCount(4);
});

// ---------------------------------------------------------------------------
// HIGH PRIORITY: Blocked by deps
// ---------------------------------------------------------------------------

test("nodes with unmet deps show blocked by deps instead of buttons", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  // Switch to simple-graph which has blocked nodes
  await page.locator("button.tab", { hasText: "simple-graph" }).click();
  await expect(page.locator(".card")).toHaveCount(4);

  // "feature-x" depends on "write-tests" (doing) and "setup-ci" (done) — blocked
  const featureCard = page.locator(".card", { has: page.locator(".card-title", { hasText: "feature-x" }) });
  await expect(featureCard.locator(".status-blocked")).toContainText("blocked by deps");

  // "write-tests" depends on "setup-ci" (done) — NOT blocked, should have status buttons
  const writeTestsCard = page.locator(".card", { has: page.locator(".card-title", { hasText: "write-tests" }) });
  await expect(writeTestsCard.locator(".status-button")).not.toHaveCount(0);

  // "update-docs" has no deps — NOT blocked, should have status buttons
  const updateDocsCard = page.locator(".card", { has: page.locator(".card-title", { hasText: "update-docs" }) });
  await expect(updateDocsCard.locator(".status-button")).not.toHaveCount(0);
});

// ---------------------------------------------------------------------------
// HIGH PRIORITY: Status change — clicking a status button moves the card
// ---------------------------------------------------------------------------

test("clicking a status button moves card to correct column", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  // Switch to simple-graph
  await page.locator("button.tab", { hasText: "simple-graph" }).click();
  await expect(page.locator(".card")).toHaveCount(4);

  // "update-docs" is in "todo" column and not blocked — click "done" button
  const updateDocsCard = page.locator(".card", { has: page.locator(".card-title", { hasText: "update-docs" }) });
  await updateDocsCard.locator(".status-button", { hasText: "done" }).click();

  // After click, card should now be in the "done" column
  // The "done" column should contain "update-docs"
  const doneColumn = page.locator(".column", { has: page.locator(".column-title", { hasText: "done" }) });
  await expect(doneColumn.locator(".card-title", { hasText: "update-docs" })).toBeVisible();

  // Stats should update: now 2 done
  await expect(page.locator("#stats")).toContainText("2 done");
});

// ---------------------------------------------------------------------------
// MEDIUM PRIORITY: Load sample button
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MEDIUM PRIORITY: Phase indicator in summary
// ---------------------------------------------------------------------------

test("summary shows phase indicator for design phase", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  const stats = page.locator("#stats");
  await expect(stats).toContainText("DESIGN");
});

// ---------------------------------------------------------------------------
// MEDIUM PRIORITY: Load sample button
// ---------------------------------------------------------------------------

test("load sample button displays sample data", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".card")).not.toHaveCount(0);

  // Click "Load sample" button
  await page.locator("#loadSample").click();

  // Sample data has goal "Use Firebase as persistence to replace PostgreSQL"
  await expect(page.locator("#goal")).toContainText("Use Firebase as persistence");

  // Tabs should be hidden (only 1 graph)
  await expect(page.locator("#tabs")).toBeHidden();

  // Cards should appear
  await expect(page.locator(".card")).not.toHaveCount(0);
});
