export type LocationId = "Depot" | "North" | "South";
export type TruckId = "T1" | "T2";
export type LoadId = "L1" | "L2" | "L3" | "L4";

export type RejectionCode =
  | "UNKNOWN_COMMAND"
  | "UNKNOWN_TRUCK"
  | "UNKNOWN_LOAD"
  | "UNKNOWN_LOCATION"
  | "DAY_ENDED"
  | "TRUCK_IN_TRANSIT"
  | "LOAD_ALREADY_DELIVERED"
  | "LOAD_NOT_AVAILABLE"
  | "LOAD_NOT_CARRIED"
  | "WRONG_LOCATION"
  | "INVALID_TRAVEL_LEG"
  | "CAPACITY_EXCEEDED"
  | "ARRIVAL_AFTER_DAY_END"
  | "NO_SCHEDULED_EVENT";

interface TruckDefinition {
  readonly id: TruckId;
  readonly initialLocationId: LocationId;
  readonly capacity: number;
}

interface LoadDefinition {
  readonly id: LoadId;
  readonly originId: LocationId;
  readonly destinationId: LocationId;
  readonly size: number;
}

interface Scenario {
  readonly dayEndMinute: number;
  readonly locations: readonly LocationId[];
  readonly travelMinutes: Readonly<
    Record<LocationId, Readonly<Partial<Record<LocationId, number>>>>
  >;
  readonly trucks: Readonly<Record<TruckId, Readonly<TruckDefinition>>>;
  readonly loads: Readonly<Record<LoadId, Readonly<LoadDefinition>>>;
}

export const M1_SCENARIO: Scenario = {
  dayEndMinute: 480,
  locations: ["Depot", "North", "South"],
  travelMinutes: {
    Depot: { North: 60, South: 75 },
    North: { Depot: 60, South: 45 },
    South: { Depot: 75, North: 45 },
  },
  trucks: {
    T1: { id: "T1", initialLocationId: "Depot", capacity: 2 },
    T2: { id: "T2", initialLocationId: "Depot", capacity: 2 },
  },
  loads: {
    L1: { id: "L1", originId: "Depot", destinationId: "North", size: 2 },
    L2: { id: "L2", originId: "Depot", destinationId: "South", size: 1 },
    L3: { id: "L3", originId: "North", destinationId: "South", size: 1 },
    L4: { id: "L4", originId: "South", destinationId: "Depot", size: 2 },
  },
};

export type Position =
  | { readonly kind: "at"; readonly locationId: LocationId }
  | {
      readonly kind: "in_transit";
      readonly originId: LocationId;
      readonly destinationId: LocationId;
      readonly arrivalMinute: number;
      readonly scheduleSequence: number;
    };

export type LoadStatus =
  | { readonly kind: "available" }
  | { readonly kind: "carried"; readonly truckId: TruckId }
  | {
      readonly kind: "delivered";
      readonly truckId: TruckId;
      readonly minute: number;
    };

export interface TruckState {
  readonly id: TruckId;
  readonly capacity: number;
  readonly position: Position;
  readonly carriedLoadIds: readonly LoadId[];
}

export interface LoadState {
  readonly id: LoadId;
  readonly originId: LocationId;
  readonly destinationId: LocationId;
  readonly size: number;
  readonly status: LoadStatus;
}

export interface ScheduledEvent {
  readonly type: "truck_arrival";
  readonly minute: number;
  readonly scheduleSequence: number;
  readonly truckId: TruckId;
  readonly originId: LocationId;
  readonly destinationId: LocationId;
}

export interface State {
  readonly minute: number;
  readonly nextEventSequence: number;
  readonly nextScheduleSequence: number;
  readonly trucks: Readonly<Record<TruckId, TruckState>>;
  readonly loads: Readonly<Record<LoadId, LoadState>>;
  readonly scheduledEvents: readonly ScheduledEvent[];
}

export interface PickupCommand {
  readonly type: "pickup";
  readonly truckId: TruckId;
  readonly loadId: LoadId;
}

export interface TravelCommand {
  readonly type: "travel";
  readonly truckId: TruckId;
  readonly destinationId: LocationId;
}

