import {
  createSession,
  getScenarioProjection,
  projectSession,
  replayCommands,
  submitCommand,
} from "../../application/index.js";
import { parseCommandInput } from "./parse-command.js";

export { parseCommandInput };

type ApplicationCommand = Parameters<typeof submitCommand>[1];
type Session = ReturnType<typeof createSession>;
type EngineEvent = Session["events"][number];

type ParsedCommand = Extract<
  ReturnType<typeof parseCommandInput>,
  { ok: true }
>["command"];

const rejectionHints: Record<Extract<ReturnType<typeof submitCommand>, { ok: false }>["rejection"]["code"], string> = {
  UNKNOWN_COMMAND: "Choose Pickup, Travel, Deliver, or Advance.",
  UNKNOWN_TRUCK: "Choose a truck listed on the board.",
  UNKNOWN_LOAD: "Choose a load listed on the board.",
  UNKNOWN_LOCATION: "Choose a location listed in Travel times.",
  DAY_ENDED: "The day limit has been reached. You can still deliver cargo already at its destination at the limit. Review your result or reset the day.",
  TRUCK_IN_TRANSIT: "This truck is still traveling. Advance to its arrival before giving it another task.",
  LOAD_ALREADY_DELIVERED: "That load is complete. Choose an undelivered load.",
  LOAD_NOT_AVAILABLE: "That load is already on a truck. Check Carried loads on the board.",
  LOAD_NOT_CARRIED: "This truck isn't carrying that load. Pick it up first, or select the truck carrying it.",
  WRONG_LOCATION: "Pickup requires the load's origin; delivery requires its destination. Travel there, then advance to arrival.",
  INVALID_TRAVEL_LEG: "The truck is already there. Choose a different destination.",
  CAPACITY_EXCEEDED: "That load won't fit with the cargo already aboard. Deliver your cargo first or use the other truck.",
  ARRIVAL_AFTER_DAY_END: "That trip would arrive after the day limit. Choose a shorter route, review your result, or reset to try another plan.",
  NO_SCHEDULED_EVENT: "No trucks are traveling. Dispatch a trip before advancing, or review your result.",
};

