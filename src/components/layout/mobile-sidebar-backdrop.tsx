"use client";

interface MobileSidebarBackdropProps {
  onClose: () => void;
}

export function MobileSidebarBackdrop({ onClose }: MobileSidebarBackdropProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close navigation menu"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClose();
      }}
      className="fixed inset-0 z-30 bg-black/55 lg:hidden"
    />
  );
}
