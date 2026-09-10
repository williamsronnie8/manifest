import { expect, test } from "@playwright/test";

// Every command uses the graphical truck/location selection and contextual actions.
const loadSites = { L1: ["Depot", "North"], L2: ["Depot", "South"], L3: ["North", "South"], L4: ["South", "Depot"] };
async function submit(page, command) {
  if (command.type === "advance") {
    await page.getByRole("button", { name: "Advance to next arrival" }).click();
    return;
  }
  await page.getByRole("button", { name: `Select truck ${command.truckId}`, exact: true }).click();
  const location = command.type === "travel" ? command.destinationId : loadSites[command.loadId][command.type === "pickup" ? 0 : 1];
  await page.getByRole("button", { name: `Select location ${location}`, exact: true }).click();
  const action = command.type === "travel" ? `Travel ${command.truckId} to ${location}` : `${command.type === "pickup" ? "Pickup" : "Deliver"} ${command.loadId}`;
  await page.getByRole("button", { name: action, exact: true }).click();
}

const completeDayCommands = [
  { type: "pickup", truckId: "T1", loadId: "L1" },
  { type: "travel", truckId: "T1", destinationId: "North" },
  { type: "pickup", truckId: "T2", loadId: "L2" },
  { type: "travel", truckId: "T2", destinationId: "South" },
  { type: "advance" },
  { type: "deliver", truckId: "T1", loadId: "L1" },
  { type: "pickup", truckId: "T1", loadId: "L3" },
  { type: "travel", truckId: "T1", destinationId: "South" },
  { type: "advance" },
  { type: "deliver", truckId: "T2", loadId: "L2" },
  { type: "pickup", truckId: "T2", loadId: "L4" },
  { type: "travel", truckId: "T2", destinationId: "Depot" },
  { type: "advance" },
  { type: "deliver", truckId: "T1", loadId: "L3" },
  { type: "advance" },
  { type: "deliver", truckId: "T2", loadId: "L4" },
];