const SHELL = `
  <div class="manifest-shell">
    <header class="manifest-header">
      <div>
        <div class="eyebrow">One-day dispatch simulation</div>
        <h1>Manifest</h1>
        <p data-objective></p>
      </div>
      <div class="clock">
        <span class="metric-label">Current minute</span>
        <output role="group" aria-label="Current minute" data-minute>0</output>
      </div>
    </header>

    <section class="scenario-strip" aria-label="Authored scenario">
      <div class="metric">
        <span class="metric-label">Operating limit</span>
        <output role="group" data-metric-limit></output>
      </div>
      <div class="metric">
        <span class="metric-label">Locations</span>
        <output role="group" data-metric-locations></output>
      </div>
      <div class="metric">
        <span class="metric-label">Trucks</span>
        <output role="group" data-metric-trucks></output>
      </div>
      <div class="metric">
        <span class="metric-label">Loads</span>
        <output role="group" data-metric-loads></output>
      </div>
    </section>

    <div class="manifest-grid">
      <section class="panel operation-panel" role="region" aria-label="Operation">
        <div class="panel-inner">
          <h2>Operation</h2>
          <p class="run-summary" data-run-summary aria-live="polite"></p>
          <form>
            <div class="field-grid">
              <div class="field" data-command-field>
                <label for="manifest-command">Command</label>
                <select id="manifest-command" data-command></select>
              </div>
              <div class="field" data-truck-field>
                <label for="manifest-truck">Truck</label>
                <select id="manifest-truck" data-truck></select>
              </div>
              <div class="field" data-load-field>
                <label for="manifest-load">Load</label>
                <select id="manifest-load" data-load></select>
              </div>
              <div class="field" data-destination-field>
                <label for="manifest-destination">Destination</label>
                <select id="manifest-destination" data-destination></select>
              </div>
            </div>
            <div class="button-row">
              <button type="submit">Submit command</button>
              <button type="button" data-advance>Advance to next arrival</button>
              <button type="button" data-review>Review result</button>
              <button type="button" data-reset>Reset day</button>
              <button type="button" data-replay>Replay accepted commands</button>
            </div>
          </form>
          <div role="status" aria-live="polite" data-status>Ready.</div>
          <p class="help-text" data-rejection-help></p>
          <details open class="instructions">
            <summary>How to play</summary>
            <ol>
              <li><strong>Pickup:</strong> choose a truck and a load waiting at its location. Load sizes must fit its capacity.</li>
              <li><strong>Travel:</strong> send that truck to the load's destination. You can dispatch the other truck at the same minute.</li>
              <li><strong>Advance:</strong> jump to the next arrival. Time never passes by itself.</li>
              <li><strong>Deliver:</strong> unload at the destination. Arrival doesn't deliver automatically. Pick up your next load and repeat.</li>
            </ol>
            <p>Start by picking up L1 with T1 at Depot, then travel to North. Plan T2's trip before advancing.</p>
            <p>Pickup and delivery take no time. Delivery at the day limit is allowed, but new pickups and travel aren't.</p>
            <p>Review result shows your current score without changing the day. Replay checks your accepted decisions against a fresh run. Reset starts over. Reloading or closing the page loses this run.</p>
          </details>
          <details open class="instructions">
            <summary>Travel times</summary>
            <p>Each route takes the same time in both directions.</p>
            <ul data-routes></ul>
          </details>
        </div>
      </section>

      <div class="stack">
        <section class="panel" role="region" aria-label="Trucks">
          <div class="panel-inner">
            <h2>Trucks</h2>
            <div class="record-grid" data-trucks></div>
          </div>
        </section>
        <section class="panel" role="region" aria-label="Loads">
          <div class="panel-inner">
            <h2>Loads</h2>
            <div class="record-grid" data-loads></div>
          </div>
        </section>
        <section class="panel" role="region" aria-label="Accepted events">
          <div class="panel-inner">
            <h2>Accepted events</h2>
            <ol class="event-list" data-events></ol>
          </div>
        </section>
        <section class="panel" role="region" aria-label="Result" tabindex="-1" data-result>
          <div class="panel-inner">
            <h2>Result</h2>
            <p class="run-summary" data-result-summary></p>
            <div class="result-grid">
              <div class="result-item">
                <span class="metric-label">Delivered loads</span>
                <output role="group" aria-label="Delivered loads" data-delivered></output>
              </div>
              <div class="result-item">
                <span class="metric-label">Undelivered loads</span>
                <output role="group" aria-label="Undelivered loads" data-undelivered></output>
              </div>
              <div class="result-item" data-all-delivered-item>
                <span class="metric-label">All delivered</span>
                <output role="group" aria-label="All delivered" data-all-delivered></output>
              </div>
              <div class="result-item">
                <span class="metric-label">Completion minute</span>
                <output role="group" aria-label="Completion minute" data-completion></output>
              </div>
              <div class="result-item">
                <span class="metric-label">Accepted command count</span>
                <output role="group" aria-label="Accepted command count" data-command-count></output>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
`;