export interface DeliverCommand {
  readonly type: "deliver";
  readonly truckId: TruckId;
  readonly loadId: LoadId;
}

export interface AdvanceCommand {
  readonly type: "advance";
}

export type Command =
  | PickupCommand
  | TravelCommand
  | DeliverCommand
  | AdvanceCommand;

export type EngineEvent =
  | {
      readonly type: "load_picked_up";
      readonly sequence: number;
      readonly minute: number;
      readonly truckId: TruckId;
      readonly loadId: LoadId;
    }
  | {
      readonly type: "travel_started";
      readonly sequence: number;
      readonly minute: number;
      readonly truckId: TruckId;
      readonly originId: LocationId;
      readonly destinationId: LocationId;
      readonly arrivalMinute: number;
      readonly scheduleSequence: number;
    }
  | {
      readonly type: "truck_arrived";
      readonly sequence: number;
      readonly minute: number;
      readonly truckId: TruckId;
      readonly originId: LocationId;
      readonly destinationId: LocationId;
    }
  | {
      readonly type: "load_delivered";
      readonly sequence: number;
      readonly minute: number;
      readonly truckId: TruckId;
      readonly loadId: LoadId;
    };

export type TransitionOutcome =
  | {
      readonly ok: true;
      readonly state: State;
      readonly events: readonly EngineEvent[];
    }
  | {
      readonly ok: false;
      readonly state: State;
      readonly rejection: { readonly code: RejectionCode };
    };

export type Result =
  | {
      readonly delivered_load_ids: readonly LoadId[];
      readonly undelivered_load_ids: readonly LoadId[];
      readonly delivered_count: number;
      readonly all_delivered: false;
    }
  | {
      readonly delivered_load_ids: readonly LoadId[];
      readonly undelivered_load_ids: readonly LoadId[];
      readonly delivered_count: number;
      readonly all_delivered: true;
      readonly completion_minute: number;
    };

export function createInitialState(): State {
  return {
    minute: 0,
    nextEventSequence: 1,
    nextScheduleSequence: 1,
    trucks: {
      T1: {
        id: "T1",
        capacity: 2,
        position: { kind: "at", locationId: "Depot" },
        carriedLoadIds: [],
      },
      T2: {
        id: "T2",
        capacity: 2,
        position: { kind: "at", locationId: "Depot" },
        carriedLoadIds: [],
      },
    },
    loads: {
      L1: {
        id: "L1",
        originId: "Depot",
        destinationId: "North",
        size: 2,
        status: { kind: "available" },
      },
      L2: {
        id: "L2",
        originId: "Depot",
        destinationId: "South",
        size: 1,
        status: { kind: "available" },
      },
      L3: {
        id: "L3",
        originId: "North",
        destinationId: "South",
        size: 1,
        status: { kind: "available" },
      },
      L4: {
        id: "L4",
        originId: "South",
        destinationId: "Depot",
        size: 2,
        status: { kind: "available" },
      },
    },
    scheduledEvents: [],
  };
}

export function transition(state: State, command: Command): TransitionOutcome {
  switch (command.type) {
    case "pickup":
      return pickup(state, command);
    case "travel":
      return travel(state, command);
    case "deliver":
      return deliver(state, command);
    case "advance":
      return advance(state);
    default:
      return reject(state, "UNKNOWN_COMMAND");
  }
}

