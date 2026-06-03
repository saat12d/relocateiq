import React from "react";

type LogoutButtonProps = {
  onLogout: () => void;
  className?: string;
};

export default function LogoutButton({
  onLogout,
  className = "button button--ghost",
}: LogoutButtonProps) {
  return (
    <button type="button" className={className} onClick={onLogout}>
      Log out
    </button>
  );
}
