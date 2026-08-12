import { expect, test } from "@playwright/test";

async function chooseCommand(page, command) {
  await page.getByLabel("Command").selectOption(command.type);

  const truck = page.getByLabel("Truck");
  const load = page.getByLabel("Load");
  const destination = page.getByLabel("Destination");

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
}) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Manifest", exact: true })).toBeVisible();
  for (const name of ["Operation", "Trucks", "Loads", "Accepted events", "Result"]) {
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  expect(await optionValues(page.getByLabel("Command"))).toEqual([
    "pickup",
    "travel",
    "deliver",
    "advance",
  ]);
  expect(await optionValues(page.getByLabel("Truck"))).toEqual(["T1", "T2"]);
  expect(await optionValues(page.getByLabel("Load"))).toEqual(["L1", "L2", "L3", "L4"]);
  expect(await optionValues(page.getByLabel("Destination"))).toEqual([
    "Depot",
    "North",
    "South",
  ]);

  for (const command of completeDayCommands) await submit(page, command);

  await expect(page.getByLabel("Current minute")).toHaveText("150");
  await expect(page.getByLabel("Delivered loads")).toHaveText("L1, L2, L3, L4");
  await expect(page.getByLabel("Undelivered loads")).toHaveText("None");
  await expect(page.getByLabel("All delivered")).toHaveText("yes");
  await expect(page.getByLabel("Completion minute")).toHaveText("150");
  await expect(page.getByLabel("Accepted command count")).toHaveText("16");
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
  await expect(page.getByLabel("Current minute")).toHaveText("150");
  await expect(events).toHaveCount(16);
  expect(
    await events.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-event-type")),
    ),
  ).toEqual(eventTypes);
  expect(consoleErrors).toEqual([]);
});

test("a capacity rejection is atomic and reset restores the initial browser state", async ({
  page,
}) => {
  await page.goto("/");
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L2" });
  await submit(page, { type: "pickup", truckId: "T1", loadId: "L1" });

  await expect(page.getByRole("status")).toHaveText("Rejected: CAPACITY_EXCEEDED");
  await expect(page.getByLabel("Current minute")).toHaveText("0");
  await expect(page.getByLabel("Accepted command count")).toHaveText("1");
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
  await expect(page.getByLabel("Current minute")).toHaveText("0");
  await expect(page.getByLabel("Delivered loads")).toHaveText("None");
  await expect(page.getByLabel("Undelivered loads")).toHaveText("L1, L2, L3, L4");
  await expect(page.getByLabel("All delivered")).toHaveText("no");
  await expect(page.getByLabel("Completion minute")).toHaveText("Not complete");
  await expect(page.getByLabel("Accepted command count")).toHaveText("0");
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
});