function pickup(state: State, command: PickupCommand): TransitionOutcome {
  if (!Object.hasOwn(state.trucks, command.truckId)) return reject(state, "UNKNOWN_TRUCK");
  const truck = state.trucks[command.truckId];
  if (!Object.hasOwn(state.loads, command.loadId)) return reject(state, "UNKNOWN_LOAD");
  const load = state.loads[command.loadId];
  if (state.minute >= M1_SCENARIO.dayEndMinute) {
    return reject(state, "DAY_ENDED");
  }
  if (truck.position.kind === "in_transit") {
    return reject(state, "TRUCK_IN_TRANSIT");
  }
  if (load.status.kind === "delivered") {
    return reject(state, "LOAD_ALREADY_DELIVERED");
  }
  if (load.status.kind === "carried") {
    return reject(state, "LOAD_NOT_AVAILABLE");
  }
  if (truck.position.locationId !== load.originId) {
    return reject(state, "WRONG_LOCATION");
  }

  const carriedSize = truck.carriedLoadIds.reduce(
    (size, loadId) => size + state.loads[loadId].size,
    0,
  );
  if (carriedSize + load.size > truck.capacity) {
    return reject(state, "CAPACITY_EXCEEDED");
  }

  const event: EngineEvent = {
    type: "load_picked_up",
    sequence: state.nextEventSequence,
    minute: state.minute,
    truckId: command.truckId,
    loadId: command.loadId,
  };
  return {
    ok: true,
    state: {
      ...state,
      nextEventSequence: state.nextEventSequence + 1,
      trucks: {
        ...state.trucks,
        [command.truckId]: {
          ...truck,
          carriedLoadIds: [...truck.carriedLoadIds, command.loadId],
        },
      },
      loads: {
        ...state.loads,
        [command.loadId]: {
          ...load,
          status: { kind: "carried", truckId: command.truckId },
        },
      },
    },
    events: [event],
  };
}

function travel(state: State, command: TravelCommand): TransitionOutcome {
  if (!Object.hasOwn(state.trucks, command.truckId)) return reject(state, "UNKNOWN_TRUCK");
  const truck = state.trucks[command.truckId];
  if (!isLocation(command.destinationId)) {
    return reject(state, "UNKNOWN_LOCATION");
  }
  if (state.minute >= M1_SCENARIO.dayEndMinute) {
    return reject(state, "DAY_ENDED");
  }
  if (truck.position.kind === "in_transit") {
    return reject(state, "TRUCK_IN_TRANSIT");
  }

  const originId = truck.position.locationId;
  if (originId === command.destinationId) {
    return reject(state, "INVALID_TRAVEL_LEG");
  }
  const travelMinutes = M1_SCENARIO.travelMinutes[originId][command.destinationId];
  if (travelMinutes === undefined) {
    return reject(state, "INVALID_TRAVEL_LEG");
  }

  const arrivalMinute = state.minute + travelMinutes;
  if (arrivalMinute > M1_SCENARIO.dayEndMinute) {
    return reject(state, "ARRIVAL_AFTER_DAY_END");
  }

  const scheduleSequence = state.nextScheduleSequence;
  const scheduledEvent: ScheduledEvent = {
    type: "truck_arrival",
    minute: arrivalMinute,
    scheduleSequence,
    truckId: command.truckId,
    originId,
    destinationId: command.destinationId,
  };
  const event: EngineEvent = {
    type: "travel_started",
    sequence: state.nextEventSequence,
    minute: state.minute,
    truckId: command.truckId,
    originId,
    destinationId: command.destinationId,
    arrivalMinute,
    scheduleSequence,
  };

  return {
    ok: true,
    state: {
      ...state,
      nextEventSequence: state.nextEventSequence + 1,
      nextScheduleSequence: scheduleSequence + 1,
      trucks: {
        ...state.trucks,
        [command.truckId]: {
          ...truck,
          position: {
            kind: "in_transit",
            originId,
            destinationId: command.destinationId,
            arrivalMinute,
            scheduleSequence,
          },
        },
      },
      scheduledEvents: [...state.scheduledEvents, scheduledEvent].sort(
        compareScheduledEvents,
      ),
    },
    events: [event],
  };
}

