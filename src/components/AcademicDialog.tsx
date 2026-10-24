import { X } from "lucide-react";
import { localISO, type State } from "../domain";
import type { useAcademicEditor } from "../useAcademicEditor";
export function AcademicDialog({
  state,
  days,
  editor,
}: {
  state: State;
  days: Date[];
  editor: ReturnType<typeof useAcademicEditor>;
}) {
  const {
    dialog,
    modal,
    setModal,
    editing,
    editAssignment,
    formError,
    submit,
    close,
    remove,
  } = editor;
  return (
    <dialog
      aria-labelledby="dialog-title"
      ref={dialog}
      onCancel={() => setModal(null)}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">MAKE A LITTLE SPACE</span>
          <h2 id="dialog-title">
            {modal === "assignment"
              ? editAssignment
                ? "Edit assignment"
                : "New assignment"
              : editing?.id
                ? "Edit scheduled time"
                : "Schedule time"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <form
        key={
          modal + (editAssignment?.id || editing?.id || editing?.start || "")
        }
        onSubmit={submit}
      >
        {modal === "assignment" ? (
          <>
            <label>
              Assignment title
              <input
                name="title"
                required
                maxLength={120}
                placeholder="What are you working on?"
                defaultValue={editAssignment?.title}
                autoFocus
              />
            </label>
            <label>
              Course
              <input
                name="course"
                required
                maxLength={40}
                placeholder="e.g. PSY 204"
                defaultValue={editAssignment?.course}
              />
            </label>
            <label>
              Due date & time
              <input
                type="datetime-local"
                name="due"
                required
                defaultValue={
                  editAssignment?.dueDate || `${localISO(days[4])}T17:00`
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Estimated minutes
                <input
                  type="number"
                  name="minutes"
                  required
                  defaultValue={editAssignment?.estimatedMinutes || 60}
                  min={15}
                  max={10080}
                  step={15}
                />
              </label>
              <label>
                Color
                <select
                  name="color"
                  defaultValue={editAssignment?.color || "lilac"}
                >
                  <option value="lilac">Amethyst</option>
                  <option value="mint">Sea glass</option>
                  <option value="peach">Rose quartz</option>
                  <option value="blue">Aquamarine</option>
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <label>
              Assignment
              <select
                name="assignment"
                defaultValue={editing?.assignmentId || ""}
              >
                <option value="">Personal / class event</option>
                {state.assignments
                  .filter((a) => !a.completed || a.id === editing?.assignmentId)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Event title (for personal / class events)
              <input
                name="title"
                maxLength={120}
                defaultValue={editing?.title || "Study time"}
                required
              />
            </label>
            <label>
              Start
              <input
                type="datetime-local"
                name="start"
                required
                defaultValue={editing?.start || `${localISO(days[0])}T15:00`}
              />
            </label>
            <label>
              End
              <input
                type="datetime-local"
                name="end"
                required
                defaultValue={editing?.end || `${localISO(days[0])}T16:00`}
              />
            </label>
            <p className="form-help">
              Conflicts and assignment deadlines are checked before saving.
            </p>
          </>
        )}
        {formError && (
          <p role="alert" className="error">
            {formError}
          </p>
        )}
        <div className="modal-actions">
          {editing?.id && (
            <button type="button" className="danger" onClick={remove}>
              Remove event
            </button>
          )}
          <button type="button" className="text-button" onClick={close}>
            Cancel
          </button>
          <button className="primary" type="submit">
            {modal === "assignment"
              ? editAssignment
                ? "Save assignment"
                : "Add assignment"
              : "Save time"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
