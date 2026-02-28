"use client";

import { useState } from "react";

type Props = {
  detailsId: string;
  initiallyOpen?: boolean;
  className?: string;
  editLabel?: string;
  closeLabel?: string;
};

export default function DetailsEditToggle({
  detailsId,
  initiallyOpen = false,
  className = "badge",
  editLabel = "Edit",
  closeLabel = "Close"
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
        details.open = next;
        setOpen(next);
      }}
    >
      {open ? closeLabel : editLabel}
    </button>
  );
}

