import {
  CommandId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  type OrchestrationReadModel,
} from "@t3tools/contracts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { decideOrchestrationCommand } from "./decider.ts";

const UPDATED_AT = "2026-01-01T00:00:00.000Z";

const readModel: OrchestrationReadModel = {
  snapshotSequence: 0,
  projects: [],
  threads: [
    {
      id: ThreadId.make("thread-1"),
      projectId: ProjectId.make("project-1"),
      title: "Manual title",
      modelSelection: { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: "/repo",
      pullRequests: [],
      latestTurn: null,
      createdAt: UPDATED_AT,
      updatedAt: UPDATED_AT,
      archivedAt: null,
      settledOverride: null,
      settledAt: null,
      snoozedUntil: null,
      snoozedAt: null,
      deletedAt: null,
      messages: [],
      proposedPlans: [],
      activities: [],
      checkpoints: [],
      session: {
        threadId: ThreadId.make("thread-1"),
        status: "running",
        providerName: "codex",
        runtimeMode: "full-access",
        activeTurnId: TurnId.make("turn-1"),
        lastError: null,
        updatedAt: UPDATED_AT,
      },
    },
  ],
  updatedAt: UPDATED_AT,
};

const moveTo = (worktreePath: string) =>
  decideOrchestrationCommand({
    command: {
      type: "thread.meta.update",
      commandId: CommandId.make("cmd-move"),
      threadId: ThreadId.make("thread-1"),
      worktreePath,
    },
    readModel,
  });

it.layer(NodeServices.layer)("worktree move decider", (it) => {
  it.effect("rejects moving the worktree during a running turn", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(moveTo("/repo-wt"));
      expect(Exit.isFailure(exit)).toBe(true);
    }),
  );

  it.effect("accepts resending the current worktree during a running turn", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(moveTo("/repo"));
      expect(Exit.isSuccess(exit)).toBe(true);
    }),
  );
});
