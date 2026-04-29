"use client";

interface VideoButtonProps {
  onClick: () => void;
}

export function VideoButton({ onClick }: VideoButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Watch tutorial"
      aria-label="Watch tutorial video"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        width: "44px",
        height: "44px",
        borderRadius: "50%",
        background: "#3b82f6",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: 700,
        boxShadow: "0 4px 14px rgba(59,130,246,0.5)",
        zIndex: 9999,
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(59,130,246,0.65)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(59,130,246,0.5)";
      }}
    >
      ?
    </button>
  );
}
