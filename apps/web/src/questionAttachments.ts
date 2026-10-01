import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type {
  ApprovalRequestId,
  EnvironmentId,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";
import { create } from "zustand";
import { DraftId, useComposerDraftStore } from "./composerDraftStore";
import { releaseDraftAttachments } from "./lib/attachmentUploadQueue";

export function questionAttachmentDraftPrefix(
  environmentId: EnvironmentId,
  threadId: ThreadId,
): string {
  return `${encodeURIComponent(JSON.stringify(environmentId))}:question-${encodeURIComponent(JSON.stringify(threadId))}-`;
}

export function questionAttachmentDraftId(
  environmentId: EnvironmentId,
  threadId: ThreadId,
  requestId: ApprovalRequestId,
  questionId: string,
): DraftId {
  return DraftId.make(
    `${questionAttachmentDraftPrefix(environmentId, threadId)}${encodeURIComponent(JSON.stringify([requestId, questionId]))}`,
  );
}

const openQuestionDrafts = new Map<string, DraftId>();
const openQuestionKeys = new Map<DraftId, ReadonlyArray<DraftId>>();

/** The question draft currently receiving attachments for a thread, so SnapShot delivery lands beside drag-drop files instead of on the hidden thread composer. */
export function openQuestionAttachmentDraft(threadRef: ScopedThreadRef): DraftId | null {
  return openQuestionDrafts.get(scopedThreadKey(threadRef)) ?? null;
}

/** `questionKeys` lists every question draft of the request, since they share one attachment limit. */
export function trackOpenQuestionAttachmentDraft(
  threadRef: ScopedThreadRef,
  draftId: DraftId,
  questionKeys: ReadonlyArray<DraftId>,
): () => void {
  const key = scopedThreadKey(threadRef);
  openQuestionDrafts.set(key, draftId);
  openQuestionKeys.set(draftId, questionKeys);
  return () => {
    if (openQuestionDrafts.get(key) === draftId) openQuestionDrafts.delete(key);
    if (openQuestionKeys.get(draftId) === questionKeys) openQuestionKeys.delete(draftId);
  };
}

/** Attachments reserved across the open request that `draftId` answers; 0 for non-question drafts. */
export function countOpenQuestionRequestAttachments(draftId: DraftId): number {
  return countQuestionAttachments(openQuestionKeys.get(draftId) ?? []);
}

export const useQuestionAttachmentPreparation = create<{ counts: Record<string, number> }>(() => ({
  counts: {},
}));

/** Count both staged files and in-flight preparation against the shared question limit. */
export function countQuestionAttachments(keys: ReadonlyArray<DraftId>): number {
  const store = useComposerDraftStore.getState();
  const { counts } = useQuestionAttachmentPreparation.getState();
  return keys.reduce((total, key) => {
    const draft = store.getComposerDraft(key);
    return total + (draft?.images.length ?? 0) + (draft?.files.length ?? 0) + (counts[key] ?? 0);
  }, 0);
}

export function changeQuestionAttachmentPreparation(key: DraftId, delta: number): void {
  useQuestionAttachmentPreparation.setState((state) =>
    delta < 0 && !(key in state.counts)
      ? state
      : {
          counts: { ...state.counts, [key]: Math.max(0, (state.counts[key] ?? 0) + delta) },
        },
  );
}

export function clearQuestionAttachmentDraft(key: DraftId): void {
  const store = useComposerDraftStore.getState();
  const draft = store.getComposerDraft(key);
  if (draft) {
    releaseDraftAttachments([...draft.images, ...draft.files]);
    for (const image of draft.images) {
      if (image.previewUrl.startsWith("blob:")) URL.revokeObjectURL(image.previewUrl);
    }
  }
  store.clearComposerContent(key);
  useQuestionAttachmentPreparation.setState(({ counts }) => {
    const next = { ...counts };
    delete next[key];
    return { counts: next };
  });
}
