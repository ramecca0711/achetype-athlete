/**
 * Client component for the admin delete member button.
 * Wraps a form submission with a window.confirm dialog so the admin
 * must explicitly confirm before the irreversible delete is sent to the server.
 */
"use client";

import { useRef } from "react";

type Props = {
  profileId: string;
  fullName: string;
  email: string;
  // Server action to call when confirmed
  action: (formData: FormData) => void;
};

export default function AdminDeleteMemberButton({ profileId, fullName, email, action }: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // Prevent the form from submitting until the user confirms
    event.preventDefault();

    const confirmed = window.confirm(
      `Delete member "${fullName}" (${email})?\n\nThis cannot be undone.`
    );

    if (confirmed && formRef.current) {
      // Submit the form programmatically after confirmation
      formRef.current.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="profile_id" value={profileId} />
      <button
        type="button"
        onClick={handleClick}
        className="btn btn-danger"
        title={`Delete ${fullName}`}
        aria-label={`Delete member ${fullName}`}
      >
        {/* Trash can icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 10v6M14 10v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
