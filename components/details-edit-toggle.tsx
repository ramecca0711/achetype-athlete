"use client";

import { useState } from "react";

type Props = {
  detailsId: string;
  formId?: string;
  initiallyOpen?: boolean;
  className?: string;
  editLabel?: string;
  closeLabel?: string;
};

export default function DetailsEditToggle({
  detailsId,
  formId,
  initiallyOpen = false,
  className = "badge",
  editLabel = "Edit",
  closeLabel = "Cancel"
}: Props) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const details = document.getElementById(detailsId) as HTMLDetailsElement | null;
        if (!details) return;
        const next = !details.open;
        if (!next && formId) {
          const form = document.getElementById(formId) as HTMLFormElement | null;
          form?.reset();
        }
        details.open = next;
        setOpen(next);
      }}
    >
      {open ? closeLabel : editLabel}
    </button>
  );
}
