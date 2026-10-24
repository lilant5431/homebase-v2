import { useRef, useState, type FormEvent } from "react";
import { type State, type Assignment, type Block } from "./domain";
import { putAssignment, putBlock, removeBlock } from "./academic";

export function useAcademicEditor(
  state: State,
  save: (next: State) => Promise<boolean>,
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [modal, setModal] = useState<"assignment" | "block" | null>(null),
    [editing, setEditing] = useState<Block | null>(null),
    [editAssignment, setEditAssignment] = useState<Assignment | null>(null),
    [formError, setFormError] = useState("");
  const editRevision = useRef(0);
  const open = (
    kind: "assignment" | "block",
    block: Block | null = null,
    assignment: Assignment | null = null,
  ) => {
    editRevision.current = state.revision;
    setFormError("");
    setEditing(block);
    setEditAssignment(assignment);
    setModal(kind);
    dialog.current?.showModal();
  };
  const close = () => {
    dialog.current?.close();
    setModal(null);
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    try {
      if (editRevision.current !== state.revision)
        throw Error(
          "Your plan changed while editing. Close and reopen this form.",
        );
      const f = new FormData(event.currentTarget);
      let next: State;
      if (modal === "assignment") {
        const assignment: Assignment = {
          id: editAssignment?.id || crypto.randomUUID(),
          title: String(f.get("title")).trim(),
          course: String(f.get("course")).trim(),
          dueDate: String(f.get("due")),
          estimatedMinutes: Number(f.get("minutes")),
          completed: editAssignment?.completed || false,
          color: String(f.get("color")),
        };
        next = putAssignment(state, assignment);
      } else {
        const id = String(f.get("assignment"));
        const a = state.assignments.find((a) => a.id === id);
        if (id && !a) throw Error("Assignment no longer exists.");
        const block: Block = {
          id: editing?.id || crypto.randomUUID(),
          ...(a ? { assignmentId: a.id } : {}),
          title: a?.title || String(f.get("title")).trim(),
          start: String(f.get("start")),
          end: String(f.get("end")),
          color: a?.color || "blue",
        };
        next = putBlock(state, block);
      }
      if (await save(next)) close();
      else
        setFormError(
          "Save failed. Check the workspace message; your form has been kept.",
        );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }
  async function remove() {
    try {
      if (!editing?.id) return;
      if (editRevision.current !== state.revision)
        throw Error(
          "Your plan changed while editing. Close and reopen this form.",
        );
      if (await save(removeBlock(state, editing.id))) close();
      else setFormError("Save failed. Your event has been kept.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }
  return {
    dialog,
    modal,
    setModal,
    editing,
    editAssignment,
    formError,
    submit,
    open,
    close,
    remove,
  };
}