export function mountManifest(root: HTMLElement): void {
  const document = root.ownerDocument;
  root.innerHTML = SHELL;

  const scenario = getScenarioProjection();
  let session = createSession();
  const journal: ParsedCommand[] = [];

  const form = requireElement<HTMLFormElement>(root, "form");
  const commandSelect = requireElement<HTMLSelectElement>(root, "[data-command]");
  const truckSelect = requireElement<HTMLSelectElement>(root, "[data-truck]");
  const loadSelect = requireElement<HTMLSelectElement>(root, "[data-load]");
  const destinationSelect = requireElement<HTMLSelectElement>(
    root,
    "[data-destination]",
  );
  const truckField = requireElement<HTMLElement>(root, "[data-truck-field]");
  const loadField = requireElement<HTMLElement>(root, "[data-load-field]");
  const destinationField = requireElement<HTMLElement>(
    root,
    "[data-destination-field]",
  );
  const resetButton = requireElement<HTMLButtonElement>(root, "[data-reset]");
  const replayButton = requireElement<HTMLButtonElement>(root, "[data-replay]");
  const status = requireElement<HTMLElement>(root, "[data-status]");
  const rejectionHelp = requireElement<HTMLElement>(root, "[data-rejection-help]");
  const resultRegion = requireElement<HTMLElement>(root, "[data-result]");
  const minuteOutput = requireElement<HTMLOutputElement>(root, "[data-minute]");
  const trucksRegion = requireElement<HTMLElement>(root, "[data-trucks]");
  const loadsRegion = requireElement<HTMLElement>(root, "[data-loads]");
  const eventsRegion = requireElement<HTMLOListElement>(root, "[data-events]");
  const deliveredOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-delivered]",
  );
  const undeliveredOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-undelivered]",
  );
  const allDeliveredOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-all-delivered]",
  );
  const allDeliveredItem = requireElement<HTMLElement>(
    root,
    "[data-all-delivered-item]",
  );
  const completionOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-completion]",
  );
  const commandCountOutput = requireElement<HTMLOutputElement>(
    root,
    "[data-command-count]",
  );

  populateSelect(commandSelect, ["pickup", "travel", "deliver", "advance"]);
  populateSelect(truckSelect, Object.keys(scenario.trucks));
  populateSelect(loadSelect, Object.keys(scenario.loads));
  populateSelect(destinationSelect, scenario.locations);

  setText(root, "[data-objective]", `Deliver all ${scenario.objective.loadIds.length} loads by minute ${scenario.dayEndMinute}. Your score is the number delivered, with no speed bonus.`);
  const routes = requireElement<HTMLElement>(root, "[data-routes]");
  for (const [origin, destinations] of Object.entries(scenario.travelMinutes)) {
    for (const [destination, minutes] of Object.entries(destinations)) {
      if (scenario.locations.indexOf(origin) >= scenario.locations.indexOf(destination)) continue;
      const route = document.createElement("li");
      route.textContent = `${origin} ↔ ${destination}: ${minutes} minutes`;
      routes.append(route);
    }
  }
  setText(root, "[data-metric-limit]", String(scenario.dayEndMinute));
  setText(root, "[data-metric-locations]", String(scenario.locations.length));
  setText(root, "[data-metric-trucks]", String(Object.keys(scenario.trucks).length));
  setText(root, "[data-metric-loads]", String(Object.keys(scenario.loads).length));

  function populateSelect(select: HTMLSelectElement, values: readonly string[]): void {
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    }
  }

  function resetSelections(): void {
    commandSelect.value = "pickup";
    truckSelect.selectedIndex = 0;
    loadSelect.selectedIndex = 0;
    destinationSelect.selectedIndex = 0;
    updateVisibility();
  }

  function updateVisibility(): void {
    const command = commandSelect.value;
    const carriesLoad = command === "pickup" || command === "deliver";
    truckField.hidden = command === "advance";
    loadField.hidden = !carriesLoad;
    destinationField.hidden = command !== "travel";
  }

  function setStatus(message: string, tone?: "accepted" | "error"): void {
    status.textContent = message;
    rejectionHelp.textContent = "";
    if (tone === undefined) status.removeAttribute("data-tone");
    else status.dataset.tone = tone;
  }

  function render(): void {
    const projection = projectSession(session);
    minuteOutput.textContent = String(projection.minute);
    renderTrucks(projection.trucks);
    renderLoads(projection.loads);
    renderEvents(session.events);

    const result = projection.result;
    const score = `${result.delivered_count}/${scenario.objective.loadIds.length} loads delivered`;
    const summary = result.all_delivered
      ? `Dispatch complete. ${score} at minute ${result.completion_minute}. Reset day to try another plan.`
      : `${score} at minute ${projection.minute}. Remaining: ${formatIdList(result.undelivered_load_ids)}.`;
    setText(root, "[data-run-summary]", summary);
    setText(root, "[data-result-summary]", summary);
    deliveredOutput.textContent = formatIdList(result.delivered_load_ids);
    undeliveredOutput.textContent = formatIdList(result.undelivered_load_ids);
    allDeliveredOutput.textContent = result.all_delivered ? "yes" : "no";
    if (result.all_delivered) allDeliveredItem.dataset.success = "true";
    else allDeliveredItem.removeAttribute("data-success");
    completionOutput.textContent = result.all_delivered
      ? String(result.completion_minute)
      : "Not complete";
    commandCountOutput.textContent = String(journal.length);
  }

  function renderTrucks(
    trucks: ReturnType<typeof projectSession>["trucks"],
  ): void {
    trucksRegion.replaceChildren();
    for (const truck of Object.values(trucks)) {
      const positionKind = truck.position.kind;
      const position =
        positionKind === "at"
          ? truck.position.locationId
          : `${truck.position.originId} to ${truck.position.destinationId} at ${truck.position.arrivalMinute}`;
      const record = document.createElement("article");
      record.className = "record";
      record.dataset.truckId = truck.id;
      record.dataset.position = positionKind;
      appendRecordHeader(record, truck.id, positionKind === "at" ? "at location" : "in transit");
      appendDefinitionList(record, [
        ["Position", position],
        ["Capacity", String(truck.capacity)],
        ["Carried loads", formatIdList(truck.carriedLoadIds)],
      ]);
      trucksRegion.append(record);
    }
  }

  function renderLoads(loads: ReturnType<typeof projectSession>["loads"]): void {
    loadsRegion.replaceChildren();
    for (const load of Object.values(loads)) {
      const statusKind = load.status.kind;
      const statusDetail =
        statusKind === "available"
          ? "available"
          : statusKind === "carried"
            ? `carried by ${load.status.truckId}`
            : `delivered by ${load.status.truckId} at ${load.status.minute}`;
      const record = document.createElement("article");
      record.className = "record";
      record.dataset.loadId = load.id;
      record.dataset.status = statusKind;
      appendRecordHeader(record, load.id, statusKind);
      appendDefinitionList(record, [
        ["Origin", load.originId],
        ["Destination", load.destinationId],
        ["Size", String(load.size)],
        ["Status", statusDetail],
      ]);
      loadsRegion.append(record);
    }
  }

  function appendRecordHeader(record: HTMLElement, id: string, state: string): void {
    const header = document.createElement("div");
    header.className = "record-header";
    const idElement = document.createElement("span");
    idElement.className = "record-id";
    idElement.textContent = id;
    const stateElement = document.createElement("span");
    stateElement.className = "record-state";
    stateElement.textContent = state;
    header.append(idElement, stateElement);
    record.append(header);
  }

  function appendDefinitionList(
    record: HTMLElement,
    rows: readonly (readonly [string, string])[],
  ): void {
    const list = document.createElement("dl");
    for (const [label, value] of rows) {
      const term = document.createElement("dt");
      term.className = "record-label";
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      list.append(term, description);
    }
    record.append(list);
  }

  function renderEvents(events: readonly EngineEvent[]): void {
    eventsRegion.replaceChildren();
    if (events.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      const sequenceSpacer = document.createElement("span");
      sequenceSpacer.setAttribute("aria-hidden", "true");
      const message = document.createElement("span");
      message.textContent = "No accepted events yet.";
      empty.append(sequenceSpacer, message);
      eventsRegion.append(empty);
      return;
    }

    for (const event of events) {
      const item = document.createElement("li");
      item.dataset.eventType = event.type;
      const sequence = document.createElement("span");
      sequence.className = "event-sequence";
      sequence.textContent = String(event.sequence).padStart(3, "0");
      const detail = document.createElement("span");
      detail.textContent = describeEvent(event);
      item.append(sequence, detail);
      eventsRegion.append(item);
    }
  }

  function execute(raw: Record<string, unknown>): void {
    const parsed = parseCommandInput(raw);
    if (!parsed.ok) {
      setStatus(
        `Input error: ${parsed.error.code} (${parsed.error.field})`,
        "error",
      );
      return;
    }

    const outcome = submitCommand(
      session,
      parsed.command as ApplicationCommand,
    );
    if (!outcome.ok) {
      setStatus(`Rejected: ${outcome.rejection.code}`, "error");
      rejectionHelp.textContent = rejectionHints[outcome.rejection.code];
      return;
    }

    session = outcome.session;
    journal.push(clonePlainData(parsed.command));
    render();
    setStatus(
      `Accepted: ${outcome.acceptedEvents.map((accepted) => accepted.type).join(", ")}`,
      "accepted",
    );
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    execute(commandRecord());
  });
  requireElement<HTMLButtonElement>(root, "[data-advance]").addEventListener("click", () => {
    execute({ type: "advance" });
  });
  requireElement<HTMLButtonElement>(root, "[data-review]").addEventListener("click", () => {
    resultRegion.focus();
    resultRegion.scrollIntoView({ block: "start" });
  });

  commandSelect.addEventListener("change", updateVisibility);

  resetButton.addEventListener("click", () => {
    session = createSession();
    journal.length = 0;
    resetSelections();
    render();
    setStatus("Day reset.", "accepted");
  });

  replayButton.addEventListener("click", () => {
    const commands = clonePlainData(journal) as ApplicationCommand[];
    const replay = replayCommands(commands);
    if (!replay.ok) {
      setStatus(
        `Replay rejected at command ${replay.commandIndex + 1}: ${replay.rejection.code}`,
        "error",
      );
      return;
    }

    const sameProjection = structurallyEqual(
      projectSession(replay.session),
      projectSession(session),
    );
    const sameEvents = structurallyEqual(replay.session.events, session.events);
    if (!sameProjection || !sameEvents) {
      setStatus("Replay mismatch.", "error");
      return;
    }

    session = replay.session;
    render();
    setStatus(
      `Replay matched ${session.events.length} accepted events.`,
      "accepted",
    );
  });

  function commandRecord(): Record<string, unknown> {
    const type = commandSelect.value;
    if (type === "advance") return { type };
    if (type === "travel") {
      return {
        type,
        truckId: truckSelect.value,
        destinationId: destinationSelect.value,
      };
    }
    return { type, truckId: truckSelect.value, loadId: loadSelect.value };
  }

  resetSelections();
  render();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (element === null) throw new Error(`Manifest shell is missing ${selector}`);
  return element as T;
}

function setText(root: ParentNode, selector: string, value: string): void {
  requireElement<HTMLElement>(root, selector).textContent = value;
}

function formatIdList(ids: readonly string[]): string {
  return ids.length === 0 ? "None" : ids.join(", ");
}

function describeEvent(event: EngineEvent): string {
  switch (event.type) {
    case "load_picked_up":
      return `Minute ${event.minute}: ${event.truckId} picked up ${event.loadId}.`;
    case "travel_started":
      return `Minute ${event.minute}: ${event.truckId} left ${event.originId} for ${event.destinationId}, arriving at ${event.arrivalMinute}.`;
    case "truck_arrived":
      return `Minute ${event.minute}: ${event.truckId} arrived at ${event.destinationId} from ${event.originId}.`;
    case "load_delivered":
      return `Minute ${event.minute}: ${event.truckId} delivered ${event.loadId}.`;
  }
}

function clonePlainData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainData(item)) as T;
  }
  if (isRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      clone[key] = clonePlainData(item);
    }
    return clone as T;
  }
  return value;
}

function structurallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return (
      left.length === right.length &&
      left.every((value, index) => structurallyEqual(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        structurallyEqual(left[key], right[key]),
    )
  );
}
