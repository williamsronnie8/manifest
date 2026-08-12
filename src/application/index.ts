import {
  createInitialState,
  getResult,
  transition,
  type Command,
  type EngineEvent,
  type LoadId,
  type LoadState,
  type RejectionCode,
  type Result,
  type State,
  type TruckId,
  type TruckState,
} from "../engine/index.js";

export interface Session {
  readonly state: State;
  readonly events: readonly EngineEvent[];
}

export type SubmitOutcome =
  | {
      readonly ok: true;
      readonly acceptedEvents: readonly EngineEvent[];
      readonly session: Session;
    }
  | {
      readonly ok: false;
      readonly session: Session;
      readonly rejection: { readonly code: RejectionCode };
    };

export type ReplayOutcome =
  | { readonly ok: true; readonly session: Session }
  | {
      readonly ok: false;
      readonly commandIndex: number;
      readonly session: Session;
      readonly rejection: { readonly code: RejectionCode };
    };

export interface SessionProjection {
  readonly minute: number;
  readonly trucks: Readonly<Record<TruckId, TruckState>>;
  readonly loads: Readonly<Record<LoadId, LoadState>>;
  readonly result: Result;
}

export function createSession(): Session {
  return { state: createInitialState(), events: [] };
}

export function submitCommand(
  session: Session,
  command: Command,
): SubmitOutcome {
  const outcome = transition(session.state, command);
  if (!outcome.ok) {
    return { ok: false, session, rejection: outcome.rejection };
  }

  return {
    ok: true,
    acceptedEvents: outcome.events,
    session: {
      state: outcome.state,
      events: [...session.events, ...outcome.events],
    },
  };
}

export function projectSession(session: Session): SessionProjection {
  return {
    minute: session.state.minute,
    trucks: clonePlainData(session.state.trucks),
    loads: clonePlainData(session.state.loads),
    result: getResult(session.state),
  };
}

export function replayCommands(commands: readonly Command[]): ReplayOutcome {
  let session = createSession();
  for (let commandIndex = 0; commandIndex < commands.length; commandIndex += 1) {
    const outcome = submitCommand(session, commands[commandIndex]!);
    if (!outcome.ok) {
      return {
        ok: false,
        commandIndex,
        session,
        rejection: outcome.rejection,
      };
    }
    session = outcome.session;
  }
  return { ok: true, session };
}

function clonePlainData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainData(item)) as T;
  }
  if (typeof value === "object" && value !== null) {
    const clone: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      clone[key] = clonePlainData((value as Record<string, unknown>)[key]);
    }
    return clone as T;
  }
  return value;
}