function deliver(state: State, command: DeliverCommand): TransitionOutcome {
  if (!Object.hasOwn(state.trucks, command.truckId)) return reject(state, "UNKNOWN_TRUCK");
  const truck = state.trucks[command.truckId];
  if (!Object.hasOwn(state.loads, command.loadId)) return reject(state, "UNKNOWN_LOAD");
  const load = state.loads[command.loadId];
  if (state.minute > M1_SCENARIO.dayEndMinute) {
    return reject(state, "DAY_ENDED");
  }
  if (truck.position.kind === "in_transit") {
    return reject(state, "TRUCK_IN_TRANSIT");
  }
  if (load.status.kind === "delivered") {
    return reject(state, "LOAD_ALREADY_DELIVERED");
  }
  if (
    load.status.kind !== "carried" ||
    load.status.truckId !== command.truckId
  ) {
    return reject(state, "LOAD_NOT_CARRIED");
  }
  if (truck.position.locationId !== load.destinationId) {
    return reject(state, "WRONG_LOCATION");
  }

  const event: EngineEvent = {
    type: "load_delivered",
    sequence: state.nextEventSequence,
    minute: state.minute,
    truckId: command.truckId,
    loadId: command.loadId,
  };
  return {
    ok: true,
    state: {
      ...state,
      nextEventSequence: state.nextEventSequence + 1,
      trucks: {
        ...state.trucks,
        [command.truckId]: {
          ...truck,
          carriedLoadIds: truck.carriedLoadIds.filter(
            (loadId) => loadId !== command.loadId,
          ),
        },
      },
      loads: {
        ...state.loads,
        [command.loadId]: {
          ...load,
          status: {
            kind: "delivered",
            truckId: command.truckId,
            minute: state.minute,
          },
        },
      },
    },
    events: [event],
  };
}

function advance(state: State): TransitionOutcome {
  if (state.minute > M1_SCENARIO.dayEndMinute) {
    return reject(state, "DAY_ENDED");
  }
  if (state.scheduledEvents.length === 0) {
    return reject(state, "NO_SCHEDULED_EVENT");
  }

  const targetMinute = Math.min(
    ...state.scheduledEvents.map((event) => event.minute),
  );
  const due = state.scheduledEvents
    .filter((event) => event.minute === targetMinute)
    .sort(compareScheduledEvents);
  const remaining = state.scheduledEvents.filter(
    (event) => event.minute !== targetMinute,
  );

  const trucks: Record<TruckId, TruckState> = { ...state.trucks };
  const events: EngineEvent[] = [];
  let nextEventSequence = state.nextEventSequence;
  for (const scheduledEvent of due) {
    const truck = trucks[scheduledEvent.truckId];
    trucks[scheduledEvent.truckId] = {
      ...truck,
      position: { kind: "at", locationId: scheduledEvent.destinationId },
    };
    events.push({
      type: "truck_arrived",
      sequence: nextEventSequence,
      minute: targetMinute,
      truckId: scheduledEvent.truckId,
      originId: scheduledEvent.originId,
      destinationId: scheduledEvent.destinationId,
    });
    nextEventSequence += 1;
  }

  return {
    ok: true,
    state: {
      ...state,
      minute: targetMinute,
      nextEventSequence,
      trucks,
      scheduledEvents: remaining,
    },
    events,
  };
}

export function getResult(state: State): Result {
  const loadIds = (Object.keys(M1_SCENARIO.loads) as LoadId[]).sort();
  const deliveredLoadIds: LoadId[] = [];
  const undeliveredLoadIds: LoadId[] = [];
  let completionMinute = 0;

  for (const loadId of loadIds) {
    const status = state.loads[loadId].status;
    if (status.kind === "delivered") {
      deliveredLoadIds.push(loadId);
      completionMinute = Math.max(completionMinute, status.minute);
    } else {
      undeliveredLoadIds.push(loadId);
    }
  }

  const deliveredCount = deliveredLoadIds.length;
  if (deliveredCount === loadIds.length) {
    return {
      delivered_load_ids: deliveredLoadIds,
      undelivered_load_ids: undeliveredLoadIds,
      delivered_count: deliveredCount,
      all_delivered: true,
      completion_minute: completionMinute,
    };
  }
  return {
    delivered_load_ids: deliveredLoadIds,
    undelivered_load_ids: undeliveredLoadIds,
    delivered_count: deliveredCount,
    all_delivered: false,
  };
}

function reject(state: State, code: RejectionCode): TransitionOutcome {
  return { ok: false, state, rejection: { code } };
}

function isLocation(value: string): value is LocationId {
  return M1_SCENARIO.locations.includes(value as LocationId);
}

function compareScheduledEvents(a: ScheduledEvent, b: ScheduledEvent): number {
  return a.minute - b.minute || a.scheduleSequence - b.scheduleSequence;
}