test("the clickable complete day reaches minute 150 and replays identically", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Manifest", exact: true })).toBeVisible();
  for (const name of ["Operation", "Dispatch map", "Loads", "Accepted events", "Result"]) {
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  }
  await expect(page.locator("select")).toHaveCount(0);
  for (const id of ["T1", "T2"]) await expect(page.getByRole("button", { name: `Select truck ${id}`, exact: true })).toBeVisible();
  for (const id of ["Depot", "North", "South"]) await expect(page.getByRole("button", { name: `Select location ${id}`, exact: true })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("initial-map.png"), fullPage: true });
  for (const [index, command] of completeDayCommands.entries()) {
    await submit(page, command);
    if (index === 3) {
      await expect(page.locator(".active-route")).toHaveCount(2);
      await page.screenshot({ path: testInfo.outputPath("active-trips.png"), fullPage: true });
    }
  }

  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("150");
  await expect(page.getByLabel("Delivered loads", { exact: true })).toHaveText("L1, L2, L3, L4");
  await expect(page.getByLabel("Undelivered loads", { exact: true })).toHaveText("None");
  await expect(page.getByLabel("All delivered", { exact: true })).toHaveText("yes");
  await expect(page.getByLabel("Completion minute", { exact: true })).toHaveText("150");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("16");
  await expect(page.getByRole("status")).toHaveText("Accepted: load_delivered");

  const events = page
    .getByRole("region", { name: "Accepted events" })
    .locator("[data-event-type]");
  await expect(events).toHaveCount(16);
  const eventTypes = await events.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-event-type")),
  );
  expect(eventTypes).toEqual([
    "load_picked_up",
    "travel_started",
    "load_picked_up",
    "travel_started",
    "truck_arrived",
    "load_delivered",
    "load_picked_up",
    "travel_started",
    "truck_arrived",
    "load_delivered",
    "load_picked_up",
    "travel_started",
    "truck_arrived",
    "load_delivered",
    "truck_arrived",
    "load_delivered",
  ]);

  await page.getByRole("button", { name: "Replay accepted commands" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Replay matched 16 accepted events.",
  );
  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("150");
  await expect(events).toHaveCount(16);
  expect(
    await events.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-event-type")),
    ),
  ).toEqual(eventTypes);
  await expect(page.locator("[data-run-summary]")).toContainText("Dispatch complete. 4/4 loads delivered at minute 150.");
  await page.getByRole("button", { name: "Review result" }).click();
  await expect(page.getByRole("region", { name: "Result", exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("complete-day.png"), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("a capacity rejection is atomic and reset restores the initial browser state", async ({
  page,
}) => {
  await page.goto("/");
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L2" });
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L1" });

  await expect(page.getByRole("status")).toHaveText("Rejected: CAPACITY_EXCEEDED");
  await expect(page.locator("[data-rejection-help]")).toContainText("won't fit");
  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("0");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("1");
  await expect(
    page.getByRole("region", { name: "Accepted events" }).locator("[data-event-type]"),
  ).toHaveCount(1);
  await expect(page.locator('[data-load-id="L2"]')).toHaveAttribute(
    "data-status",
    "carried",
  );
  await expect(page.locator('[data-load-id="L1"]')).toHaveAttribute(
    "data-status",
    "available",
  );

  await page.getByRole("button", { name: "Reset day" }).click();
  await expect(page.getByRole("status")).toHaveText("Day reset.");
  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("0");
  await expect(page.getByLabel("Delivered loads", { exact: true })).toHaveText("None");
  await expect(page.getByLabel("Undelivered loads", { exact: true })).toHaveText("L1, L2, L3, L4");
  await expect(page.getByLabel("All delivered", { exact: true })).toHaveText("no");
  await expect(page.getByLabel("Completion minute", { exact: true })).toHaveText("Not complete");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("0");
  await expect(
    page.getByRole("region", { name: "Accepted events" }).locator("[data-event-type]"),
  ).toHaveCount(0);
  await expect(page.locator("[data-loads]")).toBeEmpty();
  await expect(page.getByRole("button", { name: "Select location Depot", exact: true })).toContainText("L1 · L2 waiting");
  await expect(page.locator("[data-world]")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(page.locator('.map-truck[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator("[data-rejection-help]")).toBeEmpty();
});

for (const width of [1440, 900, 390]) {
  test(`instructions, routes, keyboard controls and layout at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("[data-objective]")).toHaveText("Deliver all 4 loads by minute 480. Your score is the number delivered, with no speed bonus.");
    await expect(page.getByText("How to play & travel times", { exact: true })).toBeVisible();
    await page.getByText("How to play & travel times", { exact: true }).click();
    await expect(page.locator("[data-routes] li")).toHaveText([
      "Depot ↔ North: 60 minutes",
      "Depot ↔ South: 75 minutes",
      "North ↔ South: 45 minutes",
    ]);
    await page.getByRole("button", { name: "Advance to next arrival" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("Rejected: NO_SCHEDULED_EVENT");
    await expect(page.locator("[data-rejection-help]")).toContainText("Dispatch a trip");
    await page.getByRole("button", { name: "Select truck T1", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Select truck T1", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Select truck T2", exact: true })).toBeFocused();
    await submit(page, { type: "travel", truckId: "T1", destinationId: "North" });
    await page.getByRole("button", { name: "Advance to next arrival" }).click();
    await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("60");
    await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const selector of ["button", ".panel", ".record"]) {
      expect(await page.locator(selector).evaluateAll((elements) => elements.filter((el) => !el.closest("[hidden]")).every((el) => {
        const box = el.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth;
      }))).toBe(true);
    }
    const mapBox = await page.locator("[data-map]").boundingBox();
    expect(mapBox.height).toBeGreaterThan(400);
    if (width === 1440) expect(mapBox.width).toBeGreaterThan(width * .65);
    // Labels must remain readable beside the parked truck markers at fitted zoom.
    expect(await page.locator(".route-label").evaluateAll((labels) => labels.every((label) => {
      const a = label.getBoundingClientRect();
      return [...document.querySelectorAll(".map-truck, .map-site")].every((marker) => {
        const b = marker.getBoundingClientRect();
        return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
      });
    }))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`board-${width}.png`), fullPage: true });
  });
}

test("wrong-location, transit and terminal rejections preserve the run", async ({ page }) => {
  await page.goto("/");
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L3" });
  await expect(page.getByRole("status")).toHaveText("Rejected: WRONG_LOCATION");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("0");
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L1" });
  await submit(page, { type: "travel", truckId: "T1", destinationId: "North" });
  await submit(page, { type: "deliver", truckId: "T1", loadId: "L1" });
  await expect(page.getByRole("status")).toHaveText("Rejected: TRUCK_IN_TRANSIT");
  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("0");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("2");
  await page.getByRole("button", { name: "Advance to next arrival" }).click();
  await submit(page, { type: "deliver", truckId: "T1", loadId: "L1" });
  await submit(page, { type: "deliver", truckId: "T1", loadId: "L1" });
  await expect(page.getByRole("status")).toHaveText("Rejected: LOAD_ALREADY_DELIVERED");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("4");
  await page.getByRole("button", { name: "Replay accepted commands" }).click();
  await expect(page.getByRole("status")).toHaveText("Replay matched 4 accepted events.");
});

test("an incomplete day reaches 480, allows final delivery and reports the remainder", async ({ page }, testInfo) => {
  await page.goto("/");
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L1" });
  for (const destinationId of ["South", "North", "Depot", "North", "Depot", "North", "Depot"]) {
    await submit(page, { type: "travel", truckId: "T1", destinationId });
    await page.getByRole("button", { name: "Advance to next arrival" }).click();
  }
  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("420");
  await submit(page, { type: "travel", truckId: "T1", destinationId: "South" });
  await expect(page.getByRole("status")).toHaveText("Rejected: ARRIVAL_AFTER_DAY_END");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("15");
  await submit(page, { type: "travel", truckId: "T1", destinationId: "North" });
  await page.getByRole("button", { name: "Advance to next arrival" }).click();
  await submit(page, { type: "deliver", truckId: "T1", loadId: "L1" });
  await expect(page.getByRole("status")).toHaveText("Accepted: load_delivered");
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L3" });
  await expect(page.getByRole("status")).toHaveText("Rejected: DAY_ENDED");
  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("480");
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("18");
  await page.getByRole("button", { name: "Review result" }).click();
  await expect(page.locator("[data-result-summary]")).toHaveText("1/4 loads delivered at minute 480. Remaining: L2, L3, L4.");
  await expect(page.getByLabel("All delivered", { exact: true })).toHaveText("no");
  await expect(page.getByLabel("Completion minute", { exact: true })).toHaveText("Not complete");
  await page.getByRole("button", { name: "Replay accepted commands" }).click();
  await expect(page.getByRole("status")).toHaveText("Replay matched 18 accepted events.");
  await page.screenshot({ path: testInfo.outputPath("incomplete-day.png"), fullPage: true });
});


test("drag, wheel, keyboard camera and reset never submit commands", async ({ page }) => {
  await page.goto("/");
  const world = page.locator("[data-world]");
  const map = page.getByRole("group", { name: "World map", exact: true });
  const truck = page.getByRole("button", { name: "Select truck T1", exact: true });
  const start = await truck.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 130, start.y + 90, { steps: 12 });
  await page.mouse.up();
  await expect(world).not.toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(truck).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-context-heading]")).toHaveText("Choose a truck on the map");
  await page.mouse.wheel(0, -100);
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("110%");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("132%");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("110%");
  await map.focus();
  await page.keyboard.press("Home");
  await expect(world).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.keyboard.press("ArrowRight");
  await expect(world).toHaveCSS("transform", "matrix(1, 0, 0, 1, -60, 0)");
  await page.keyboard.press("+");
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("120%");
  await page.getByRole("button", { name: "Fit map", exact: true }).click();
  await expect(world).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await truck.click();
  await page.getByRole("button", { name: "Select location North", exact: true }).click();
  await expect(page.getByRole("button", { name: "Travel T1 to North", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("0");
  await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("0");
  await expect(page.locator("[data-event-type]")).toHaveCount(0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Reset day", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choose truck and destination", exact: true })).toBeDisabled();
  await expect(world).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(page.getByLabel("Map zoom", { exact: true })).toHaveText("100%");
});

test("keyboard dispatch keeps focus after actions and map roads reflect projected travel", async ({ page }) => {
  await page.goto("/");
  const truck = page.getByRole("button", { name: "Select truck T1", exact: true });
  await truck.focus();
  await page.keyboard.press("Space");
  const pickup = page.getByRole("button", { name: "Pickup L1", exact: true });
  await pickup.focus();
  await page.keyboard.press("Enter");
  await expect(pickup).toBeFocused();
  await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("1");
  await page.getByRole("button", { name: "Select location North", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Travel T1 to North", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".active-route")).toHaveCount(1);
  await expect(truck).toHaveAttribute("data-position", "in_transit");
  await expect(truck).toContainText("→ 60");
  await page.getByRole("button", { name: "Advance to next arrival", exact: true }).click();
  await expect(page.locator(".active-route")).toHaveCount(0);
  await expect(truck).toHaveAttribute("data-position", "at");
  await page.getByRole("button", { name: "Deliver L1", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Deliver L1", exact: true })).toBeFocused();
  await expect(page.getByLabel("Delivered loads", { exact: true })).toHaveText("L1");
});
