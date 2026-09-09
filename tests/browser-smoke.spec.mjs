import { expect, test } from "@playwright/test";

async function chooseCommand(page, command) {
  await page.getByLabel("Command", { exact: true }).selectOption(command.type);

  const truck = page.getByLabel("Truck", { exact: true });
  const load = page.getByLabel("Load", { exact: true });
  const destination = page.getByLabel("Destination", { exact: true });

  if (command.type === "pickup" || command.type === "deliver") {
    await expect(truck).toBeVisible();
    await expect(load).toBeVisible();
    await expect(destination).toBeHidden();
    await truck.selectOption(command.truckId);
    await load.selectOption(command.loadId);
  } else if (command.type === "travel") {
    await expect(truck).toBeVisible();
    await expect(load).toBeHidden();
    await expect(destination).toBeVisible();
    await truck.selectOption(command.truckId);
    await destination.selectOption(command.destinationId);
  } else {
    await expect(truck).toBeHidden();
    await expect(load).toBeHidden();
    await expect(destination).toBeHidden();
  }
}

async function submit(page, command) {
  await chooseCommand(page, command);
  await page.getByRole("button", { name: "Submit command" }).click();
}

async function optionValues(select) {
  return select.locator("option").evaluateAll((options) =>
    options.map((option) => option.value),
  );
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
  for (const name of ["Operation", "Trucks", "Loads", "Accepted events", "Result"]) {
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  expect(await optionValues(page.getByLabel("Command", { exact: true }))).toEqual([
    "pickup",
    "travel",
    "deliver",
    "advance",
  ]);
  expect(await optionValues(page.getByLabel("Truck", { exact: true }))).toEqual(["T1", "T2"]);
  expect(await optionValues(page.getByLabel("Load", { exact: true }))).toEqual(["L1", "L2", "L3", "L4"]);
  expect(await optionValues(page.getByLabel("Destination", { exact: true }))).toEqual([
    "Depot",
    "North",
    "South",
  ]);

  for (const command of completeDayCommands) await submit(page, command);

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
  await expect(page.locator('[data-load-id="L1"]')).toHaveAttribute(
    "data-status",
    "available",
  );
  await expect(page.locator('[data-load-id="L2"]')).toHaveAttribute(
    "data-status",
    "available",
  );
  await expect(page.locator("[data-rejection-help]")).toBeEmpty();
});

for (const width of [1440, 900, 390]) {
  test(`instructions, routes, keyboard controls and layout at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("[data-objective]")).toHaveText("Deliver all 4 loads by minute 480. Your score is the number delivered, with no speed bonus.");
    await expect(page.getByText("How to play", { exact: true })).toBeVisible();
    await expect(page.locator("[data-routes] li")).toHaveText([
      "Depot ↔ North: 60 minutes",
      "Depot ↔ South: 75 minutes",
      "North ↔ South: 45 minutes",
    ]);
    await page.getByRole("button", { name: "Advance to next arrival" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toHaveText("Rejected: NO_SCHEDULED_EVENT");
    await expect(page.locator("[data-rejection-help]")).toContainText("Dispatch a trip");
    await page.getByLabel("Command", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Truck", { exact: true })).toBeFocused();
    await submit(page, { type: "travel", truckId: "T1", destinationId: "North" });
    await page.getByRole("button", { name: "Advance to next arrival" }).click();
    await expect(page.getByLabel("Current minute", { exact: true })).toHaveText("60");
    await expect(page.getByLabel("Accepted command count", { exact: true })).toHaveText("2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const selector of ["button", "select", ".panel", ".record"]) {
      expect(await page.locator(selector).evaluateAll((elements) => elements.filter((el) => !el.closest("[hidden]")).every((el) => {
        const box = el.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth;
      }))).toBe(true);
    }
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
