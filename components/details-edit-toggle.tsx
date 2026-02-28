"use client";

import { useState } from "react";

type Props = {
  detailsId: string;
  formId?: string;
  initiallyEditing?: boolean;
  className?: string;
  editLabel?: string;
  closeLabel?: string;
};

export default function DetailsEditToggle({
  detailsId,
  formId,
  initiallyEditing = false,
  className = "badge",
  editLabel = "Edit",
  closeLabel = "Cancel"
}: Props) {
  const [editing, setEditing] = useState(initiallyEditing);

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const details = document.getElementById(detailsId) as HTMLDetailsElement | null;
        if (!details) return;
        const isEditingNow = details.dataset.editing === "1" || editing;

        // Closed card: always open directly into edit mode.
        if (!details.open) {
          details.open = true;
          details.dataset.editing = "1";
          setEditing(true);
          return;
        }

        if (isEditingNow) {
          // Cancel edit: reset form and return to read-only view, keep card open.
          if (formId) {
            const form = document.getElementById(formId) as HTMLFormElement | null;
            form?.reset();
          }
          details.dataset.editing = "0";
          details.open = true;
          setEditing(false);
        } else {
          // Read-only open card: switch into edit mode in place.
          details.dataset.editing = "1";
          details.open = true;
          setEditing(true);
        }
      }}
    >
      {editing ? closeLabel : editLabel}
    </button>
  );
}
