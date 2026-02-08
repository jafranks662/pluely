import { cn } from "@/lib/utils";
import { UsersIcon, UserIcon } from "lucide-react";
import { ConversationMode } from "@/types";

type Props = {
  mode: ConversationMode;
  onChange: (mode: ConversationMode) => void;
  disabled?: boolean;
};

export const MeetingModeToggle = ({ mode, onChange, disabled }: Props) => {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg bg-muted p-0.5",
        disabled && "opacity-50 pointer-events-none"
      )}
      role="group"
      aria-label="Conversation mode"
    >
      <button
        type="button"
        onClick={() => onChange("personal")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition",
          mode === "personal"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "personal"}
      >
        <UserIcon className="h-3 w-3" aria-hidden="true" />
        Personal
      </button>
      <button
        type="button"
        onClick={() => onChange("meeting")}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition",
          mode === "meeting"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={mode === "meeting"}
      >
        <UsersIcon className="h-3 w-3" aria-hidden="true" />
        Meeting
      </button>
    </div>
  );
};
